import {
  Environment,
  EthereumConfig,
  Resource,
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
import { Command } from 'commander';
import { TransferResult, NetworkConfig } from "../shared/types";
import { setupNetworkConfig, validateInputs } from "../shared/config";
import { wait, getTxExplorerUrl, getOverridesForPolygon, parseArrayArg } from "../shared/utils";
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

let networkConfig: NetworkConfig;
let sharedEVMFungibleRessIDs: string[] = [];

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

async function setup() {
  try {
    networkConfig = await setupNetworkConfig();
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  }
}

function extractUniqueFungibleResourceIds() {
  const uniqueFungibleResourceIds = new Set(
    networkConfig.evmNetworks.flatMap((network) =>
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
  web3Provider,
  amount
}: {
  sourceNetwork: EthereumConfig;
  destNetwork: EthereumConfig;
  resource: Resource;
  wallet: Wallet;
  sourceAddress: string;
  web3Provider: Web3HttpProvider;
  amount?: bigint;
}): Promise<TransferResult> {
  const amountDecimals = (resource.decimals as number) - 1;
  const transferAmount = amount ?? (BigInt(1) * BigInt(10 ** amountDecimals));
  console.log(`Transfer amount from command: ${amount}`);
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
    amount: transferAmount,
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
      `Deposit on source chain, transaction: ${getTxExplorerUrl({
        txHash: response.hash,
        chainId: sourceNetwork.chainId,
      })}`
    );
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
      txHash: response.hash
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
  SOURCE_IDs: number[] = networkConfig.sharedEVMDomainIDs,
  RESOURCE_IDs: string[] = sharedEVMFungibleRessIDs,
  DESTINATION_IDs: number[] = networkConfig.sharedEVMDomainIDs,
  amount?: string
): Promise<TransferResult[]> {
  validateInputs(SOURCE_IDs, DESTINATION_IDs, RESOURCE_IDs, networkConfig.sharedEVMDomainIDs, sharedEVMFungibleRessIDs);

  const transferAmount = amount ? BigInt(amount) : undefined;
  const transferResults: TransferResult[] = [];
  const wallet = new Wallet(privateKey ?? "");

  for (const sourceNetwork of networkConfig.evmNetworks.filter(n => SOURCE_IDs.includes(n.id))) {
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
      const destinationNetworks = networkConfig.evmNetworks.filter(n => 
        DESTINATION_IDs.includes(n.id) && 
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
          web3Provider,
          amount: transferAmount
        });
        
        transferResults.push(result);
        await wait(3500);
      }
    }
  }

  console.log("Transfer Report:");
  transferResults.forEach(result => {
    const symbol = result.success ? "✓" : "✗";
    const message = `${symbol} Chain ${result.sourceChainId} -> ${result.destChainId} (${result.resourceId}): ${
      result.success ? "Deposit successful" : "Deposit failed"
    }`;
    console.log(message);
    if (result.success && result.txHash) {
      console.log(`   Sygma Explorer: ${getSygmaScanLink(result.txHash, process.env.SYGMA_ENV as Environment)}`);
    }
  });

  return transferResults;
}

interface TransferLog {
  timestamp: string;
  options: {
    sourceChains: number[] | string;
    destinationChains: number[] | string;
    resources: string[] | string;
  };
  transferReport: Array<{
    success: boolean;
    sourceChainId: number;
    destChainId: number;
    resourceId: string;
    sygmaExplorerUrl?: string;
  }>;
}

async function saveTransferLog(
  options: { source?: number[], destination?: number[], resources?: string[] },
  transferResults: TransferResult[]
): Promise<void> {
  const log: TransferLog = {
    timestamp: new Date().toISOString(),
    options: {
      sourceChains: options.source || 'default',
      destinationChains: options.destination || 'default',
      resources: options.resources || 'default'
    },
    transferReport: transferResults.map(r => ({
      success: r.success,
      sourceChainId: r.sourceChainId,
      destChainId: r.destChainId,
      resourceId: r.resourceId,
      sygmaExplorerUrl: r.txHash ? getSygmaScanLink(r.txHash, process.env.SYGMA_ENV as Environment) : undefined
    }))
  };

  const reportDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const formattedDate = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const filename = path.join(reportDir, `transfer-log-fungible_${formattedDate}.json`);
  fs.writeFileSync(filename, JSON.stringify(log, null, 2));
  console.log(`Transfer log saved to: ${filename}`);
}

if (require.main === module) {
  const program = new Command();

  program
    .option('-s, --source <ids>', 'Source chain IDs (comma-separated)', parseArrayArg)
    .option('-d, --destination <ids>', 'Destination chain IDs (comma-separated)', parseArrayArg)
    .option('-r, --resources <ids>', 'Resource IDs (comma-separated)', parseArrayArg)
    .option('-a, --amount <value>', 'Amount to transfer (with decimals)')
    .parse(process.argv);

  const options = program.opts();

  (async () => {
    try {
      console.log('Starting setup...');
      await setup();
      console.log('Setup complete');
      
      console.log('Extracting resource IDs...');
      extractUniqueFungibleResourceIds();
      console.log('Resource IDs extracted.');
      
      console.log('Starting transfer with options:', {
        sourceChains: options.source || 'default',
        resources: options.resources || 'default',
        destinationChains: options.destination || 'default',
        amount: options.amount || 'default'
      });
      
      const transferResults = await erc20Transfer(
        options.source || undefined,
        options.resources || undefined,
        options.destination || undefined,
        options.amount
      );

      await saveTransferLog(options, transferResults);
    } catch (error) {
      console.error('Error during execution:', error);
    }
  })();
}
