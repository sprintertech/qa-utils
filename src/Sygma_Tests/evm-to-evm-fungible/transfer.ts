import {
  Environment,
  EthereumConfig,
  Network,
  getSygmaScanLink,
  type Eip1193Provider,
} from "@buildwithsygma/core";
import {
  createFungibleAssetTransfer,
  FungibleTransferParams,
} from "@buildwithsygma/evm";
import { Wallet, providers, ethers } from "ethers";
import dotenv from "dotenv";
import Web3HttpProvider from "web3-providers-http";
import axios from "axios";

dotenv.config();

interface Domain {
  id: number;
  type: string;
}

interface Resource {
  type: string;
  resourceId: string;
  decimals?: number;
}

interface TransferResult {
  success: boolean;
  message: string;
  sourceChainId: number;
  destChainId: number;
  resourceId: string;
}

const testSourceDomainIDs: number[] = [2, 6, 11];
const testDestDomainIDs: number[] = [5, 6,10];
const testResourceIds: string[] = [
  "0x0000000000000000000000000000000000000000000000000000000000001100",
  "0x0000000000000000000000000000000000000000000000000000000000000300",
  "0x0000000000000000000000000000000000000000000000000000000000001200"
];

let sharedEVMDomainIDs: number[] = [];
let evmNetworks: Array<EthereumConfig> = [];
let sharedEVMFungibleRessIDs: string[] = [];

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const configPath = `https://chainbridge-assets-${environment === "testnet" ? "stage" : "mainnet"}.s3.us-east-2.amazonaws.com/shared-config-${environment === "testnet" ? "test" : "mainnet"}.json`;

  const sharedConfig = await fetchRemoteFile(configPath);
  
  sharedEVMDomainIDs = sharedConfig.domains
    .filter((domain: Domain) => domain.type === "evm")
    .map((domain: Domain) => domain.id);

  evmNetworks = sharedConfig.domains.filter(
    (domain: EthereumConfig) => domain.type === Network.EVM
  ) as Array<EthereumConfig>;
}

function extractUniqueFungibleResourceIds() {
  const uniqueFungibleResourceIds = new Set(
    evmNetworks.flatMap((network) =>
      network.resources
        .filter((resource) => resource.type === "fungible")
        .map((resource) => resource.resourceId)
    )
  );
  sharedEVMFungibleRessIDs = Array.from(uniqueFungibleResourceIds);
}

async function processTransfer({
  sourceNetwork,
  destNetwork,
  resource,
  wallet,
  sourceAddress,
  web3Provider
}: {
  sourceNetwork: EthereumConfig;
  destNetwork: EthereumConfig;
  resource: Resource;
  wallet: Wallet;
  sourceAddress: string;
  web3Provider: Web3HttpProvider;
}): Promise<TransferResult> {
  const amountDecimals = (resource.decimals as number) - 1;

  console.log(
    `Transferring resourceID: ${resource.resourceId} from Source ${sourceNetwork.chainId} to Destination ${destNetwork.chainId}`
  );
  const overrides =
    sourceNetwork.chainId === 80002
      ? await getOverridesForPolygon()
      : {};

  const params: FungibleTransferParams = {
    source: sourceNetwork.caipId,
    destination: destNetwork.caipId,
    sourceNetworkProvider:
      web3Provider as unknown as Eip1193Provider,
    resource: resource.resourceId,
    amount: BigInt(1) * BigInt(10 ** amountDecimals),
    recipientAddress: sourceAddress,
    sourceAddress: sourceAddress,
    environment: process.env.SYGMA_ENV as Environment,
  };
  try {
    const transfer = await createFungibleAssetTransfer(params);
    const approvals = await transfer.getApprovalTransactions(
      overrides
    );
    console.log(`Approving Tokens (${approvals.length})...`);

    for (const approval of approvals) {
      try {
        const response = await wallet.sendTransaction(approval);
        await response.wait();
        console.log(
          `Approved, transaction: ${getTxExplorerUrl({
            txHash: response.hash,
            chainId: sourceNetwork.chainId,
          })}`
        );
      } catch (approvalError) {
        if (approvalError instanceof Error) {
          console.error(
            `Error during transfer transaction: ${approvalError.message}`
          );
        } else {
          console.error(
            `Unknown error occurred: ${JSON.stringify(
              approvalError
            )}`
          );
        }
        return {
          success: false,
          message: `Transfer from Source ${sourceNetwork.chainId} to Destination ${destNetwork.chainId} of Resource ID ${resource.resourceId} - FAILED`,
          sourceChainId: sourceNetwork.chainId,
          destChainId: destNetwork.chainId,
          resourceId: resource.resourceId,
        };
      }
    }
    const transferTx = await transfer.getTransferTransaction(
      overrides
    );
    const response = await wallet.sendTransaction(transferTx);
    await response.wait();
    console.log(
      `Depositted, transaction:  ${getSygmaScanLink(
        response.hash,
        process.env.SYGMA_ENV as Environment
      )}`
    );
    return {
      success: true,
      message: `Transfer from Source ${sourceNetwork.chainId} to Destination ${destNetwork.chainId} of Resource ID ${resource.resourceId} - success`,
      sourceChainId: sourceNetwork.chainId,
      destChainId: destNetwork.chainId,
      resourceId: resource.resourceId,
    };
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
    return {
      success: false,
      message: `Transfer from Source ${sourceNetwork.chainId} to Destination ${destNetwork.chainId} of Resource ID ${resource.resourceId} - FAILED`,
      sourceChainId: sourceNetwork.chainId,
      destChainId: destNetwork.chainId,
      resourceId: resource.resourceId,
    };
  }
}

export async function erc20Transfer(
  SOURCE_CHAIN_IDs: number[] = sharedEVMDomainIDs,
  RESOURCE_IDs: string[] = sharedEVMFungibleRessIDs,
  DESTINATION_CHAIN_IDs: number[] = sharedEVMDomainIDs
): Promise<TransferResult[]> {
  const transferResults: TransferResult[] = [];
  const wallet = new Wallet(privateKey ?? "");

  for (const sourceNetwork of evmNetworks.filter(n => SOURCE_CHAIN_IDs.includes(n.id))) {
    const eligibleResources = sourceNetwork.resources.filter(r => 
      RESOURCE_IDs.includes(r.resourceId) && r.type === "fungible"
    );

    for (const resource of eligibleResources) {
      const web3Provider = new Web3HttpProvider(
        process.env[`PROVIDER_URL_${sourceNetwork.chainId}`]
      );
      const ethersWeb3Provider = new providers.Web3Provider(web3Provider);
      const connectedWallet = wallet.connect(ethersWeb3Provider);
      
      const sourceAddress = await connectedWallet.getAddress();
      
      // Process transfers for eligible destination networks
      const destinationNetworks = evmNetworks.filter(n => 
        DESTINATION_CHAIN_IDs.includes(n.id) && 
        n.caipId !== sourceNetwork.caipId &&
        n.resources.some(r => r.resourceId === resource.resourceId && r.type === "fungible")
      );

      for (const destNetwork of destinationNetworks) {
        const result = await processTransfer({
          sourceNetwork,
          destNetwork,
          resource,
          wallet: connectedWallet,
          sourceAddress,
          web3Provider
        });
        
        transferResults.push(result);
        await wait(3500);
      }
    }
  }

  // Log results
  console.log("Transfer Report:");
  transferResults.forEach(result => 
    console.log(`${result.message} - ${result.success ? "success" : "FAILED"}`)
  );

  return transferResults;
}

// Main Execution
(async () => {
  await setup();
  extractUniqueFungibleResourceIds();
  erc20Transfer(testSourceDomainIDs, testResourceIds, undefined);
})();
