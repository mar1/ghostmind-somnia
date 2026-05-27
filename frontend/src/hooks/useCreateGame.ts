"use client";

import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseEther } from "viem";
import { ghostMindAbi, Difficulty, getContractAddress, LLM_DEPOSIT } from "@/contracts";

export function useCreateGame() {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const createGame = async (gameFee: bigint, difficulty: Difficulty, potSeed: bigint) => {
    const llmDeposit = parseEther(LLM_DEPOSIT.toString());
    const totalValue = llmDeposit + potSeed;

    writeContract({
      address,
      abi: ghostMindAbi,
      functionName: "createGame",
      args: [gameFee, difficulty],
      value: totalValue,
    });
  };

  return {
    createGame,
    hash,
    isPending: isWritePending,
    isConfirming,
    isSuccess,
    error: writeError || confirmError,
    reset,
  };
}
