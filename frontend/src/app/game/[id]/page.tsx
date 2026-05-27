"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { AppChrome } from "@/components/AppChrome";
import { Button, Badge, Icon, GhostOrb, FrameCard, QARow, PhasePip, Stat, Addr } from "@/components/ui";
import {
  useGameCreatedSeed,
  useGameFull,
  useGameHistory,
  useAskQuestion,
  useFinalGuess,
  useActionCost,
  useGameEvents,
} from "@/hooks";
import { GamePhase, LLM_DEPOSIT } from "@/contracts";
import { formatStt, getPotDisplay } from "@/lib/pot";

function ComposerTab({
  active,
  label,
  cost,
  icon,
  tone,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  cost: string;
  icon: React.ReactNode;
  tone: "phosphor" | "ember";
  onClick: () => void;
  disabled?: boolean;
}) {
  const c = tone === "ember" ? "var(--gm-ember)" : "var(--gm-phosphor)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: "var(--gm-r-sm)",
        background: active
          ? tone === "ember"
            ? "oklch(0.82 0.14 65 / 0.12)"
            : "oklch(0.88 0.17 158 / 0.10)"
          : "transparent",
        border: `1px solid ${active ? c : "var(--gm-border-soft)"}`,
        color: active ? c : "var(--gm-muted)",
        fontSize: 13,
        fontFamily: "var(--gm-font-sans)",
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "0.005em",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      <span>{label}</span>
      <span className="mono" style={{ fontSize: 10, opacity: 0.7, letterSpacing: "0.06em" }}>
        {cost}
      </span>
    </button>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--gm-spectral)",
        animation: `gmPulse 1.2s ${delay} ease-in-out infinite`,
      }}
    />
  );
}

function phaseToString(phase: GamePhase): "Active" | "Processing" | "Finished" | "Initializing" {
  switch (phase) {
    case GamePhase.Initializing:
      return "Initializing";
    case GamePhase.Active:
      return "Active";
    case GamePhase.Processing:
      return "Processing";
    case GamePhase.Finished:
      return "Finished";
    default:
      return "Active";
  }
}

function formatAddr(addr: `0x${string}`): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Parse gameId from URL
  const gameId = params.id ? BigInt(params.id as string) : undefined;

  // Game data hooks
  const { game, isLoading: gameLoading, refetch: refetchGame } = useGameFull(gameId);
  const { history, isLoading: historyLoading, refetch: refetchHistory } = useGameHistory(gameId);
  const { seed: initialSeedWei } = useGameCreatedSeed(gameId);
  const { questionCost, guessCost } = useActionCost(gameId);

  // Action hooks
  const {
    askQuestion,
    isPending: askPending,
    isConfirming: askConfirming,
    isSuccess: askSuccess,
    error: askError,
    reset: resetAsk
  } = useAskQuestion(gameId);

  const {
    finalGuess,
    isPending: guessPending,
    isConfirming: guessConfirming,
    isSuccess: guessSuccess,
    error: guessError,
    reset: resetGuess
  } = useFinalGuess(gameId);

  // Local state
  const [tab, setTab] = useState<"ask" | "guess">("ask");
  const [draft, setDraft] = useState("");

  // Real-time event handling
  const handleGameReady = useCallback(() => {
    refetchGame();
  }, [refetchGame]);

  const handleQuestionAnswered = useCallback(() => {
    refetchGame();
    refetchHistory();
    setDraft("");
    resetAsk();
  }, [refetchGame, refetchHistory, resetAsk]);

  const handleGuessResult = useCallback((player: `0x${string}`, guess: string, correct: boolean) => {
    refetchGame();
    refetchHistory();
    setDraft("");
    resetGuess();
    if (correct) {
      router.push(`/reveal/${gameId}`);
    }
  }, [refetchGame, refetchHistory, resetGuess, router, gameId]);

  const handleGameWon = useCallback(() => {
    refetchGame();
    router.push(`/reveal/${gameId}`);
  }, [refetchGame, router, gameId]);

  const handleGameEnded = useCallback(() => {
    refetchGame();
  }, [refetchGame]);

  useGameEvents(gameId, {
    onGameReady: handleGameReady,
    onQuestionAnswered: handleQuestionAnswered,
    onGuessResult: handleGuessResult,
    onGameWon: handleGameWon,
    onGameEnded: handleGameEnded,
  });

  // Reset draft when tab changes
  useEffect(() => {
    setDraft("");
  }, [tab]);

  // Refetch after successful transactions
  useEffect(() => {
    if (askSuccess || guessSuccess) {
      refetchGame();
      refetchHistory();
    }
  }, [askSuccess, guessSuccess, refetchGame, refetchHistory]);

  const handleSubmit = async () => {
    if (!draft.trim() || !isConnected) return;

    try {
      if (tab === "ask") {
        await askQuestion(draft.trim());
      } else {
        await finalGuess(draft.trim());
      }
    } catch (e) {
      console.error("Transaction failed:", e);
    }
  };

  // Loading state
  if (gameLoading || !game) {
    return (
      <AppChrome>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <GhostOrb size={140} state="thinking" label="loading..." />
            <div className="mono" style={{ fontSize: 12, color: "var(--gm-muted)", marginTop: 20, letterSpacing: "0.16em" }}>
              LOADING ROUND #{gameId?.toString().padStart(4, "0")}
            </div>
          </div>
        </div>
      </AppChrome>
    );
  }

  const phase = phaseToString(game.phase);
  const isFinished = game.phase === GamePhase.Finished;
  const isProcessing = game.phase === GamePhase.Processing;
  const isInitializing = game.phase === GamePhase.Initializing;
  const questionsAsked = Number(game.questionCount);
  const hasWinner = game.winner !== "0x0000000000000000000000000000000000000000";
  const pot = getPotDisplay({
    potWei: game.pot,
    gameFeeWei: game.gameFee,
    history,
    hasWinner,
    initialSeedWei,
  });
  const { potStr, feeStr } = pot;
  const winnerPayout = formatStt(pot.winnerPayoutValue, 2);

  const questionCostStr = questionCost ? parseFloat(formatEther(questionCost)).toFixed(2) : "...";
  const guessCostStr = guessCost ? parseFloat(formatEther(guessCost)).toFixed(2) : "...";

  const isTransacting = askPending || askConfirming || guessPending || guessConfirming;
  const canInteract = isConnected && !isFinished && !isProcessing && !isInitializing && !isTransacting;

  const orbState = isTransacting || isProcessing
    ? "thinking"
    : isInitializing
      ? "thinking"
      : isFinished
        ? "revealing"
        : "ready";

  const orbLabel = isTransacting
    ? "channeling..."
    : isProcessing
      ? "oracle thinking..."
      : isInitializing
        ? "initializing..."
        : isFinished
          ? "séance complete"
          : "the oracle · listening";

  return (
    <AppChrome>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr 320px", overflow: "hidden" }}>
        {/* LEFT - round meta + oracle */}
        <aside
          style={{
            borderRight: "1px solid var(--gm-border-soft)",
            padding: "28px 24px",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            background: "linear-gradient(180deg, oklch(0.155 0.014 264), var(--gm-bg))",
          }}
        >
          {/* Round title */}
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gm-muted)" }}>
              Round
            </div>
            <div className="display" style={{ fontSize: 44, lineHeight: 1, color: "var(--gm-fg)", marginTop: 4, letterSpacing: "-0.02em" }}>
              #{String(game.gameId).padStart(4, "0")}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <PhasePip phase={phase} />
              {isFinished && hasWinner && (
                <Badge tone="ember" mono>won</Badge>
              )}
            </div>
          </div>

          {/* Oracle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 22px" }}>
            <GhostOrb size={200} state={orbState} label={orbLabel} />
          </div>

          {/* Pot card */}
          <FrameCard padding={18}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gm-muted)" }}>
              Pot
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
              <span className="display" style={{ fontSize: 48, color: "var(--gm-ember)", lineHeight: 1, letterSpacing: "-0.025em" }}>
                {potStr}
              </span>
              <span className="mono" style={{ fontSize: 13, color: "var(--gm-muted)", letterSpacing: "0.08em" }}>STT</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
              <Badge tone="phosphor" mono>winner takes {winnerPayout}</Badge>
              <Badge tone="neutral" mono>3% offering</Badge>
            </div>
          </FrameCard>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Stat label="questions" value={game.questionCount.toString().padStart(2, "0")} />
            <Stat label="fee/ask" value={feeStr} unit="STT" />
            <Stat label="history" value={`${history.length} entries`} />
            <Stat label="guess cost" value={guessCostStr} unit="STT" />
          </div>

          {/* Game master */}
          <div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gm-muted)", marginBottom: 10 }}>
              Game master
            </div>
            <Addr value={game.gameMaster} label="gm" />
          </div>

          {/* Winner (if finished) */}
          {isFinished && hasWinner && (
            <div>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gm-ember)", marginBottom: 10 }}>
                Winner
              </div>
              <Addr value={game.winner} label="winner" />
              {game.winningGuess && (
                <div style={{ marginTop: 10, fontSize: 14, color: "var(--gm-fg)", fontStyle: "italic" }}>
                  &quot;{game.winningGuess}&quot;
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CENTER - transcript */}
        <main style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--gm-bg)" }}>
          {/* sub-header */}
          <div
            style={{
              padding: "22px 32px 16px",
              borderBottom: "1px solid var(--gm-border-soft)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div>
              <div className="display" style={{ fontSize: 28, color: "var(--gm-fg)", letterSpacing: "-0.02em" }}>
                The <span style={{ fontStyle: "italic", color: "var(--gm-phosphor)" }}>transcript</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--gm-muted)", marginTop: 4, fontStyle: "italic" }}>
                Every word is in the ledger. The Oracle reads it all before answering.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Badge tone="ember" mono icon={<Icon.flame width={11} height={11} />}>
                {questionsAsked} questions asked
              </Badge>
            </div>
          </div>

          {/* Transcript scroll */}
          <div style={{ flex: 1, overflow: "auto", padding: "4px 32px 28px" }}>
            {historyLoading && history.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--gm-muted)" }}>
                Loading history...
              </div>
            )}

            {!historyLoading && history.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 16, color: "var(--gm-fg-dim)", marginBottom: 8 }}>No questions yet</div>
                <div style={{ fontSize: 13, color: "var(--gm-muted)", fontStyle: "italic" }}>
                  Be the first to ask the Oracle.
                </div>
              </div>
            )}

            {history.map((row, i) => (
              <QARow key={i} idx={i + 1} q={row.question} a={row.answer} />
            ))}

            {/* In-flight thinking row */}
            {isProcessing && game.pendingQuestion && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr auto",
                  gap: 14,
                  padding: "14px 16px",
                  alignItems: "center",
                  background: "linear-gradient(90deg, oklch(0.74 0.15 295 / 0.06), transparent 70%)",
                  borderRadius: "var(--gm-r-sm)",
                  border: "1px dashed oklch(0.50 0.14 295 / 0.45)",
                  marginTop: 8,
                }}
              >
                <div className="mono" style={{ fontSize: 11, color: "var(--gm-spectral)", letterSpacing: "0.1em" }}>
                  {(Number(game.questionCount) + 1).toString().padStart(2, "0")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--gm-fg)" }}>{game.pendingQuestion}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--gm-spectral)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    channeling · request #{game.pendingRequestId?.toString().slice(-6) ?? "..."}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gm-spectral)" }}>
                  <Dot />
                  <Dot delay="0.2s" />
                  <Dot delay="0.4s" />
                </div>
              </div>
            )}

            {/* Transaction pending row */}
            {isTransacting && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr auto",
                  gap: 14,
                  padding: "14px 16px",
                  alignItems: "center",
                  background: "linear-gradient(90deg, oklch(0.74 0.15 295 / 0.06), transparent 70%)",
                  borderRadius: "var(--gm-r-sm)",
                  border: "1px dashed oklch(0.50 0.14 295 / 0.45)",
                  marginTop: 8,
                }}
              >
                <div className="mono" style={{ fontSize: 11, color: "var(--gm-spectral)", letterSpacing: "0.1em" }}>
                  {(Number(game.questionCount) + 1).toString().padStart(2, "0")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--gm-fg)" }}>{draft || "..."}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--gm-spectral)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    {askPending || guessPending ? "confirm in wallet..." : "waiting for confirmation..."}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gm-spectral)" }}>
                  <Dot />
                  <Dot delay="0.2s" />
                  <Dot delay="0.4s" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          {!isFinished && (
            <div
              style={{
                borderTop: "1px solid var(--gm-border-soft)",
                padding: "18px 32px 26px",
                background: "linear-gradient(0deg, oklch(0.155 0.014 264), var(--gm-bg))",
              }}
            >
              <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                <ComposerTab
                  active={tab === "ask"}
                  onClick={() => setTab("ask")}
                  icon={<Icon.eye width={13} height={13} />}
                  label="Ask a question"
                  cost={questionCostStr}
                  tone="phosphor"
                  disabled={!canInteract}
                />
                <ComposerTab
                  active={tab === "guess"}
                  onClick={() => setTab("guess")}
                  icon={<Icon.flame width={13} height={13} />}
                  label="Final guess"
                  cost={guessCostStr}
                  tone="ember"
                  disabled={!canInteract}
                />
                <span style={{ flex: 1 }} />
                <span className="mono" style={{ fontSize: 10.5, color: "var(--gm-muted-2)", letterSpacing: "0.12em", alignSelf: "center" }}>
                  {tab === "ask" ? "Oracle answers yes / no" : "Oracle answers correct / incorrect"}
                </span>
              </div>

              {/* Error display */}
              {(askError || guessError) && (
                <div
                  style={{
                    padding: "10px 14px",
                    marginBottom: 14,
                    background: "oklch(0.68 0.21 22 / 0.1)",
                    border: "1px solid var(--gm-crimson)",
                    borderRadius: "var(--gm-r-sm)",
                    color: "var(--gm-crimson)",
                    fontSize: 12.5,
                  }}
                >
                  {(askError || guessError)?.message || "Transaction failed"}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    background: "var(--gm-surface-1)",
                    border: `1px solid ${tab === "ask" ? "oklch(0.55 0.16 158 / 0.4)" : "oklch(0.55 0.13 65 / 0.45)"}`,
                    borderRadius: "var(--gm-r-sm)",
                    padding: "0 16px",
                    height: 58,
                    boxShadow:
                      tab === "ask"
                        ? "0 0 0 4px oklch(0.55 0.16 158 / 0.08)"
                        : "0 0 0 4px oklch(0.55 0.13 65 / 0.08)",
                    opacity: canInteract ? 1 : 0.6,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: tab === "ask" ? "var(--gm-phosphor)" : "var(--gm-ember)",
                      letterSpacing: "0.16em",
                      marginRight: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    {tab === "ask" ? "Q > " : "Name > "}
                  </span>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={tab === "ask" ? "Ask one yes-or-no question..." : "Speak the name aloud..."}
                    disabled={!canInteract}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canInteract && draft.trim()) {
                        handleSubmit();
                      }
                    }}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "var(--gm-fg)",
                      fontSize: 16,
                      fontFamily: tab === "guess" ? "var(--gm-font-display)" : "var(--gm-font-sans)",
                      fontStyle: tab === "guess" ? "italic" : "normal",
                    }}
                  />
                  <span className="mono" style={{ fontSize: 11, color: "var(--gm-muted)", letterSpacing: "0.08em", marginRight: 12 }}>
                    {draft.length}/240
                  </span>
                </div>
                <Button
                  variant={tab === "ask" ? "primary" : "ember"}
                  size="lg"
                  iconRight={<Icon.arrow width={16} height={16} />}
                  onClick={handleSubmit}
                  disabled={!canInteract || !draft.trim() || isTransacting}
                >
                  {isTransacting
                    ? "Sending..."
                    : tab === "ask"
                      ? `Pay ${questionCostStr} · ask`
                      : `Pay ${guessCostStr} · guess`}
                </Button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11.5, color: "var(--gm-muted-2)" }}>
                <span>
                  Cost = <span className="mono" style={{ color: "var(--gm-fg-dim)" }}>{feeStr}</span> game fee +{" "}
                  <span className="mono" style={{ color: "var(--gm-fg-dim)" }}>{LLM_DEPOSIT}</span> oracle deposit.
                  {tab === "guess" && <span style={{ color: "var(--gm-phosphor)" }}> Fee refunded if correct.</span>}
                </span>
                {!isConnected && <span style={{ color: "var(--gm-ember)" }}>Connect wallet to play</span>}
              </div>
            </div>
          )}

          {/* Finished state */}
          {isFinished && (
            <div
              style={{
                borderTop: "1px solid var(--gm-border-soft)",
                padding: "24px 32px",
                background: "linear-gradient(0deg, oklch(0.155 0.014 264), var(--gm-bg))",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 18, color: "var(--gm-fg)", marginBottom: 8 }}>
                This séance has ended
              </div>
              {hasWinner && (
                <div style={{ fontSize: 14, color: "var(--gm-muted)", marginBottom: 16 }}>
                  Won by {formatAddr(game.winner)} · prize {winnerPayout} STT · &quot;{game.winningGuess}&quot;
                </div>
              )}
              <Button variant="ghost" onClick={() => router.push("/")}>
                Return to the Hall
              </Button>
            </div>
          )}
        </main>

        {/* RIGHT - receipts / activity */}
        <aside
          style={{
            borderLeft: "1px solid var(--gm-border-soft)",
            padding: "28px 24px",
            overflow: "auto",
            background: "linear-gradient(180deg, oklch(0.155 0.014 264), var(--gm-bg))",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gm-fg-dim)", marginBottom: 14 }}>
              Game info
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px dashed var(--gm-border-soft)",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--gm-muted)" }}>Phase</span>
                <Badge tone={phase === "Active" ? "phosphor" : phase === "Processing" ? "spectral" : "neutral"} mono>
                  {phase.toLowerCase()}
                </Badge>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px dashed var(--gm-border-soft)",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--gm-muted)" }}>Difficulty</span>
                <span style={{ fontSize: 12.5, color: "var(--gm-fg-dim)" }}>
                  {game.difficulty === 0 ? "Easy" : game.difficulty === 1 ? "Medium" : "Hard"}
                </span>
              </div>
            </div>
          </div>

          {/* What the oracle sees */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gm-fg-dim)" }}>
                What the Oracle sees
              </div>
            </div>
            <FrameCard padding={14}>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  fontSize: 10.5,
                  color: "var(--gm-fg-dim)",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  letterSpacing: "0.005em",
                }}
              >
                {history.length > 0
                  ? `## Previous Q&A (stay consistent)\n${history
                      .slice(-5)
                      .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
                      .join("\n")}${history.length > 5 ? "\n..." : ""}`
                  : "No previous questions yet.\n\nThe Oracle will answer based on\nthe secret character it chose."}
              </pre>
            </FrameCard>
            <div style={{ fontSize: 11.5, color: "var(--gm-muted-2)", marginTop: 8, fontStyle: "italic" }}>
              The full history is replayed into every call - that is how the Oracle stays consistent.
            </div>
          </div>
        </aside>
      </div>
    </AppChrome>
  );
}
