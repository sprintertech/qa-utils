import {
  type Eip1193Provider,
  Environment,
  EthereumConfig
} from "@buildwithsygma/core";
import { getSygmaScanLink } from "@buildwithsygma/core";
import { createCrossChainContractCall } from "@buildwithsygma/evm";
import dotenv from "dotenv";
import { Wallet, ethers, providers } from "ethers";
import Web3HttpProvider from "web3-providers-http";
import { sepoliaBaseStorageContract } from "./contracts/storage_contract";
import { TransferResult, Domain } from "../shared/types";
import { Command } from 'commander';
import { parseArrayArg, wait, getTxExplorerUrl, getOverridesForPolygon, fetchRemoteFile } from "../shared/utils";
import { setupNetworkConfig, validateInputs } from "../shared/config";
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

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

const MAX_FEE = "250000";
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

interface TransferLog {
  timestamp: string;
  options: {
    sourceChains: number[] | string;
    destinationChains: number[] | string;
  };
  transferReport: (TransferResult & { sygmaExplorerUrl?: string })[];
}

function generateUniqueValue(): `0x${string}` {
  return ethers.utils.hexlify(
    ethers.utils.formatBytes32String(Date.now().toString())
  ) as `0x${string}`;
}

async function setup() {
  const config = await setupNetworkConfig();
  sharedEVMDomainIDs = config.sharedEVMDomainIDs;
  evmNetworks = config.evmNetworks;
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
  console.log(`Value to be updated: ${valueToBeUpdated}`);
  const overrides =
    params.sourceChainId === 80002 ? await getOverridesForPolygon() : {};

  const transfer = await createCrossChainContractCall<
    typeof sepoliaBaseStorageContract,
    "storeWithDepositor"
  >({
    gasLimit: BigInt(0),
    functionParameters: [
      params.sourceAddress as `0x${string}`,
      valueToBeUpdated,
      params.destinationAddress as `0x${string}`,
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
  SOURCE_IDs: number[] = sharedEVMDomainIDs,
  RESOURCE_IDs: string[] = sharedEVMNonFungibleRessIDs,
  DESTINATION_IDs: number[] = sharedEVMDomainIDs
): Promise<TransferResult[]> {
  validateInputs(
    SOURCE_IDs, 
    DESTINATION_IDs, 
    RESOURCE_IDs, 
    sharedEVMDomainIDs, 
    sharedEVMNonFungibleRessIDs
  );

  const transferReport: TransferResult[] = [];
  const wallet = new Wallet(privateKey ?? "");

  // Filter source networks based on provided IDs
  const sourceNetworks = evmNetworks.filter((n) =>
    SOURCE_IDs.includes(n.id)
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
          DESTINATION_IDs.includes(n.id) &&
          n.caipId !== sourceNetwork.caipId &&
          n.resources.some((r) => r.resourceId === sourceResource.resourceId)
      );

      for (const destNetwork of destinationNetworks) {
        console.log(
          `Transferring resourceID: ${sourceResource.resourceId} from Source ${sourceNetwork.chainId} to Destination ${destNetwork.chainId}`
        );

        try {
          const txHash = await executeTransfer({
            sourceChainId: sourceNetwork.chainId,
            destinationChainId: destNetwork.chainId,
            resourceId: sourceResource.resourceId,
            sourceAddress: address,
            destinationAddress: address,
            web3Provider,
            wallet: connectedWallet,
          });

          transferReport.push({
            sourceChainId: sourceNetwork.chainId,
            destChainId: destNetwork.chainId,
            resourceId: sourceResource.resourceId,
            success: true,
            txHash
          } as TransferResult);
        } catch (error) {
          console.error(
            "Deposit failed:",
            error instanceof Error ? error.message : error
          );
          transferReport.push({
            sourceChainId: sourceNetwork.chainId,
            destChainId: destNetwork.chainId,
            resourceId: sourceResource.resourceId,
            success: false
          } as TransferResult);
        }

        await wait(3500);
      }
    }
  }

  console.log("\nTransfer Report:");
  transferReport.forEach(result => {
    const symbol = result.success ? "✓" : "✗";
    const message = `${symbol} Chain ${result.sourceChainId} -> ${result.destChainId} (${result.resourceId}): ${
      result.success ? "Deposit successful" : "Deposit failed"
    }`;
    console.log(message);
    if (result.success && result.txHash) {
      console.log(`   Sygma Explorer: ${getSygmaScanLink(result.txHash, sygmaEnv)}`);
    }
  });

  return transferReport;
}

async function saveTransferLog(
  options: { source?: number[], destination?: number[] },
  transferReport: TransferResult[]
): Promise<void> {
  const log: TransferLog = {
    timestamp: new Date().toISOString(),
    options: {
      sourceChains: options.source || 'default',
      destinationChains: options.destination || 'default'
    },
    transferReport: transferReport.map(r => ({
      ...r,
      sygmaExplorerUrl: r.txHash ? getSygmaScanLink(r.txHash, sygmaEnv) : undefined
    }))
  };

  const reportDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const formattedDate = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const filename = path.join(reportDir, `transfer-log-gmp_${formattedDate}.json`);
  fs.writeFileSync(filename, JSON.stringify(log, null, 2));
  console.log(`Transfer log saved to: ${filename}`);
}

if (require.main === module) {
  const program = new Command();

  program
    .option('-s, --source <ids>', 'Source chain IDs (comma-separated)', parseArrayArg)
    .option('-d, --destination <ids>', 'Destination chain IDs (comma-separated)', parseArrayArg)
    .parse(process.argv);

  const options = program.opts();

  (async () => {
    try {
      console.log('Starting setup...');
      await setup();
      console.log('Setup complete');
      
      console.log('Extracting resource IDs...');
      extractUniqueNonFungibleResourceIds();
      console.log('Resource IDs extracted.');
      
      console.log('Starting transfer with options:', {
        sourceChains: options.source || 'default',
        destinationChains: options.destination || 'default'
      });
      
      const transferReport = await genericMessage(
        options.source || undefined,
        testResourceIds,
        options.destination || undefined
      );

      await saveTransferLog(options, transferReport);
    } catch (error) {
      console.error('Error during execution:', error);
    }
  })();
}
