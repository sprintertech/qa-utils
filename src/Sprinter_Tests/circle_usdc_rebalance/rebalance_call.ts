import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import rebalancerABI from '../../ABIS/rebalancer.json';
import { CircleTestnet, runGetMessage } from './circle_rebalance_api';

dotenv.config();

export const createProcessRebalanceCall = (
    provider: number,  // This corresponds to the Provider enum
    message: string,    // First bytes parameter to encode
    attestation: string     // Second bytes parameter to encode
) => {
    const encodedData = ethers.utils.defaultAbiCoder.encode(
        ['bytes', 'bytes'],
        [message, attestation]
    );

    // Return the encoded function call
    return {
        name: 'processRebalance',
        args: [
            provider,
            encodedData
        ]
    };
};

export const executeProcessRebalance = async (
    provider: number,
    message: string,
    attestation: string,
    rebalancerAddress: string,
    destinationChainId: number ) => {
    if (!process.env[`PROVIDER_URL_${destinationChainId}`] || !process.env.PRIVATE_KEY_REBALANCER) {
        throw new Error('Missing PROVIDER_URL_11155111 or PRIVATE_KEY_REBALANCER in environment variables');
    }

    const rpcProvider = new ethers.providers.JsonRpcProvider(process.env[`PROVIDER_URL_${destinationChainId}`]);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY_REBALANCER, rpcProvider);

    // Create contract instance
    const rebalancerContract = new ethers.Contract(
        rebalancerAddress,
        rebalancerABI,
        signer
    );

    // Create the call data
    const call = createProcessRebalanceCall(provider, message, attestation);

    try {
        // Execute the transaction with override options to force it through
        const tx = await rebalancerContract.processRebalance(...call.args, {
            gasLimit: 1000000, // Set a high gas limit
        });

        console.log('Transaction sent to chain with hash:', tx.hash);
        
        try {
            const receipt = await tx.wait();
            return receipt;
        } catch (waitError: any) {
            console.error('Transaction failed during confirmation:', {
                error: waitError.message,
                transactionHash: tx.hash,
                code: waitError.code,
                reason: waitError.reason
            });
            throw waitError;
        }
    } catch (error: any) {
        console.error('Transaction failed during execution:', {
            error: error.message,
            code: error.code,
            reason: error.reason,
            data: error.data,
            transaction: error.transaction
        });
        throw error;
    }
};

async function processRebalanceWithFetch(provider: number = 0, sourceDomainId: CircleTestnet, transactionHash: string, destinationChainId: number) {
    // First fetch the attestation and message from Circle API
    const circleData = await runGetMessage(sourceDomainId, transactionHash);
    console.log(circleData);
    
    if (!circleData.attestation || !circleData.message) {
        throw new Error("Failed to fetch attestation or message from Circle API");
    }

    // Now execute the rebalance with the fetched data
    const result = await executeProcessRebalance(
        provider, // nonce remains the same
        circleData.message,
        circleData.attestation,
        '0xd2A0E86773dD9dD12a0Fa2EC336511b39e17008C', // recipient address remains the same
        destinationChainId
    );

    return result;
}



const sourceDomainId = CircleTestnet.BASE_SEPOLIA;
const transactionHash = "0xaf5416459a90ccee63683ef4208e5c77f0496d42f78c1dd42a62120f97bc5da8";
processRebalanceWithFetch(0, sourceDomainId, transactionHash, 421614).catch(console.error);
