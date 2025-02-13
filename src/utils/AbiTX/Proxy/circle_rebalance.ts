import axios from 'axios';
import { ethers } from "ethers";

interface CirclePublicKey {
  keyId: string;
  publicKey: string;
}

interface AttestationResponse {
  attestation: string;
  status: string;
}

interface MessageDetails {
  messageHash: string;
  message: {
    sourceDomain: string;
    targetDomain: string;
    nonce: number;
    sender: string;
    recipient: string;
    amount: string;
  };
  status: string;
}

function getMessageHash(rawData: string): string {
    // Ensure rawData is a valid hex string
    if (!rawData.startsWith("0x")) {
        throw new Error("Invalid raw data format. Expected hex string starting with 0x.");
    }
    return ethers.utils.keccak256(rawData);
}

export class CircleAPI {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://iris-api-sandbox.circle.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Retrieves the signed attestation for a USDC burn event
   * @param messageHash - The hash of the message to get attestation for
   * @returns Promise containing the attestation data
   */
  async getAttestation(messageHash: string): Promise<AttestationResponse> {
    const response = await axios.get(`${this.baseUrl}/v1/attestations/${messageHash}`);
    return response.data;
  }

  /**
   * Fetches Circle's active public keys for verifying attestation signatures
   * @returns Promise containing array of public keys
   */
  async getPublicKeys(): Promise<CirclePublicKey[]> {
    const response = await axios.get(`${this.baseUrl}/v1/publicKeys`);
    return response.data;
  }

  /**
   * Gets transaction details for burn events or associated messages
   * @param sourceDomainId - The domain ID of the source chain
   * @param transactionHash - The transaction hash to query
   * @returns Promise containing message details
   */
  async getMessage(sourceDomainId: string, transactionHash: string): Promise<MessageDetails> {
    const response = await axios.get(
      `${this.baseUrl}/v1/messages/${sourceDomainId}/${transactionHash}`
    );
    return response.data;
  }
}

async function runGetAttestation(rawData: string) {
    const circleAPI = new CircleAPI();
    
    try {
        const messageHash = getMessageHash(rawData);
        console.log("Generated messageHash:", messageHash);
        
        const response = await circleAPI.getAttestation(messageHash);
        console.log("Attestation Response:", response);
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                console.error("Attestation not found. The message hash might be incorrect or the attestation is not ready yet.");
                console.error("Message Hash used:", getMessageHash(rawData));
            } else {
                console.error(`Circle API Error (${error.response?.status}):`, error.response?.data || error.message);
            }
        } else if (error instanceof Error) {
            console.error("Local Error:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}

async function runGetMessage(sourceDomainId: string, transactionHash: string) {
    const circleAPI = new CircleAPI();
    
    try {
        const messageDetails = await circleAPI.getMessage(sourceDomainId, transactionHash);
        console.log("Message Details:", messageDetails);
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                console.error("Message not found. The transaction hash or domain ID might be incorrect.");
            } else {
                console.error(`Circle API Error (${error.response?.status}):`, error.response?.data || error.message);
            }
        } else if (error instanceof Error) {
            console.error("Local Error:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}

// Example with actual data
const exampleRawData = "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000f8000000000000000600000000000000000000157c0000000000000000000000009f3b8679c73c2fef8b59b4f3444d4e156fb70aa50000000000000000000000009f3b8679c73c2fef8b59b4f3444d4e156fb70aa5000000000000000000000000d2a0e86773dd9dd12a0fa2ec336511b39e17008c00000000000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e000000000000000000000000b44aeab4843094dd086c26dd6ce284c417436deb00000000000000000000000000000000000000000000000000000000004c4b40000000000000000000000000d2a0e86773dd9dd12a0fa2ec336511b39e17008c0000000000000000";
// runGetAttestation(exampleRawData);

// Example usage
const exampleSourceDomainId = "6"; // Example domain ID for Avalanche
const exampleTransactionHash = "0xf2c87f7862411073bbb001c85f1127a3f7b41fa98e67b862e18ec3bc6ed40ae8"; // Replace with your actual transaction hash
runGetMessage(exampleSourceDomainId, exampleTransactionHash);

