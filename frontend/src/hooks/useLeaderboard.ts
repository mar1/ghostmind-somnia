"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useChainId } from "wagmi";
import { useMemo } from "react";
import { ghostMindAbi, getContractAddress } from "@/contracts";

export interface PlayerStats {
  questionsAsked: bigint;
  correctGuesses: bigint;
  incorrectGuesses: bigint;
}

export interface LeaderboardEntry {
  address: `0x${string}`;
  questionsAsked: bigint;
  correctGuesses: bigint;
  incorrectGuesses: bigint;
  totalActivity: bigint;
}

/**
 * Fetches stats for a single player
 */
export function usePlayerStats(playerAddress: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress,
    abi: ghostMindAbi,
    functionName: "getPlayerStats",
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: !!playerAddress,
    },
  });

  const stats: PlayerStats | undefined = data
    ? {
        questionsAsked: data.questionsAsked,
        correctGuesses: data.correctGuesses,
        incorrectGuesses: data.incorrectGuesses,
      }
    : undefined;

  return { stats, isLoading, error, refetch };
}

/**
 * Fetches the leaderboard with paginated player addresses and their stats
 */
export function useLeaderboard(limit = 50) {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  // Step 1: Get total player count
  const { data: playerCount, isLoading: countLoading } = useReadContract({
    address: contractAddress,
    abi: ghostMindAbi,
    functionName: "getKnownPlayersCount",
  });

  // Step 2: Get player addresses (up to limit)
  const { data: playerAddresses, isLoading: addressesLoading } = useReadContract({
    address: contractAddress,
    abi: ghostMindAbi,
    functionName: "getKnownPlayers",
    args: [BigInt(0), BigInt(limit)],
    query: {
      enabled: playerCount !== undefined && playerCount > BigInt(0),
    },
  });

  // Step 3: Fetch stats for all players using multicall
  const statsContracts = useMemo(() => {
    if (!playerAddresses || playerAddresses.length === 0) return [];
    return playerAddresses.map((addr) => ({
      address: contractAddress,
      abi: ghostMindAbi,
      functionName: "getPlayerStats" as const,
      args: [addr] as const,
    }));
  }, [playerAddresses, contractAddress]);

  const { data: statsResults, isLoading: statsLoading } = useReadContracts({
    contracts: statsContracts,
    query: {
      enabled: statsContracts.length > 0,
    },
  });

  // Step 4: Combine and sort
  const leaderboard = useMemo((): LeaderboardEntry[] => {
    if (!playerAddresses || !statsResults) return [];

    const entries: LeaderboardEntry[] = [];

    for (let i = 0; i < playerAddresses.length; i++) {
      const addr = playerAddresses[i];
      const result = statsResults[i];

      if (result.status === "success" && result.result) {
        const stats = result.result as {
          questionsAsked: bigint;
          correctGuesses: bigint;
          incorrectGuesses: bigint;
        };
        entries.push({
          address: addr,
          questionsAsked: stats.questionsAsked,
          correctGuesses: stats.correctGuesses,
          incorrectGuesses: stats.incorrectGuesses,
          totalActivity:
            stats.questionsAsked + stats.correctGuesses + stats.incorrectGuesses,
        });
      }
    }

    // Sort by correct guesses (wins) first, then by questions asked
    return entries.sort((a, b) => {
      if (b.correctGuesses !== a.correctGuesses) {
        return Number(b.correctGuesses - a.correctGuesses);
      }
      return Number(b.questionsAsked - a.questionsAsked);
    });
  }, [playerAddresses, statsResults]);

  const isLoading = countLoading || addressesLoading || statsLoading;

  return {
    leaderboard,
    totalPlayers: playerCount ?? BigInt(0),
    isLoading,
  };
}

/**
 * Helper to get global stats (totals across all players)
 */
export function useGlobalStats() {
  const { leaderboard, totalPlayers, isLoading } = useLeaderboard(100);

  const globalStats = useMemo(() => {
    let totalQuestions = BigInt(0);
    let totalCorrectGuesses = BigInt(0);
    let totalIncorrectGuesses = BigInt(0);

    for (const entry of leaderboard) {
      totalQuestions += entry.questionsAsked;
      totalCorrectGuesses += entry.correctGuesses;
      totalIncorrectGuesses += entry.incorrectGuesses;
    }

    return {
      totalPlayers,
      totalQuestions,
      totalCorrectGuesses,
      totalIncorrectGuesses,
    };
  }, [leaderboard, totalPlayers]);

  return { globalStats, isLoading };
}
