import { ethers } from 'ethers';
import liquidityPoolABI from '../../../ABIS/liquidityPool.json';
import dotenv from "dotenv";

dotenv.config();


interface BorrowParams {
  borrowToken: string;
  amount: string | number;
  target: string;
  targetCallData: string;
  nonce: number;
  deadline: number;
  signature: string;
  contractAddress: string;
  networkRPC: string;
  walletPrivateKey: string;
}

export async function executeBorrow({
  borrowToken,
  amount,
  target,
  targetCallData,
  nonce,
  deadline,
  signature,
  contractAddress,
  networkRPC,
  walletPrivateKey,
}: BorrowParams): Promise<ethers.ContractTransaction> {
  try {
    // Create provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(networkRPC);
    const wallet = new ethers.Wallet(walletPrivateKey, provider);

    // Create contract instance
    const contract = new ethers.Contract(
      contractAddress,
      liquidityPoolABI,
      wallet
    );

    // Set manual gas settings to force the transaction
    const overrides = {
      gasLimit: 500000, // Manual gas limit
      gasPrice: (await provider.getGasPrice()).mul(120).div(100), // 20% higher than current gas price
    };

    // Execute borrow transaction with overrides
    const tx = await contract.borrow(
      borrowToken,
      amount,
      target,
      targetCallData,
      nonce,
      deadline,
      signature,
      overrides
    );

    return tx;
  } catch (error) {
    console.error('Error executing borrow:', error);
    throw error;
  }
}


async function borrow() {
  const borrowParams: BorrowParams = {
    borrowToken: "0x4200000000000000000000000000000000000006",
    amount: "50000000000000000",
    target: "0x4200000000000000000000000000000000000006",
    targetCallData: "0xa9059cbb000000000000000000000000c731bac6c62ecb49dba1393700218d03beaa035900000000000000000000000000000000000000000000000000b1a2bc2ec50000",
    nonce: 1739369001825,
    deadline: 2000000000,
    signature: "0x37082706d55f153f7728e58354f86d3c857c028c9eececafce935c015aad3fce28068b22dedcc7d88d6dd0cd239de41c8bd598402444323b6bbf0ba7e0fd453c1c",
    contractAddress: "0xB44aEaB4843094Dd086c26dD6ce284c417436Deb", // Add your contract address here
    networkRPC: process.env.PROVIDER_URL_84532 || "",
    walletPrivateKey: process.env.PRIVATE_KEY || "",
  };

  try {
    const tx = await executeBorrow(borrowParams);
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
  } catch (error) {
    console.error("Transaction failed:", error);
  }
}


borrow();
