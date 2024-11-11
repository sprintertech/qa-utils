import { ethers } from "ethers";
import fs from "fs";

type Contract = "sprinterName" | "storage" | "ERC721Payable";

export function getContractInterface(
  contract: Contract
): ethers.utils.Interface {
  const abi = fs.readFileSync(`${process.cwd()}/src/ABIS/${contract}.json`, {
    encoding: "utf-8",
  });

  const contractInterface = new ethers.utils.Interface(abi);
  return contractInterface;
}

const DEPLOYMENTS: Record<Contract, Record<number, string>> = {
  sprinterName: {
    84532: "0x3F9A68fF29B3d86a6928C44dF171A984F6180009",
    11155111: "0xf70fb86F700E8Bb7cDf1c20197633518235c3425",
    1993: "0x17e4C404aD634E429ebCdF9a10F38A96Ce8eEF27",
    421614: "0xD7d5E7d7eaD31E783Df01760FbFad249704Aab14",
  },
  storage: {
    11155111: "0x10791B617D2Dad4978Cc18E3A88e422310428430",
    338: "0x4b17531F07e002Ee2A0714F79d84d9bEcF6b243D",
    17000: "0x5984CA38b38b43d0A9c94BA5a6D6969E92124a15",
    421614: "0xD7d5E7d7eaD31E783Df01760FbFad249704Aab14",
    10200: "0x40e273C40349dCA9062F9a3B80BAdFF000512c1F",
    84532: "0xF1bFBbE4174E2E6595E095BDF3ac8b97aF7796aA",
    80002: "0x2d5395aa622DBC7688B2eEeD3E2dC089aE0fd356",
    1993: "0xF5Ac994A5C402F4f426c2D7319C27912d5DBD7a8",
  },
  ERC721Payable: {
    11155111: "0x99eb23BEC48bF56C80889cFbcBF2d491F8aC75fe",
    84532: "0xAf8De6Aa5004E8e323DCC93C683A55e5eE87b9e9",
    1993: "0xAf8De6Aa5004E8e323DCC93C683A55e5eE87b9e9",
  },
};

export function getContractAddress(
  network: number,
  contract: Contract
): string {
  if (!!DEPLOYMENTS[contract][network]) {
    return DEPLOYMENTS[contract][network];
  }

  throw new Error("Contract address unavailable.");
}
