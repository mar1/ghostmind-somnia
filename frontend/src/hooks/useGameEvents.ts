"use client";

import { useWatchContractEvent, useChainId } from "wagmi";
import { ghostMindAbi, getContractAddress } from "@/contracts";

// Watch for game events in real-time
export function useGameEvents(
  gameId: bigint | undefined,
  callbacks: {
    onGameReady?: () => void;
    onQuestionAnswered?: (question: string, answer: string, questionCount: bigint) => void;
    onGuessResult?: (player: `0x${string}`, guess: string, correct: boolean) => void;
    onGameWon?: (winner: `0x${string}`, guess: string, prize: bigint) => void;
    onGameEnded?: (recipient: `0x${string}`, amount: bigint, reason: string) => void;
  }
) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  useWatchContractEvent({
    address,
    abi: ghostMindAbi,
    eventName: "GameReady",
    args: gameId ? { gameId } : undefined,
    enabled: !!gameId && !!callbacks.onGameReady,
    onLogs: () => {
      callbacks.onGameReady?.();
    },
  });

  useWatchContractEvent({
    address,
    abi: ghostMindAbi,
    eventName: "QuestionAnswered",
    args: gameId ? { gameId } : undefined,
    enabled: !!gameId && !!callbacks.onQuestionAnswered,
    onLogs: (logs) => {
      for (const log of logs) {
        const { question, answer, questionCount } = log.args;
        if (question && answer && questionCount !== undefined) {
          callbacks.onQuestionAnswered?.(question, answer, questionCount);
        }
      }
    },
  });

  useWatchContractEvent({
    address,
    abi: ghostMindAbi,
    eventName: "GuessResult",
    args: gameId ? { gameId } : undefined,
    enabled: !!gameId && !!callbacks.onGuessResult,
    onLogs: (logs) => {
      for (const log of logs) {
        const { player, guess, correct } = log.args;
        if (player && guess && correct !== undefined) {
          callbacks.onGuessResult?.(player, guess, correct);
        }
      }
    },
  });

  useWatchContractEvent({
    address,
    abi: ghostMindAbi,
    eventName: "GameWon",
    args: gameId ? { gameId } : undefined,
    enabled: !!gameId && !!callbacks.onGameWon,
    onLogs: (logs) => {
      for (const log of logs) {
        const { winner, guess, prize } = log.args;
        if (winner && guess && prize !== undefined) {
          callbacks.onGameWon?.(winner, guess, prize);
        }
      }
    },
  });

  useWatchContractEvent({
    address,
    abi: ghostMindAbi,
    eventName: "GameEnded",
    args: gameId ? { gameId } : undefined,
    enabled: !!gameId && !!callbacks.onGameEnded,
    onLogs: (logs) => {
      for (const log of logs) {
        const { recipient, amount, reason } = log.args;
        if (recipient && amount !== undefined && reason) {
          callbacks.onGameEnded?.(recipient, amount, reason);
        }
      }
    },
  });
}

// Watch for new games being created
export function useNewGameEvents(
  onGameCreated?: (gameId: bigint, gameMaster: `0x${string}`, pot: bigint, gameFee: bigint, difficulty: number) => void
) {
  const chainId = useChainId();
  const address = getContractAddress(chainId);

  useWatchContractEvent({
    address,
    abi: ghostMindAbi,
    eventName: "GameCreated",
    enabled: !!onGameCreated,
    onLogs: (logs) => {
      for (const log of logs) {
        const { gameId, gameMaster, pot, gameFee, difficulty } = log.args;
        if (gameId && gameMaster && pot !== undefined && gameFee !== undefined && difficulty !== undefined) {
          onGameCreated?.(gameId, gameMaster, pot, gameFee, difficulty);
        }
      }
    },
  });
}
