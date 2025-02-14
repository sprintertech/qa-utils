import { ethers, BigNumber } from 'ethers';
const fs = require("fs");
import dotenv from "dotenv";

dotenv.config();

const chainId = 11155111;
const abiPath = 'src/ABIS/yaho.json';
const contractAddress = '0x21eAB033C7D2DF6A67AeF6C5Bda9A7F151eB9f52';  

async function sendTransactionToContract(input: number) {
    const provider = new ethers.providers.JsonRpcProvider(process.env[`PROVIDER_URL_${chainId}`]);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
   
    const contractABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);
    const functionName = 'dispatchMessage';  
    const functionParams = [
        '10200', 
        '1',
        '0x9A17FA0A2824EA855EC6aD3eAb3Aa2516EC6626d',
        `0x048656c6c6f20776f726c64${input}`,
        ['0x0000000000000000000000000000000000000000'],
        ['0x731e64a076027b4024ce5a4F68bA9FF0093D3c86']
    ];

    const gasLimit = (await contract.estimateGas[functionName](...functionParams)).add(BigNumber.from(50000));
    const gasPrice = (await provider.getGasPrice()).mul(BigNumber.from(13)).div(BigNumber.from(10))


    const tx = await contract[functionName](...functionParams, {
        gasLimit: gasLimit,  
        gasPrice: gasPrice 
    });


    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
}

(async () => {
    for(let i = 1; i <= 9; i++) {
      console.log("Ittreation", i)
      await sendTransactionToContract(i).catch((error) => {
        console.error('Error sending transaction:', error);
    });

      console.log("wait 2s...")
      await new Promise(resolve => setTimeout(() => resolve("ok"), 120000))
    }
  })()