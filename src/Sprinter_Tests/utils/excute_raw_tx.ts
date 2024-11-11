import { ethers } from "ethers";
const fs = require("fs");
// require("dotenv").config({ path: "src/utils/RawTX/.env" });

export async function sendSignedTransactionWithRawData(
  to: string,
  value: string,
  data: string,
  providerURL: string,
  privateKey: string,
  chainId: number
) {
  const provider = new ethers.providers.JsonRpcProvider(
    providerURL
  );
  const wallet = new ethers.Wallet(privateKey as string, provider);

  const valueInWei = ethers.BigNumber.from(value);
  const gasPrice = await provider.getGasPrice();
  const newGasPrice = gasPrice.mul(15).div(10);
  const gasLimit = ethers.utils.hexlify(500000);
  const nonce = await provider.getTransactionCount(wallet.address);

  const tx = {
    to,
    value: valueInWei,
    data,
    gasPrice: newGasPrice,
    gasLimit,
    nonce,
    chainId: chainId,
  };

  console.log("Sending Raw Transaction:", tx);
  try {
    const signedTx = await wallet.signTransaction(tx);
    const txResponse = await provider.sendTransaction(signedTx);
    console.log(`Transaction sent: ${txResponse.hash}`);
    const receipt = await txResponse.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  } catch (error) {
    console.error("Error sending transaction:", error);
    throw error;
  }
}
