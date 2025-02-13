import axios from 'axios';
import { ethers } from "ethers";
//https://developers.circle.com/stablecoins/evm-smart-contracts 

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

interface CircleMessageResponse {
  messages: Array<{
    attestation: string;
    message: string;
    eventNonce: string;
  }>;
}

export enum CircleTestnet {
    ETHEREUM_SEPOLIA = "0",
    AVALANCHE_FUJI = "1",
    OP_SEPOLIA = "2",
    ARBITRUM_SEPOLIA = "3",
    BASE_SEPOLIA = "6",
    POLYGON_POS_AMOY = "7",
    UNICHAIN_SEPOLIA = "10"
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

export async function runGetMessage(sourceDomainId: string, transactionHash: string): Promise<{
    attestation: string | null;
    message: string | null;
}> {
    const circleAPI = new CircleAPI();
    
    try {
        const response = await circleAPI.getMessage(sourceDomainId, transactionHash);
        // console.log("Raw API Response:", JSON.stringify(response, null, 2));
        
        // Check if we have messages array in the response
        if ('messages' in response && Array.isArray(response.messages) && response.messages.length > 0) {
            const latestMessage = response.messages[0];
            return {
                attestation: latestMessage.attestation,
                message: latestMessage.message
            };
        } else {
            console.log("No messages found in response");
            return { attestation: null, message: null };
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Full Axios Error:", {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                }
            });
            
            if (error.response?.status === 404) {
                console.error(`Message not found. Transaction hash: ${transactionHash}, Domain ID: ${sourceDomainId}`);
            } else {
                console.error(`Circle API Error (${error.response?.status}):`, error.response?.data || error.message);
            }
        } else if (error instanceof Error) {
            console.error("Local Error:", {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        } else {
            console.error("Unknown error:", error);
        }
        return { attestation: null, message: null };
    }
}

// Example usage with more detailed logging
async function fetchData(exampleSourceDomainId: CircleTestnet, exampleTransactionHash: string) {
    console.log("Fetching data for:", {
        sourceDomainId: exampleSourceDomainId,
        transactionHash: exampleTransactionHash
    });
    
    const result = await runGetMessage(exampleSourceDomainId, exampleTransactionHash);
    console.log("Circle API Response:", result);
}

// Run the example
// const SourceDomainId = CircleTestnet.BASE_SEPOLIA;
// const TransactionHash = "0xee2fd77981dec456af999f3a3d1b5abe5198db2b42bf454531923658bbad219b";
// fetchData(SourceDomainId, TransactionHash).catch(console.error);

