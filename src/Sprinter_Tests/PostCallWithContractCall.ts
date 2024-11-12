import { sendSignedTransactionWithRawData } from "./utils/excute_raw_tx";
import dotenv from "dotenv";
import { Web3 } from "web3";
const fs = require("fs");
const fetch = require("node-fetch");

dotenv.config();
const abiPathSprinterName = "src/ABIS/sprinterName.json";
const abiPathERC721Payable = "src/ABIS/ERC721Payable.json";

const contractAddressesERC721Payable: Record<number, string> = {
  11155111: "0x99eb23BEC48bF56C80889cFbcBF2d491F8aC75fe",
  84532: "0xAf8De6Aa5004E8e323DCC93C683A55e5eE87b9e9",
  1993: "0xAf8De6Aa5004E8e323DCC93C683A55e5eE87b9e9",
};
const contractAddressessprinterName: Record<number, string> = {
  84532: "0x3F9A68fF29B3d86a6928C44dF171A984F6180009",
  11155111: "0xf70fb86F700E8Bb7cDf1c20197633518235c3425",
  1993: "0x17e4C404aD634E429ebCdF9a10F38A96Ce8eEF27",
  421614: "0xD7d5E7d7eaD31E783Df01760FbFad249704Aab14",
};
const usdcAddress: Record<number, string> = {
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  1993: "0xE61e5ed4c4f198c5384Ef57E69aAD1eF0c911004",
};

let amount: BigInt;
let approvalAddress: string | undefined;
let contractAddress: string;
let outputTokenAddress: string | undefined;
let callData: string;

async function contractCallData(
  chainId: number,
  tokenType: string,
  account: string
) {
  const providerURL = process.env.PROVIDER_URL_11155111;
  const web3js = new Web3(providerURL);
  if (tokenType === "usdc") {
    amount = BigInt(1) * BigInt(1e6);
    approvalAddress = contractAddressessprinterName[chainId];
    contractAddress = contractAddressessprinterName[chainId];
    outputTokenAddress = usdcAddress[chainId];
    const contractABIsprinterName = JSON.parse(
      fs.readFileSync(abiPathSprinterName, "utf8")
    );
    const contract = new web3js.eth.Contract(
      contractABIsprinterName,
      contractAddress
    );
    callData = contract.methods
      .claimName(`Test${Date.now().toString()}`, account, 100000)
      .encodeABI();
  } else if (tokenType === "eth") {
    amount =
      chainId === 11155111
        ? BigInt(1) * BigInt(1e11)
        : BigInt(1) * BigInt(1e14);
    approvalAddress = undefined;
    contractAddress = contractAddressesERC721Payable[chainId];
    outputTokenAddress = undefined;
    const contractABIERC721Payable = JSON.parse(
      fs.readFileSync(abiPathERC721Payable, "utf8")
    );
    const contract = new web3js.eth.Contract(
      contractABIERC721Payable,
      approvalAddress
    );
    callData = contract.methods
      .mintPayable(account, Date.now(), `Test${Date.now()}`)
      .encodeABI();
  }
}

const apiUrl = "https://api.test.sprinter.buildwithsygma.com/solution/call";
const walletPk = process.env.PRIVATE_KEY || ``;

async function callApi(sendTx: boolean) {
  const destChainId = 11155111;
  const tokenType = "eth";
  const account = "0x9A17FA0A2824EA855EC6aD3eAb3Aa2516EC6626d";

  await contractCallData(destChainId, tokenType, account);

  const data = {
    account: account,
    amount: `${amount}`,
    destination: destChainId,
    destinationContractCall: {
      approvalAddress: approvalAddress,
      callData: callData,
      contractAddress: contractAddress,
      gasLimit: 420000,
      outputTokenAddress: outputTokenAddress,
    },
    recipient: account,
    threshold: "1",
    token: tokenType,
    type: "fungible",
    whitelistedSourceChains: [84532],
  };
  console.log("Data is here", data);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${JSON.stringify(
          errorBody
        )}`
      );
    }

    const jsonResponse = await response.json();
    console.log("API Response:", JSON.stringify(jsonResponse, null, 2));

    if (sendTx) {
      const transactionData = jsonResponse.data[0]?.transaction;
      const approvals = jsonResponse.data[0]?.approvals || [];

      // Step 1: Handle Approval Transactions
      for (const approval of approvals) {
        const approvalTo = approval.to;
        const approvalData = approval.data;
        const approvalValue = approval.value || "0x0";
        const approvalChainID = approval.chainId;
        const providerUrl =
          process.env[`PROVIDER_URL_${approvalChainID}`] || "";

        console.log(`Sending approval transaction to ${approvalTo}`);
        await sendSignedTransactionWithRawData(
          approvalTo,
          approvalValue,
          approvalData,
          providerUrl,
          walletPk,
          approvalChainID
        );
      }

      // Step 2: Send Main Transaction
      const mainData = transactionData?.data;
      const mainTo = transactionData?.to;
      const transactionValue = transactionData?.value || "0x0";
      const transactionChainID = transactionData?.chainId;
      const providerUrl =
        process.env[`PROVIDER_URL_${transactionChainID}`] || "";

      if (mainData && mainTo) {
        console.log(`Sending main transaction to ${mainTo}`);
        await sendSignedTransactionWithRawData(
          mainTo,
          transactionValue,
          mainData,
          providerUrl,
          walletPk,
          transactionChainID
        );
      } else {
        console.error(
          "Main transaction data is missing from the API response."
        );
      }
    }
  } catch (error) {
    console.error("Error during API call and transaction handling:", error);
  }
}

callApi(false);
