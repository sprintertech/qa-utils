import { sendSignedTransactionWithRawData } from "./utils/excute_raw_tx";
import dotenv from "dotenv";
const fetch = require("node-fetch");

dotenv.config();

const apiUrl = "https://api.test.sprinter.buildwithsygma.com/solutions/balance-sweep";
// const apiUrl = "http://127.0.0.1:8080/solution/call";
const walletPk = process.env.PRIVATE_KEY || ``;

async function callApi(sendTx: boolean) {
  const data = {
    account : "0x9A17FA0A2824EA855EC6aD3eAb3Aa2516EC6626d",
    recipient : "0x9A17FA0A2824EA855EC6aD3eAb3Aa2516EC6626d",
    destination : 84532,
    token : "usdc",
    whitelistedSourceChains : [11155111],
    whitelistedTools : "across"
  };

  const url = `${apiUrl}?account=${data.account}&recipient=${data.recipient}&destination=${data.destination}&token=${data.token}&whitelistedSourceChains=${data.whitelistedSourceChains.join(',')}&whitelistedTools=${data.whitelistedTools}`;

  try {
    console.log("Requst data", data);
    const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json"
        }
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
