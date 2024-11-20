import { EthereumConfig, Network } from "@buildwithsygma/core";
import { Domain, NetworkConfig } from "./types";
import { fetchRemoteFile } from "./utils";

export async function setupNetworkConfig(): Promise<NetworkConfig> {
  const environment = process.env.SYGMA_ENV;
  const defaultPath =
    "https://chainbridge-assets-stage.s3.us-east-2.amazonaws.com/shared-config-test.json";
  const configPath =
    {
      devnet:
        "https://chainbridge-assets-stage.s3.us-east-2.amazonaws.com/balance-config-dev.json",
      testnet:
        "https://chainbridge-assets-stage.s3.us-east-2.amazonaws.com/shared-config-test.json",
      mainnet:
        "https://sygma-assets-mainnet.s3.us-east-2.amazonaws.com/shared-config-mainnet.json",
    }[environment as string] || defaultPath;

  try {
    const sharedConfig = await fetchRemoteFile(configPath);

    if (!sharedConfig || !sharedConfig.domains) {
      throw new Error(
        `Invalid config received from ${configPath}. Config: ${JSON.stringify(
          sharedConfig
        )}`
      );
    }

    const sharedEVMDomainIDs = sharedConfig.domains
      .filter((domain: Domain) => domain.type === "evm")
      .map((domain: Domain) => domain.id);

    const evmNetworks = sharedConfig.domains.filter(
      (domain: EthereumConfig) => domain.type === Network.EVM
    ) as Array<EthereumConfig>;

    if (sharedEVMDomainIDs.length === 0) {
      throw new Error("No EVM domains found in config");
    }
    if (evmNetworks.length === 0) {
      throw new Error("No EVM networks found in config");
    }

    return { sharedEVMDomainIDs, evmNetworks };
  } catch (error) {
    console.error("Setup failed:", error);
    throw error;
  }
}

export function validateInputs(
  sourceIds: number[],
  destIds: number[],
  resourceIds: string[],
  sharedEVMDomainIDs: number[],
  availableResourceIds: string[]
): void {
  const invalidSourceIds = sourceIds.filter(
    (id) => !sharedEVMDomainIDs.includes(id)
  );
  if (invalidSourceIds.length > 0) {
    console.warn(
      `Warning: Invalid source IDs provided: ${invalidSourceIds.join(", ")}`
    );
    console.log(`Available source IDs: ${sharedEVMDomainIDs.join(", ")}`);
  }

  const invalidDestIds = destIds.filter(
    (id) => !sharedEVMDomainIDs.includes(id)
  );
  if (invalidDestIds.length > 0) {
    console.warn(
      `Warning: Invalid destination IDs provided: ${invalidDestIds.join(", ")}`
    );
    console.log(`Available destination IDs: ${sharedEVMDomainIDs.join(", ")}`);
  }

  const invalidResourceIds = resourceIds.filter(
    (id) => !availableResourceIds.includes(id)
  );
  if (invalidResourceIds.length > 0) {
    console.warn(
      `Warning: Invalid resource IDs provided: ${invalidResourceIds.join(", ")}`
    );
    console.log("Available resource IDs:", availableResourceIds);
  }
}
