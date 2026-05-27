"use client";

import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { ghostMindAbi, getContractAddress } from "@/contracts";
import { useActionCost } from "./useGame";

export function useAskQuestion(gameId: bigint | undefined) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);
  const { questionCost } = useActionCost(gameId);

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

  const askQuestion = async (question: string) => {
    if (!gameId || !questionCost) {
      throw new Error("Game ID and question cost required");
    }

    writeContract({
      address,
      abi: ghostMindAbi,
      functionName: "askQuestion",
      args: [gameId, question],
      value: questionCost,
    });
  };

  return {
    askQuestion,
    questionCost,
    hash,
    isPending: isWritePending,
    isConfirming,
    isSuccess,
    error: writeError || confirmError,
    reset,
  };
}
