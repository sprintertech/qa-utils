import {
  EvmResource,
  Environment,
  getSygmaScanLink,
  EthereumConfig,
  type Eip1193Provider,
} from "@buildwithsygma/core";
import {
  createFungibleAssetTransfer,
  FungibleTransferParams,
} from "@buildwithsygma/evm";
import { Wallet, ethers, providers } from "ethers";
import Web3HttpProvider from "web3-providers-http";
import {
  Contract,
  getContractAddress,
  getContractInterface,
} from "./contracts";
import { setupNetworkConfig, validateInputs } from "../shared/config";
import { wait, getTxExplorerUrl } from "../shared/utils";
import { TransferResult } from "../shared/types";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const sygmaEnv = process.env.SYGMA_ENV as Environment;
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

const MAX_FEE = "200000";

let sharedEVMDomainIDs: number[] = [];
let evmNetworks: Array<EthereumConfig> = [];

async function setup() {
  const config = await setupNetworkConfig();
  sharedEVMDomainIDs = config.sharedEVMDomainIDs;
  evmNetworks = config.evmNetworks;
}

let amount: bigint;
let contract: Contract;
let nativeValue: bigint;
let methodName: string;
let methodArguments: any[];

function generateUniqueValue(): `0x${string}` {
  return ethers.utils.hexlify(
    ethers.utils.formatBytes32String(Date.now().toString())
  ) as `0x${string}`;
}
const valueToBeUpdated = generateUniqueValue();

async function setGMPParameters(
  resourceID: string,
  address: string,
  destChainID: number
) {
  switch (resourceID) {
    case "0x0000000000000000000000000000000000000000000000000000000000001200":
      amount = BigInt(1) * BigInt(1e6);
      contract = "sprinterName";
      nativeValue = BigInt(0);
      methodName = "claimName";
      methodArguments = [`Test${Date.now()}`, address, 900000];
      break;

    case "0x1000000000000000000000000000000000000000000000000000000000000000":
      amount = BigInt(1) * BigInt(1e15);
      contract = "ERC721Payable";
      nativeValue =
        destChainID === 11155111
          ? BigInt(1) * BigInt(1e11)
          : BigInt(1) * BigInt(1e14);
      methodName = "mintPayable";
      methodArguments = [address, Date.now(), `Test${Date.now()}`];
      break;

    // Devnet only
    case "0x0000000000000000000000000000000000000000000000000000000000000200":
      amount = BigInt(1) * BigInt(1e16);
      contract = "storage";
      nativeValue = BigInt(0);
      methodName = "storeWithDepositor";
      methodArguments = [
        address as `0x${string}`,
        valueToBeUpdated,
        address as `0x${string}`,
      ];
      break;
  }
}

export async function erc20Transfer(
  SOURCE_IDs: number[] = [2, 10, 15],
  RESOURCE_IDs: string[] = [
    "0x0000000000000000000000000000000000000000000000000000000000001200",
    "0x1000000000000000000000000000000000000000000000000000000000000000",
  ],
  DESTINATION_IDs: number[] = [2, 10, 15]
): Promise<TransferResult[]> {
  const availableResourceIds = evmNetworks
    .flatMap((network) => network.resources)
    .map((resource) => resource.resourceId);

  validateInputs(
    SOURCE_IDs,
    DESTINATION_IDs,
    RESOURCE_IDs,
    sharedEVMDomainIDs,
    availableResourceIds
  );

  const transferResults: TransferResult[] = [];

  for (const network of evmNetworks) {
    if (SOURCE_IDs.includes(network.id)) {
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
              DESTINATION_IDs.includes(destNetwork.id)
            ) {
              for (const resource of destNetwork.resources) {
                if (sourceRessID === resource.resourceId) {
                  console.log(
                    `Transferring resourceID: ${resource.resourceId} from Source ${SourceChainID} to Destination ${destNetwork.chainId}`
                  );

                  await setGMPParameters(
                    resource.resourceId,
                    destinationAddress,
                    destNetwork.chainId
                  );
                  const targetContractAddress = getContractAddress(
                    destNetwork.chainId,
                    contract
                  );
                  const contractInterface = getContractInterface(contract);

                  const params: FungibleTransferParams = {
                    source: SourceChainID,
                    destination: destNetwork.chainId,
                    sourceNetworkProvider:
                      web3Provider as unknown as Eip1193Provider,
                    resource: resource.resourceId,
                    amount: amount,
                    recipientAddress: ethers.constants.AddressZero,
                    sourceAddress: sourceAddress,
                    optionalGas: BigInt(MAX_FEE),
                    optionalMessage: {
                      receiver: destinationAddress,
                      transactionId:
                        ethers.utils.formatBytes32String("EVM-ERC20+GENERIC"),
                      actions: [
                        {
                          approveTo: targetContractAddress,
                          tokenSend: (resource as EvmResource).address,
                          tokenReceive: ethers.constants.AddressZero,
                          nativeValue: nativeValue,
                          callTo: targetContractAddress,
                          data: contractInterface.encodeFunctionData(
                            methodName,
                            methodArguments
                          ),
                        },
                      ],
                    },
                    environment: sygmaEnv,
                  };
                  try {
                    const transfer = await createFungibleAssetTransfer(params);

                    const approvals = await transfer.getApprovalTransactions();
                    console.log(`Approving Tokens (${approvals.length})...`);
                    for (const approval of approvals) {
                      const response = await wallet.sendTransaction(approval);
                      await response.wait();
                      console.log(
                        `Approved, transaction: ${getTxExplorerUrl({
                          txHash: response.hash,
                          chainId: SourceChainID,
                        })}`
                      );
                    }

                    const transferTx = await transfer.getTransferTransaction();
                    const response = await wallet.sendTransaction(transferTx);
                    await response.wait();
                    console.log(
                      `Deposit on source chain, transaction: ${getTxExplorerUrl(
                        {
                          txHash: response.hash,
                          chainId: SourceChainID,
                        }
                      )}`
                    );
                    console.log(
                      `Depositted, transaction:  ${getSygmaScanLink(
                        response.hash,
                        process.env.SYGMA_ENV as Environment
                      )}`
                    );
                    transferResults.push({
                      success: true,
                      message: `Transfer successful`,
                      sourceChainId: SourceChainID,
                      destChainId: destNetwork.chainId,
                      resourceId: resource.resourceId,
                      txHash: response.hash,
                    });
                  } catch (transferError: unknown) {
                    let errorMessage = "Unknown error occurred";
                    if (transferError instanceof Error) {
                      errorMessage = transferError.message;
                      console.error(
                        `Error during transfer transaction: ${errorMessage}`
                      );
                    } else {
                      console.error(
                        `Unknown error occurred: ${JSON.stringify(
                          transferError
                        )}`
                      );
                    }
                    transferResults.push({
                      success: false,
                      message: `Transfer failed`,
                      sourceChainId: SourceChainID,
                      destChainId: destNetwork.chainId,
                      resourceId: resource.resourceId,
                    });
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
  transferResults.forEach((result) => {
    console.log(
      `${result.success ? "✓" : "✗"} Chain ${result.sourceChainId} -> ${
        result.destChainId
      } (${result.resourceId}): ${result.message}`
    );
    if (result.success && result.txHash) {
      console.log(
        `   Sygma Explorer: ${getSygmaScanLink(result.txHash, sygmaEnv)}`
      );
    }
  });
  return transferResults;
}

interface TransferLog {
  timestamp: string;
  transferReport: (TransferResult & { sygmaExplorerUrl?: string })[];
}

async function saveTransferLog(
  transferResults: TransferResult[]
): Promise<void> {
  const log: TransferLog = {
    timestamp: new Date().toISOString(),
    transferReport: transferResults.map((r) => ({
      ...r,
      sygmaExplorerUrl: r.txHash
        ? getSygmaScanLink(r.txHash, sygmaEnv)
        : undefined,
    })),
  };

  const reportDir = path.join(__dirname, "..", "reports");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const formattedDate = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .split("Z")[0];
  const filename = path.join(
    reportDir,
    `transfer-log-fungible_and_gmp_${formattedDate}.json`
  );
  fs.writeFileSync(filename, JSON.stringify(log, null, 2));
  console.log(`Transfer log saved to: ${filename}`);
}

(async () => {
  try {
    await setup();
    const transferResults = await erc20Transfer();
    await saveTransferLog(transferResults);
  } catch (error) {
    console.error("Error during execution:", error);
  }
})();
