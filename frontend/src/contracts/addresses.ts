import { somniaTestnet } from "@/wagmi";

// Contract addresses per chain
export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  [somniaTestnet.id]: "0xF3065903e3521f470F6851aE740D64fb8e3A26fE",
};

export function getContractAddress(chainId: number): `0x${string}` {
  const address = CONTRACT_ADDRESSES[chainId];
  if (!address) {
    throw new Error(`No contract address for chain ${chainId}`);
  }
  return address;
}

// Constants from the contract
export const LLM_DEPOSIT = 0.24; // in STT
export const PROTOCOL_FEE_BPS = 300; // 3%
