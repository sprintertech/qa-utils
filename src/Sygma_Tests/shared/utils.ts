import axios from "axios";
import { ethers } from "ethers";

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getTxExplorerUrl = ({
  txHash,
  chainId,
}: {
  txHash: string;
  chainId: number;
}) => process.env[`SCAN_URL_${chainId}`] + `/tx/${txHash}`;

export async function getOverridesForPolygon() {
  try {
    const gasResponse = await fetch("https://gasstation.polygon.technology/amoy");
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

export async function fetchRemoteFile(path: string) {
  try {
    const { data } = await axios.get(path);
    return data;
  } catch (error) {
    console.error("Error fetching remote file:", error);
    throw error;
  }
}

export function parseArrayArg(value: string): string[] | number[] {
  if (!value) return [];
  const arr = value.split(',').map(item => item.trim());
  
  if (arr.some(item => item.startsWith('0x'))) {
    return arr;
  }
  
  if (arr.every(item => !isNaN(Number(item)))) {
    return arr.map(Number);
  }
  return arr;
} 