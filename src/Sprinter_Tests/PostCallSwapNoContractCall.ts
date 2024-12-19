import { sendSignedTransactionWithRawData } from "./utils/excute_raw_tx";
import dotenv from "dotenv";
const fetch = require("node-fetch");

dotenv.config();

const apiUrl = "https://api.test.sprinter.buildwithsygma.com/solution/call";
// const apiUrl = "http://127.0.0.1:8080/solution/call";
const walletPk = process.env.PRIVATE_KEY || ``;

async function callApi(sendTx: boolean) {
  const account = "0x1C7B3EeC71b6f4fE5ec5e521Fd4363ceC867a07c";
  const data = {
    account: account,
    amount: "16330000",
    destination: 84532,
    //   destinationContractCall: {
    //     approvalAddress: CONTRACT_ADDRESS,
    //     callData: callData,
    //     contractAddress: CONTRACT_ADDRESS,
    //     gasLimit: 420000,
    //     outputTokenAddress: token_ADDRESS
    // },
    recipient: account,
    enableSwaps: true,
    threshold: "1",
    token: "usdc",
    type: "fungible",
    whitelistedSourceChains: [11155111],
    whitelistedTools: ["sygma"],
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

callApi(true);
