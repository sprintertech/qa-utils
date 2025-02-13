import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import rebalancerABI from '../../../ABIS/rebalancer.json';

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
    rebalancerAddress: string
) => {
    if (!process.env.PROVIDER_URL_11155111 || !process.env.PRIVATE_KEY_REBALANCER) {
        throw new Error('Missing PROVIDER_URL_11155111 or PRIVATE_KEY_REBALANCER in environment variables');
    }

    const rpcProvider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL_11155111);
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

// Example usage
async function processRebalance() {
    const result = await executeProcessRebalance(
        0, 
        '0x000000000000000600000000000000000000157c0000000000000000000000009f3b8679c73c2fef8b59b4f3444d4e156fb70aa50000000000000000000000009f3b8679c73c2fef8b59b4f3444d4e156fb70aa5000000000000000000000000d2a0e86773dd9dd12a0fa2ec336511b39e17008c00000000000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e000000000000000000000000b44aeab4843094dd086c26dd6ce284c417436deb00000000000000000000000000000000000000000000000000000000004c4b40000000000000000000000000d2a0e86773dd9dd12a0fa2ec336511b39e17008c', 
        '0x0ca2035f4c10527481de3ed7be7bb533e3f8324d4c4dafc44e24e70eebf7b91d7b32cd343c8566a760d31503182a4b68f664233a802af277a460efa25a9aa3b61c71b262f3e1be21ee6eb95203785f909fb5c0dd181cdc0245af00750a3eb6e2614fc04f9273c68dcbdc93fc9cd7fe3a6029c8894df1059fd46ab8ac0f323318191c',
        '0xd2A0E86773dD9dD12a0Fa2EC336511b39e17008C'
    );
    console.log('Transaction result:', result);
}

processRebalance().catch(console.error);
