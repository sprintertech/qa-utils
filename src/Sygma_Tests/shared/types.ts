import { EthereumConfig } from "@buildwithsygma/core";

export interface Domain {
  id: number;
  type: string;
}

export interface TransferResult {
  success: boolean;
  message?: string;
  sourceChainId: number;
  destChainId: number;
  resourceId: string;
  txHash?: string;
}

export interface NetworkConfig {
  sharedEVMDomainIDs: number[];
  evmNetworks: Array<EthereumConfig>;
} 