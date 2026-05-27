"use client";

import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { ghostMindAbi, getContractAddress } from "@/contracts";
import { useActionCost } from "./useGame";

export function useFinalGuess(gameId: bigint | undefined) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);
  const { guessCost } = useActionCost(gameId);

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

  const finalGuess = async (guess: string) => {
    if (!gameId || !guessCost) {
      throw new Error("Game ID and guess cost required");
    }

    writeContract({
      address,
      abi: ghostMindAbi,
      functionName: "finalGuess",
      args: [gameId, guess],
      value: guessCost,
    });
  };

  return {
    finalGuess,
    guessCost,
    hash,
    isPending: isWritePending,
    isConfirming,
    isSuccess,
    error: writeError || confirmError,
    reset,
  };
}
