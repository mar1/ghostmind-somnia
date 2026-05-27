"use client";

import { useReadContract, useReadContracts, usePublicClient } from "wagmi";
import { useChainId } from "wagmi";
import { useEffect, useState } from "react";
import { ghostMindAbi, GamePhase, Difficulty, getContractAddress } from "@/contracts";
import { fetchContractEventLogs } from "@/lib/contractLogs";

export interface Game {
  gameId: bigint;
  gameMaster: `0x${string}`;
  phase: GamePhase;
  difficulty: Difficulty;
  gameFee: bigint;
  pot: bigint;
  questionCount: bigint;
  winner: `0x${string}`;
  pendingQuestion: string;
  pendingPlayer: `0x${string}`;
  pendingRequestId: bigint;
  winningGuess: string;
  createdAt: bigint;
}

export interface QA {
  question: string;
  answer: string;
}

export function useGame(gameId: bigint | undefined) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  const { data, isLoading, error, refetch } = useReadContract({
    address,
    abi: ghostMindAbi,
    functionName: "getGame",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
    },
  });

  const game: Game | undefined = data
    ? {
        gameId: gameId!,
        gameMaster: data[0],
        phase: data[1] as GamePhase,
        difficulty: data[2] as Difficulty,
        gameFee: data[3],
        pot: data[4],
        questionCount: data[5],
        winner: data[6],
        pendingQuestion: "",
        pendingPlayer: "0x0000000000000000000000000000000000000000",
        pendingRequestId: BigInt(0),
        winningGuess: "",
        createdAt: BigInt(0),
      }
    : undefined;

  return { game, isLoading, error, refetch };
}

export function useGameFull(gameId: bigint | undefined) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  const { data, isLoading, error, refetch } = useReadContract({
    address,
    abi: ghostMindAbi,
    functionName: "games",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
    },
  });

  const game: Game | undefined = data
    ? {
        gameId: gameId!,
        gameMaster: data[0],
        phase: data[1] as GamePhase,
        difficulty: data[2] as Difficulty,
        gameFee: data[3],
        pot: data[4],
        questionCount: data[5],
        pendingQuestion: data[6],
        pendingPlayer: data[7],
        pendingRequestId: data[9],
        winner: data[10],
        winningGuess: data[11],
        createdAt: data[12],
      }
    : undefined;

  return { game, isLoading, error, refetch };
}

export function useGameHistory(gameId: bigint | undefined) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  const { data, isLoading, error, refetch } = useReadContract({
    address,
    abi: ghostMindAbi,
    functionName: "getHistory",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
    },
  });

  const history: QA[] = data
    ? data.map((qa) => ({
        question: qa.question,
        answer: qa.answer,
      }))
    : [];

  return { history, isLoading, error, refetch };
}

export function useActionCost(gameId: bigint | undefined) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  const { data, isLoading, error } = useReadContract({
    address,
    abi: ghostMindAbi,
    functionName: "getActionCost",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
    },
  });

  return {
    questionCost: data?.[0],
    guessCost: data?.[1],
    isLoading,
    error,
  };
}

/**
 * Reads the GameWon event prize for a finished game.
 * Returns the prize in wei, or undefined while loading.
 */
export function useGameWonPrize(gameId: bigint | undefined) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);
  const publicClient = usePublicClient();
  const [prize, setPrize] = useState<bigint | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!gameId || !publicClient) return;

    let cancelled = false;
    setPrize(undefined);
    setIsLoading(true);

    fetchContractEventLogs({
      publicClient,
      address,
      abi: ghostMindAbi,
      eventName: "GameWon",
      args: { gameId },
    })
      .then((logs) => {
        if (!cancelled && logs.length > 0) {
          const args = logs[0].args as { prize?: bigint };
          if (args.prize !== undefined) setPrize(args.prize);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gameId?.toString(), address, publicClient]);

  return { prize, isLoading };
}

/**
 * Reads the GameCreated event pot (initial seed) for a game.
 * Returns the initial seed in wei, or undefined while loading.
 */
export function useGameCreatedSeed(gameId: bigint | undefined) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);
  const publicClient = usePublicClient();
  const [seed, setSeed] = useState<bigint | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!gameId || !publicClient) return;

    let cancelled = false;
    setSeed(undefined);
    setIsLoading(true);

    fetchContractEventLogs({
      publicClient,
      address,
      abi: ghostMindAbi,
      eventName: "GameCreated",
      args: { gameId },
    })
      .then((logs) => {
        if (!cancelled && logs.length > 0) {
          const args = logs[0].args as { pot?: bigint };
          if (args.pot !== undefined) setSeed(args.pot);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gameId?.toString(), address, publicClient]);

  return { seed, isLoading };
}

// Hook to get game counter (total games created)
export function useGameCounter() {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  const { data, isLoading, error, refetch } = useReadContract({
    address,
    abi: ghostMindAbi,
    functionName: "gameCounter",
  });

  return { gameCounter: data, isLoading, error, refetch };
}
