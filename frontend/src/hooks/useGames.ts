"use client";

import { useReadContracts, useChainId } from "wagmi";
import { ghostMindAbi, GamePhase, Difficulty, getContractAddress } from "@/contracts";
import { useGameCounter } from "./useGame";

export interface GameSummary {
  gameId: bigint;
  gameMaster: `0x${string}`;
  phase: GamePhase;
  difficulty: Difficulty;
  gameFee: bigint;
  pot: bigint;
  questionCount: bigint;
  winner: `0x${string}`;
}

// Fetch multiple games by their IDs
export function useGames(gameIds: bigint[]) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  const contracts = gameIds.map((gameId) => ({
    address,
    abi: ghostMindAbi,
    functionName: "getGame" as const,
    args: [gameId] as const,
  }));

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: gameIds.length > 0,
    },
  });

  const games: GameSummary[] = data
    ? data
        .map((result, index) => {
          if (result.status !== "success" || !result.result) return null;
          const d = result.result;
          return {
            gameId: gameIds[index],
            gameMaster: d[0],
            phase: d[1] as GamePhase,
            difficulty: d[2] as Difficulty,
            gameFee: d[3],
            pot: d[4],
            questionCount: d[5],
            winner: d[6],
          };
        })
        .filter((g): g is GameSummary => g !== null)
    : [];

  return { games, isLoading, error, refetch };
}

// Fetch recent games (last N games based on gameCounter)
export function useRecentGames(count: number = 20) {
  const { gameCounter, isLoading: counterLoading } = useGameCounter();

  // Generate game IDs to fetch (most recent first)
  const gameIds: bigint[] = [];
  if (gameCounter) {
    const start = gameCounter > BigInt(count) ? gameCounter - BigInt(count) + BigInt(1) : BigInt(1);
    for (let i = gameCounter; i >= start; i--) {
      gameIds.push(i);
    }
  }

  const { games, isLoading: gamesLoading, error, refetch } = useGames(gameIds);

  return {
    games,
    isLoading: counterLoading || gamesLoading,
    error,
    refetch,
    totalGames: gameCounter,
  };
}

// Filter games by phase
export function useActiveGames(count: number = 20) {
  const { games, isLoading, error, refetch, totalGames } = useRecentGames(count);

  const activeGames = games.filter(
    (g) => g.phase === GamePhase.Active || g.phase === GamePhase.Processing || g.phase === GamePhase.Initializing
  );

  return { games: activeGames, isLoading, error, refetch, totalGames };
}

export function useFinishedGames(count: number = 20) {
  const { games, isLoading, error, refetch, totalGames } = useRecentGames(count);

  const finishedGames = games.filter((g) => g.phase === GamePhase.Finished);

  return { games: finishedGames, isLoading, error, refetch, totalGames };
}
