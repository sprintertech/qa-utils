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
const testSourceDomainIDs: number[] = [8];
const testDestDomainIDs: number[] = [10];
const testResourceIds: string[] = [
  "0x0000000000000000000000000000000000000000000000000000000000000600",
];
const sygmaEnv = process.env.SYGMA_ENV as Environment;
const privateKey = process.env.PRIVATE_KEY;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

let sharedEVMDomainIDs: number[] = [];
let evmNetworks: Array<EthereumConfig> = [];
let sharedEVMNonFungibleRessIDs: string[] = [];

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

const getTxExplorerUrl = ({
  txHash,
  chainId,
}: {
  txHash: string;
  chainId: number;
}) => process.env[`SCAN_URL_${chainId}`] + `/tx/${txHash}`;

function generateUniqueValue() {
  return ethers.utils.hexlify(
    ethers.utils.formatBytes32String(Date.now().toString())
  );
}

export async function genericMessage(
  SOURCE_CHAIN_IDs: number[] = sharedEVMDomainIDs,
  RESOURCE_IDs: string[] = sharedEVMNonFungibleRessIDs,
  DESTINATION_CHAIN_IDs: number[] = sharedEVMDomainIDs
): Promise<void> {
  let transferReport: string[] = [];

  for (const network of evmNetworks) {
    if (SOURCE_CHAIN_IDs.includes(network.id)) {
      for (const resouce of network.resources) {
        if (RESOURCE_IDs.includes(resouce.resourceId)) {
          const sourceRessID = resouce.resourceId;
          const SourceCapID = network.caipId;
          const SourceChainID = network.chainId;
          const web3Provider = new Web3HttpProvider(
            process.env[`PROVIDER_URL_${SourceChainID}`]
          );
          const ethersWeb3Provider = new providers.Web3Provider(web3Provider);
          const wallet = new Wallet(privateKey ?? "", ethersWeb3Provider);
          const sourceAddress = await wallet.getAddress();
          const destinationAddress = await wallet.getAddress();

          for (let destNetwork of evmNetworks) {
            if (
              SourceCapID !== destNetwork.caipId &&
              DESTINATION_CHAIN_IDs.includes(destNetwork.id)
            ) {
              for (const resource of destNetwork.resources) {
                if (sourceRessID === resource.resourceId) {
                  console.log(
                    `Transferring resourceID: ${resource.resourceId} from Source ${SourceChainID} to Destination ${destNetwork.chainId}`
                  );

                  const valueToBeUpdated = generateUniqueValue();
                  const overrides =
                    SourceChainID === 80002
                      ? await getOverridesForPolygon()
                      : {};

                  try {
                    const transfer = await createCrossChainContractCall<
                      typeof sepoliaBaseStorageContract,
                      "storeWithDepositor"
                    >({
                      gasLimit: BigInt(0),
                      functionParameters: [
                        sourceAddress,
                        valueToBeUpdated,
                        destinationAddress,
                      ],
                      functionName: "storeWithDepositor",
                      destinationContractAbi: sepoliaBaseStorageContract,
                      destinationContractAddress:
                        contractAddresses[destNetwork.chainId],
                      maxFee: BigInt(MAX_FEE),
                      source: SourceChainID,
                      destination: destNetwork.chainId,
                      sourceNetworkProvider:
                        web3Provider as unknown as Eip1193Provider,
                      sourceAddress: sourceAddress,
                      resource: resource.resourceId,
                      environment: sygmaEnv,
                    });

                    const transaction = await transfer.getTransferTransaction(
                      overrides
                    );
                    const tx = await wallet.sendTransaction(transaction);
                    await tx.wait();
                    console.log(
                      `Deposit on source chain, transaction: ${getTxExplorerUrl(
                        {
                          txHash: tx.hash,
                          chainId: SourceChainID,
                        }
                      )}`
                    );
                    console.log(
                      `Depositted, transaction:  ${getSygmaScanLink(
                        tx.hash,
                        process.env.SYGMA_ENV as Environment
                      )}`
                    );
                    transferReport.push(
                      `Transfer from Source ${SourceChainID} to Destination ${destNetwork.chainId} of Resource ID ${resource.resourceId} - success`
                    );
                  } catch (transferError) {
                    if (transferError instanceof Error) {
                      console.error(
                        `Error during transfer transaction: ${transferError.message}`
                      );
                    } else {
                      console.error(
                        `Unknown error occurred: ${JSON.stringify(
                          transferError
                        )}`
                      );
                    }
                    transferReport.push(
                      `Transfer from Source ${SourceChainID} to Destination ${destNetwork.chainId} of Resource ID ${resource.resourceId} - FAILED`
                    );
                    continue;
                  }
                  await wait(3500);
                }
              }
            }
          }
        }
      }
    }
  }
  console.log("Transfer Report:");
  transferReport.forEach((report) => console.log(report));
}

(async () => {
  await setup();
  extractUniqueNonFungibleResourceIds();
  genericMessage(testSourceDomainIDs, undefined, undefined);
})();
