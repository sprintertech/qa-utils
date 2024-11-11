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

const testSourceDomainIDs: number[] = [6, 11];
const testDestDomainIDs: number[] = [10];
const testResourceIds: string[] = [
  "0x0000000000000000000000000000000000000000000000000000000000001100",
];
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let sharedEVMDomainIDs: number[] = [];
let evmNetworks: Array<EthereumConfig> = [];
let sharedEVMFungibleRessIDs: string[] = [];

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

const getTxExplorerUrl = ({
  txHash,
  chainId,
}: {
  txHash: string;
  chainId: number;
}) => process.env[`SCAN_URL_${chainId}`] + `/tx/${txHash}`;

export async function erc20Transfer(
  SOURCE_CHAIN_IDs: number[] = sharedEVMDomainIDs,
  RESOURCE_IDs: string[] = sharedEVMFungibleRessIDs,
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
          const amountDecimals = (resouce.decimals as number) - 1;
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
                  const overrides =
                    SourceChainID === 80002
                      ? await getOverridesForPolygon()
                      : {};

                  const params: FungibleTransferParams = {
                    source: SourceCapID,
                    destination: destNetwork.caipId,
                    sourceNetworkProvider:
                      web3Provider as unknown as Eip1193Provider,
                    resource: resource.resourceId,
                    amount: BigInt(1) * BigInt(10 ** amountDecimals),
                    recipientAddress: destinationAddress,
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
                            chainId: SourceChainID,
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
                        continue;
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
  extractUniqueFungibleResourceIds();
  erc20Transfer(testSourceDomainIDs, undefined, undefined);
})();
