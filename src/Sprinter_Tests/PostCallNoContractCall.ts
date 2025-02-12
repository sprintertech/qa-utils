import { sendSignedTransactionWithRawData } from "./utils/excute_raw_tx";
import dotenv from "dotenv";
const fetch = require("node-fetch");

dotenv.config();

const apiUrl = "https://api.test.sprinter.buildwithsygma.com/solution/call";  //testnet
// const apiUrl = "https://api.sprinter.buildwithsygma.com/solution/call";  //mainnet
// const apiUrl = "http://127.0.0.1:8080/solution/call";  //local
const walletPk = process.env.PRIVATE_KEY || ``;

async function callApi(sendTx: boolean) {
  const account = "0x9A17FA0A2824EA855EC6aD3eAb3Aa2516EC6626d";
  const data = {
    account: account,
    amount: "2000000",
    destination: 11155111,
    //   destinationContractCall: {
    //     approvalAddress: CONTRACT_ADDRESS,
    //     callData: callData,
    //     contractAddress: CONTRACT_ADDRESS,
    //     gasLimit: 420000,
    //     outputTokenAddress: token_ADDRESS
    // },
    enableSwaps: false,
    recipient:"0x9A17FA0A2824EA855EC6aD3eAb3Aa2516EC6626d",
    threshold: "1",
    token: "usdc",
    type: "fungible",
    whitelistedSourceChains: [84532],
    whitelistedTools: [ 'relay' ]
  };

  try {
    console.log("Requst data", data);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    // Get and log the request ID from headers
    const requestId = response.headers.get('x-request-id');
    console.log("Request ID:", requestId);

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.text();
        // Try to parse as JSON if possible
        try {
          errorBody = JSON.parse(errorBody);
        } catch {
          // Keep as text if not valid JSON
        }
      } catch (e) {
        errorBody = 'Could not read error response';
      }
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${
          typeof errorBody === 'object' ? JSON.stringify(errorBody) : errorBody
        }`
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

callApi(true);
