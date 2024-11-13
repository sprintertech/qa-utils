import {
  type Eip1193Provider,
  Environment,
  EthereumConfig,
  Network,
} from "@buildwithsygma/core";
import { getSygmaScanLink } from "@buildwithsygma/core";
import { createCrossChainContractCall } from "@buildwithsygma/evm";
import dotenv from "dotenv";
import { Wallet, ethers, providers } from "ethers";
import Web3HttpProvider from "web3-providers-http";
import { sepoliaBaseStorageContract } from "./index";
import axios from "axios";

dotenv.config();

interface Domain {
  id: number;
  type: string;
}

interface TransferParams {
  sourceChainId: number;
  destinationChainId: number;
  resourceId: string;
  sourceAddress: string;
  destinationAddress: string;
  web3Provider: Web3HttpProvider;
  wallet: Wallet;
}

const contractAddresses: Record<number, string> = {
  11155111: "0x10791B617D2Dad4978Cc18E3A88e422310428430",
  338: "0x4b17531F07e002Ee2A0714F79d84d9bEcF6b243D",
  17000: "0x5984CA38b38b43d0A9c94BA5a6D6969E92124a15",
  421614: "0xD7d5E7d7eaD31E783Df01760FbFad249704Aab14",
  10200: "0x40e273C40349dCA9062F9a3B80BAdFF000512c1F",
  84532: "0xF1bFBbE4174E2E6595E095BDF3ac8b97aF7796aA",
  80002: "0x2d5395aa622DBC7688B2eEeD3E2dC089aE0fd356",
  1993: "0xF5Ac994A5C402F4f426c2D7319C27912d5DBD7a8",
};

const MAX_FEE = "350000";
const testSourceDomainIDs: number[] = [1];
const testDestDomainIDs: number[] = [10];
const testResourceIds: string[] = [
  "0x0000000000000000000000000000000000000000000000000000000000000600",
];
const sygmaEnv = process.env.SYGMA_ENV as Environment;
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

let sharedEVMDomainIDs: number[] = [];
let evmNetworks: Array<EthereumConfig> = [];
let sharedEVMNonFungibleRessIDs: string[] = [];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function generateUniqueValue() {
  return ethers.utils.hexlify(
    ethers.utils.formatBytes32String(Date.now().toString())
  );
}

const getTxExplorerUrl = ({
  txHash,
  chainId,
}: {
  txHash: string;
  chainId: number;
}) => process.env[`SCAN_URL_${chainId}`] + `/tx/${txHash}`;

async function getOverridesForPolygon() {
  try {
    const gasResponse = await fetch(
      "https://gasstation.polygon.technology/amoy"
    );
    const { standard } = await gasResponse.json();
    return {
      maxFeePerGas: ethers.utils.parseUnits(standard.maxFee.toString(), "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits(
        standard.maxPriorityFee.toString(),
        "gwei"
      ),
    };
  } catch (error) {
    console.error("Error fetching gas prices:", error);
    return {};
  }
}

async function fetchRemoteFile(path: string) {
  try {
    const { data } = await axios.get(path);
    return data;
  } catch (error) {
    console.error("Error fetching remote file:", error);
    throw error;
  }
}

async function setup() {
  const environment = process.env.SYGMA_ENV;
  const configPath =
    environment === "testnet"
      ? `https://chainbridge-assets-stage.s3.us-east-2.amazonaws.com/shared-config-test.json`
      : `https://sygma-assets-mainnet.s3.us-east-2.amazonaws.com/shared-config-mainnet.json`;

  const sharedConfig = await fetchRemoteFile(configPath);

  sharedEVMDomainIDs = sharedConfig.domains
    .filter((domain: Domain) => domain.type === "evm")
    .map((domain: Domain) => domain.id);

  evmNetworks = sharedConfig.domains.filter(
    (domain: EthereumConfig) => domain.type === Network.EVM
  ) as Array<EthereumConfig>;
}

function extractUniqueNonFungibleResourceIds() {
  const uniqueFungibleResourceIds = new Set(
    evmNetworks.flatMap((network) =>
      network.resources
        .filter((resource) => resource.type === "permissionlessGeneric")
        .map((resource) => resource.resourceId)
    )
  );
  sharedEVMNonFungibleRessIDs = Array.from(uniqueFungibleResourceIds);
}

async function executeTransfer(params: TransferParams): Promise<string> {
  const valueToBeUpdated = generateUniqueValue();
  const overrides =
    params.sourceChainId === 80002 ? await getOverridesForPolygon() : {};

  const transfer = await createCrossChainContractCall<
    typeof sepoliaBaseStorageContract,
    "storeWithDepositor"
  >({
    gasLimit: BigInt(0),
    functionParameters: [
      params.sourceAddress,
      valueToBeUpdated,
      params.destinationAddress,
    ],
    functionName: "storeWithDepositor",
    destinationContractAbi: sepoliaBaseStorageContract,
    destinationContractAddress: contractAddresses[params.destinationChainId],
    maxFee: BigInt(MAX_FEE),
    source: params.sourceChainId,
    destination: params.destinationChainId,
    sourceNetworkProvider: params.web3Provider as unknown as Eip1193Provider,
    sourceAddress: params.sourceAddress,
    resource: params.resourceId,
    environment: sygmaEnv,
  });

  const transaction = await transfer.getTransferTransaction(overrides);
  const tx = await params.wallet.sendTransaction(transaction);
  await tx.wait();

  console.log(
    `Deposit on source chain, transaction: ${getTxExplorerUrl({
      txHash: tx.hash,
      chainId: params.sourceChainId,
    })}`
  );
  console.log(
    `Depositted, transaction: ${getSygmaScanLink(
      tx.hash,
      process.env.SYGMA_ENV as Environment
    )}`
  );

  return tx.hash;
}

export async function genericMessage(
  SOURCE_CHAIN_IDs: number[] = sharedEVMDomainIDs,
  RESOURCE_IDs: string[] = sharedEVMNonFungibleRessIDs,
  DESTINATION_CHAIN_IDs: number[] = sharedEVMDomainIDs
): Promise<void> {
  const transferReport: string[] = [];
  const wallet = new Wallet(privateKey ?? "");

  // Filter source networks based on provided IDs
  const sourceNetworks = evmNetworks.filter((n) =>
    SOURCE_CHAIN_IDs.includes(n.id)
  );

  for (const sourceNetwork of sourceNetworks) {
    // Filter eligible resources
    const eligibleResources = sourceNetwork.resources.filter(
      (r) =>
        RESOURCE_IDs.includes(r.resourceId) &&
        r.type === "permissionlessGeneric"
    );

    for (const sourceResource of eligibleResources) {
      const web3Provider = new Web3HttpProvider(
        process.env[`PROVIDER_URL_${sourceNetwork.chainId}`]
      );
      const ethersWeb3Provider = new providers.Web3Provider(web3Provider);
      const connectedWallet = wallet.connect(ethersWeb3Provider);
      const address = await connectedWallet.getAddress();

      // Filter eligible destination networks
      const destinationNetworks = evmNetworks.filter(
        (n) =>
          DESTINATION_CHAIN_IDs.includes(n.id) &&
          n.caipId !== sourceNetwork.caipId &&
          n.resources.some((r) => r.resourceId === sourceResource.resourceId)
      );

      for (const destNetwork of destinationNetworks) {
        console.log(
          `Transferring resourceID: ${sourceResource.resourceId} from Source ${sourceNetwork.chainId} to Destination ${destNetwork.chainId}`
        );

        try {
          await executeTransfer({
            sourceChainId: sourceNetwork.chainId,
            destinationChainId: destNetwork.chainId,
            resourceId: sourceResource.resourceId,
            sourceAddress: address,
            destinationAddress: address,
            web3Provider,
            wallet: connectedWallet,
          });

          transferReport.push(
            `Transfer from Source ${sourceNetwork.chainId} to Destination ${destNetwork.chainId} of Resource ID ${sourceResource.resourceId} - success`
          );
        } catch (error) {
          console.error(
            "Transfer failed:",
            error instanceof Error ? error.message : error
          );
          transferReport.push(
            `Transfer from Source ${sourceNetwork.chainId} to Destination ${destNetwork.chainId} of Resource ID ${sourceResource.resourceId} - FAILED`
          );
        }

        await wait(3500);
      }
    }
  }

  console.log("Transfer Report:");
  transferReport.forEach((report) => console.log(report));
}

(async () => {
  await setup();
  extractUniqueNonFungibleResourceIds();
  genericMessage();
})();
