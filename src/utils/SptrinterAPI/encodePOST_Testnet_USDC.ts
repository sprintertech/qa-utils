import { Web3 } from 'web3';
const fs = require('fs')
require('dotenv').config({ path: 'src/utils/SptrinterAPI/.env' });


const providerURL = process.env.PROVIDER_TST_URL;
const web3js = new Web3(providerURL);

const abiPath = "src/ABIS/sprinterName.json"; 
const contractABI = JSON.parse(fs.readFileSync(abiPath, "utf8"));
const CONTRACT_ADDRESS = '0x3F9A68fF29B3d86a6928C44dF171A984F6180009';
const destTokenApprovalAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const account = "0x9A17FA0A2824EA855EC6aD3eAb3Aa2516EC6626d";
const name = "Liviu_TST06";
const amountClaimed = Number(2000000);

const contract = new web3js.eth.Contract(contractABI, CONTRACT_ADDRESS)
const callData = contract.methods.claimName(name,account,amountClaimed).encodeABI();

console.log("This is the callData from request " +callData);

async function callApi() {
    const url = 'https://api.test.sprinter.buildwithsygma.com/solution/call';
    const data = {
        account: account,
        token: "USDC",
        amount: amountClaimed, 
        destination: 84532,
        destinationContractCall: {
            callData: callData,
            contractAddress: CONTRACT_ADDRESS,
            approvalAddress: CONTRACT_ADDRESS,
            gasLimit: 420000,
            outputTokenAddress: destTokenApprovalAddress
        },
        recipient:account,
        type: "fungible",
        whitelistedSourceChains: [1993]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonResponse = await response.json();

        console.log('Response:', JSON.stringify(jsonResponse, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

callApi();