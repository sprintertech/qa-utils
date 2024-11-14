import {
  Config,
  Network,
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
import dotenv from "dotenv";
import { Wallet, ethers, providers } from "ethers";
import Web3HttpProvider from "web3-providers-http";
import { getContractAddress, getContractInterface } from "./contracts";
import axios from "axios";

dotenv.config();

interface Domain {
  id: number;
  type: string;
}

type Contract = "sprinterName" | "storage" | "ERC721Payable";

const sygmaEnv = process.env.SYGMA_ENV as Environment;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

const MAX_FEE = "450000";
const testSourceDomainIDs: number[] = [2];
const testDestDomainIDs: number[] = [10];
const testResourceIds: string[] = [
  "0x0000000000000000000000000000000000000000000000000000000000001200",
];

let sharedEVMDomainIDs: number[] = [];
let evmNetworks: Array<EthereumConfig> = [];
let sharedEVMNonFungibleRessIDs: string[] = [];

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
  try {
    const environment = process.env.SYGMA_ENV;
    const defaultPath = 'https://chainbridge-assets-stage.s3.us-east-2.amazonaws.com/shared-config-test.json';
    const configPath = {
      devnet: 'https://chainbridge-assets-stage.s3.us-east-2.amazonaws.com/balance-config-dev.json',
      testnet: 'https://chainbridge-assets-stage.s3.us-east-2.amazonaws.com/shared-config-test.json',
      mainnet: 'https://sygma-assets-mainnet.s3.us-east-2.amazonaws.com/shared-config-mainnet.json'
    }[environment as string] || defaultPath;

    const sharedConfig = await fetchRemoteFile(configPath);
    
    // Validate config structure
    if (!sharedConfig || !sharedConfig.domains) {
      throw new Error(`Invalid config received from ${configPath}. Config: ${JSON.stringify(sharedConfig)}`);
    }

    sharedEVMDomainIDs = sharedConfig.domains
      .filter((domain: Domain) => domain.type === "evm")
      .map((domain: Domain) => domain.id);

    evmNetworks = sharedConfig.domains.filter(
      (domain: EthereumConfig) => domain.type === Network.EVM
    ) as Array<EthereumConfig>;

    // Validate results
    if (sharedEVMDomainIDs.length === 0) {
      throw new Error('No EVM domains found in config');
    }
    if (evmNetworks.length === 0) {
      throw new Error('No EVM networks found in config');
    }
  } catch (error) {
    console.error('Setup failed:', error);
    throw error; // Re-throw to ensure calling code knows setup failed
  }
}

const getTxExplorerUrl = ({
  txHash,
  chainId,
}: {
  txHash: string;
  chainId: number;
}) => process.env[`SCAN_URL_${chainId}`] + `/tx/${txHash}`;

let amount: bigint;
let contract: Contract;
let nativeValue: bigint;
let methodName: string;
let methodArguments: any[];

async function setGMPParameters(
  resourceID: string,
  address: string,
  destChainID: number
) {
  if (
    resourceID ===
    "0x0000000000000000000000000000000000000000000000000000000000001200"
  ) {
    amount = BigInt(1) * BigInt(1e6);
    contract = "sprinterName";
    nativeValue = BigInt(0);
    methodName = "claimName";
    methodArguments = [`Test${Date.now()}`, address, 900000];
  } else if (
    resourceID ===
    "0x1000000000000000000000000000000000000000000000000000000000000000"
  ) {
    amount = BigInt(1) * BigInt(1e15);
    contract = "ERC721Payable";
    nativeValue =
      destChainID === 11155111
        ? BigInt(1) * BigInt(1e11)
        : BigInt(1) * BigInt(1e14);
    methodName = "mintPayable";
    methodArguments = [address, Date.now(), `Test${Date.now()}`];
  }
}

export async function erc20Transfer(
  SOURCE_IDs: number[] = [2, 10, 15],
  RESOURCE_IDs: string[] = [
    "0x0000000000000000000000000000000000000000000000000000000000001200",
    "0x1000000000000000000000000000000000000000000000000000000000000000",
  ],
  DESTINATION_IDs: number[] = [2, 10, 15]
): Promise<void> {
  let transferReport: string[] = [];

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
                    optionalGas: BigInt(300_000),
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
                    environment: sygmaEnv
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
  erc20Transfer();
})();
