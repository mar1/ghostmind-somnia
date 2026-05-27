import { formatEther } from "viem";

export type PotHistoryEntry = { answer: string };

export function formatStt(value: number, digits: number = 3): string {
  if (value === 0) return (0).toFixed(digits);
  const abs = Math.abs(value);
  if (abs < 10 ** -digits) {
    return `<${(10 ** -digits).toFixed(digits)}`;
  }
  return value.toFixed(digits);
}

export function analyzePotHistory(history: PotHistoryEntry[]) {
  const wrongGuessCount = history.filter((qa) => qa.answer.toLowerCase() === "incorrect").length;
  const correctGuessCount = history.filter((qa) => qa.answer.toLowerCase() === "correct").length;
  const questionCount = history.filter((qa) => {
    const answer = qa.answer.toLowerCase();
    return answer === "yes" || answer === "no";
  }).length;
  return { wrongGuessCount, correctGuessCount, questionCount };
}

/** Pot shown in UI; reconstructs pre-payout total when contract pot is already drained. */
export function getPotDisplay(params: {
  potWei: bigint;
  gameFeeWei: bigint;
  history: PotHistoryEntry[];
  hasWinner: boolean;
  /** Initial game seed from GameCreated event (in wei). */
  initialSeedWei?: bigint;
  /** Actual prize paid out from GameWon event (in wei). Used to back-calculate the true pot. */
  prizePaidWei?: bigint;
}) {
  const fee = parseFloat(formatEther(params.gameFeeWei));
  const { wrongGuessCount, correctGuessCount, questionCount } = analyzePotHistory(params.history);
  const paidActionsTotal = (questionCount + wrongGuessCount) * fee;
  const livePot = parseFloat(formatEther(params.potWei));

  let displayPot: number;
  if (params.hasWinner && livePot === 0) {
    if (params.initialSeedWei !== undefined) {
      displayPot = parseFloat(formatEther(params.initialSeedWei)) + paidActionsTotal;
    } else if (params.prizePaidWei !== undefined) {
      // prize = pot * 0.97  →  pot = prize / 0.97
      displayPot = parseFloat(formatEther(params.prizePaidWei)) / 0.97;
    } else if (paidActionsTotal > 0) {
      displayPot = paidActionsTotal;
    } else {
      displayPot = 0;
    }
  } else {
    displayPot = livePot;
  }

  const initialSeed =
    params.initialSeedWei !== undefined
      ? parseFloat(formatEther(params.initialSeedWei))
      : displayPot - paidActionsTotal;

  return {
    fee,
    feeStr: fee.toFixed(2),
    displayPot,
    potStr: displayPot.toFixed(2),
    initialSeed,
    initialSeedStr: initialSeed.toFixed(2),
    winnerPayoutValue: displayPot * 0.97,
    offeringValue: displayPot * 0.03,
    wrongGuessCount,
    correctGuessCount,
    questionCount,
    paidActionsTotal,
  };
}
