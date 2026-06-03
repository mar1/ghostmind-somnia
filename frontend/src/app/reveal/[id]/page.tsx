"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatEther } from "viem";
import { AppChrome } from "@/components/AppChrome";
import { Button, Badge, Icon, GhostOrb, QARow, PhasePip, Wordmark } from "@/components/ui";
import { useGameCreatedSeed, useGameFull, useGameHistory, useGameWonPrize, useFinishedGames, useWikipediaInfo } from "@/hooks";
import { GamePhase, difficultyLabels } from "@/contracts";
import { formatStt, getPotDisplay } from "@/lib/pot";

function formatAddr(addr: `0x${string}`): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function BreakdownRow({
  label,
  v,
  muted,
  bold,
  large,
  tone,
  noUnit,
}: {
  label: string;
  v: string;
  muted?: boolean;
  bold?: boolean;
  large?: boolean;
  tone?: string;
  noUnit?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" }}>
      <span
        style={{
          fontSize: large ? 14 : 12.5,
          color: muted ? "var(--gm-muted)" : "var(--gm-fg-dim)",
          fontWeight: bold ? 500 : 400,
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontSize: large ? 22 : 13,
          color: tone || (muted ? "var(--gm-muted)" : "var(--gm-fg)"),
          letterSpacing: "0.02em",
          fontWeight: bold ? 500 : 400,
        }}
      >
        {v}
        {!muted && !noUnit && (
          <span style={{ fontSize: 10, color: "var(--gm-muted-2)", marginLeft: 5, letterSpacing: "0.08em" }}>STT</span>
        )}
      </span>
    </div>
  );
}

export default function RevealPage() {
  const params = useParams();
  const router = useRouter();

  const gameId = params.id ? BigInt(params.id as string) : undefined;

  const { game, isLoading: gameLoading } = useGameFull(gameId);
  const { history, isLoading: historyLoading } = useGameHistory(gameId);
  const { seed: initialSeedWei, isLoading: seedLoading } = useGameCreatedSeed(gameId);
  const { prize: prizePaidWei } = useGameWonPrize(gameId);
  const { games: finishedGames } = useFinishedGames(50);

  // Find prev/next finished games for navigation
  const sortedFinished = [...finishedGames].sort((a, b) => Number(a.gameId - b.gameId));
  const currentIndex = gameId ? sortedFinished.findIndex((g) => g.gameId === gameId) : -1;
  const prevGame = currentIndex > 0 ? sortedFinished[currentIndex - 1] : null;
  const nextGame = currentIndex < sortedFinished.length - 1 ? sortedFinished[currentIndex + 1] : null;

  // Wikipedia info for the winning guess
  const winningGuessForWiki = game?.winningGuess || undefined;
  const { info: wikiInfo, isLoading: wikiLoading } = useWikipediaInfo(winningGuessForWiki);

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

  // If game is not finished, redirect to game page
  if (game.phase !== GamePhase.Finished) {
    router.push(`/game/${gameId}`);
    return null;
  }

  const hasWinner = game.winner !== "0x0000000000000000000000000000000000000000";
  const livePotDrained = parseFloat(formatEther(game.pot)) === 0;
  const pot = getPotDisplay({
    potWei: game.pot,
    gameFeeWei: game.gameFee,
    history,
    hasWinner,
    initialSeedWei,
    prizePaidWei,
  });
  const { fee, feeStr, potStr, initialSeedStr, questionCount, wrongGuessCount, correctGuessCount } = pot;
  const winnerPayout = formatStt(pot.winnerPayoutValue, 3);
  const offeringAmount = formatStt(pot.offeringValue, 3);

  // Split the winning guess into parts for styling
  const winningGuess = game.winningGuess || "";
  const guessParts = winningGuess.split(" ");
  const firstName = guessParts[0] || "";
  const lastName = guessParts.slice(1).join(" ") || "";

  return (
    <AppChrome>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          position: "relative",
          background: "radial-gradient(ellipse at 50% 5%, oklch(0.21 0.05 65 / 0.45), var(--gm-bg) 55%)",
        }}
      >
        <div className="gm-grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.35, pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 1100, margin: "0 auto", padding: "40px 32px 56px" }}>
          {/* Navigation + Eyebrow */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!prevGame}
                  onClick={() => prevGame && router.push(`/reveal/${prevGame.gameId}`)}
                  style={{ opacity: prevGame ? 1 : 0.3 }}
                >
                  <Icon.chevron_left width={16} height={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!nextGame}
                  onClick={() => nextGame && router.push(`/reveal/${nextGame.gameId}`)}
                  style={{ opacity: nextGame ? 1 : 0.3 }}
                >
                  <Icon.chevron_right width={16} height={16} />
                </Button>
              </div>
              <div
                className="mono"
                style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--gm-ember)" }}
              >
                Round #{String(game.gameId).padStart(4, "0")} · {difficultyLabels[game.difficulty]} · {hasWinner ? "the ghost is named" : "time ran out"}
              </div>
            </div>
            <PhasePip phase="Finished" />
          </div>

          {/* Hero reveal */}
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "1fr 280px",
              gap: 40,
              alignItems: "center",
            }}
          >
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--gm-muted)",
                }}
              >
                {hasWinner ? "The Oracle's secret was" : "The séance ended"}
              </div>
              {hasWinner ? (
                <div
                  className="display"
                  style={{
                    fontSize: Math.min(108, 900 / Math.max(firstName.length, lastName.length || 1)),
                    color: "var(--gm-fg)",
                    letterSpacing: "-0.035em",
                    lineHeight: 0.95,
                    marginTop: 14,
                  }}
                >
                  {firstName}
                  {lastName && (
                    <>
                      <br />
                      <span style={{ fontStyle: "italic", color: "var(--gm-ember)" }}>{lastName}</span>
                    </>
                  )}
                </div>
              ) : (
                <div
                  className="display"
                  style={{
                    fontSize: 64,
                    color: "var(--gm-fg)",
                    letterSpacing: "-0.035em",
                    lineHeight: 0.95,
                    marginTop: 14,
                  }}
                >
                  No one
                  <br />
                  <span style={{ fontStyle: "italic", color: "var(--gm-muted)" }}>guessed correctly</span>
                </div>
              )}
              <div
                style={{
                  marginTop: 18,
                  fontSize: 15,
                  color: "var(--gm-fg-dim)",
                  maxWidth: 520,
                  lineHeight: 1.55,
                  fontStyle: "italic",
                }}
              >
                {hasWinner
                  ? `Named after ${questionCount} questions${wrongGuessCount > 0 ? ` and ${wrongGuessCount} wrong guess${wrongGuessCount > 1 ? "es" : ""}` : ""}${correctGuessCount > 0 ? " before a correct final guess" : ""}. The pot, less a 3% offering, has been sent to the winner.`
                  : `The séance ended without a winner. The pot has been returned to the game master.`}
              </div>
              {hasWinner && wikiInfo?.extract && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    background: "var(--gm-surface-1)",
                    border: "1px solid var(--gm-border-soft)",
                    borderRadius: "var(--gm-r-md)",
                    maxWidth: 520,
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "var(--gm-muted)",
                      marginBottom: 8,
                    }}
                  >
                    Who was {wikiInfo.title}?
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--gm-fg-dim)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {wikiInfo.extract.length > 300
                      ? wikiInfo.extract.slice(0, 300).trim() + "..."
                      : wikiInfo.extract}
                  </p>
                </div>
              )}
              <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                <Link href="/summon">
                  <Button variant="ember" size="lg" icon={<Icon.flame width={16} height={16} />}>
                    Summon another round
                  </Button>
                </Link>
                <Button variant="ghost" size="lg" onClick={() => router.push("/")}>
                  Back to Hall
                </Button>
              </div>
            </div>
            <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
              {hasWinner && wikiInfo?.thumbnail ? (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 200,
                      height: 200,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "3px solid var(--gm-ember)",
                      boxShadow: "0 0 40px oklch(0.82 0.14 65 / 0.3)",
                    }}
                  >
                    <img
                      src={wikiInfo.thumbnail}
                      alt={wikiInfo.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  {wikiInfo.pageUrl && (
                    <a
                      href={wikiInfo.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 12,
                        fontSize: 11,
                        color: "var(--gm-muted)",
                        textDecoration: "none",
                      }}
                    >
                      <Icon.external width={12} height={12} />
                      Wikipedia
                    </a>
                  )}
                </div>
              ) : wikiLoading && hasWinner ? (
                <GhostOrb size={200} state="thinking" label="fetching info..." />
              ) : (
                <GhostOrb size={240} state="revealing" label={hasWinner ? "unmasked" : "departed"} />
              )}
            </div>
          </div>

          {/* Winner banner */}
          {hasWinner && (
            <div
              style={{
                marginTop: 36,
                background: "linear-gradient(90deg, oklch(0.82 0.14 65 / 0.10), transparent 70%)",
                border: "1px solid oklch(0.55 0.13 65 / 0.45)",
                borderRadius: "var(--gm-r-md)",
                padding: "20px 24px",
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 24,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: "oklch(0.82 0.14 65 / 0.15)",
                  border: "1px solid oklch(0.55 0.13 65 / 0.55)",
                  color: "var(--gm-ember)",
                }}
              >
                <Icon.star width={24} height={24} />
              </div>
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "var(--gm-ember)",
                  }}
                >
                  Winner
                </div>
                <div style={{ fontSize: 20, color: "var(--gm-fg)", marginTop: 4 }}>
                  <span className="mono" style={{ fontSize: 17 }}>
                    {formatAddr(game.winner)}
                  </span>
                  <span style={{ color: "var(--gm-muted)", margin: "0 10px" }}>·</span>
                  <span style={{ fontStyle: "italic", color: "var(--gm-fg-dim)" }}>&quot;{winningGuess}&quot;</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--gm-muted)",
                  }}
                >
                  Prize
                </div>
                <div
                  className="display"
                  style={{
                    fontSize: 42,
                    color: "var(--gm-ember)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    marginTop: 2,
                  }}
                >
                  {winnerPayout}
                  <span className="mono" style={{ fontSize: 13, color: "var(--gm-muted)", marginLeft: 6, letterSpacing: "0.08em" }}>
                    STT
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Two columns: history + breakdown */}
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: hasWinner ? "1.5fr 1fr" : "1fr", gap: 18 }}>
            {/* History recap */}
            <div
              style={{
                background: "var(--gm-surface-1)",
                border: "1px solid var(--gm-border-soft)",
                borderRadius: "var(--gm-r-md)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--gm-border-soft)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--gm-muted)",
                  }}
                >
                  The full transcript
                </div>
                <Badge tone="phosphor" mono>
                  {history.length} entries
                </Badge>
              </div>
              <div style={{ maxHeight: 400, overflow: "auto" }}>
                {historyLoading && history.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--gm-muted)" }}>
                    Loading history...
                  </div>
                )}
                {!historyLoading && history.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--gm-muted)" }}>
                    No questions were asked
                  </div>
                )}
                {history.map((r, i) => (
                  <QARow key={i} idx={i + 1} q={r.question} a={r.answer} />
                ))}
              </div>
            </div>

            {/* Pot breakdown */}
            {hasWinner && (
              <div
                style={{
                  background: "var(--gm-surface-1)",
                  border: "1px solid var(--gm-border-soft)",
                  borderRadius: "var(--gm-r-md)",
                  padding: "18px 18px",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--gm-muted)",
                    marginBottom: 14,
                  }}
                >
                  Pot breakdown
                </div>
                {seedLoading && livePotDrained && initialSeedWei === undefined ? (
                  <div style={{ padding: "8px 0", fontSize: 12.5, color: "var(--gm-muted)", fontStyle: "italic" }}>
                    Loading on-chain seed...
                  </div>
                ) : (
                  <>
                <BreakdownRow label="Initial seed" v={initialSeedStr} />
                {questionCount > 0 && (
                  <BreakdownRow label={`${questionCount} question${questionCount > 1 ? "s" : ""} × ${feeStr}`} v={(questionCount * fee).toFixed(2)} />
                )}
                {wrongGuessCount > 0 && (
                  <BreakdownRow label={`${wrongGuessCount} wrong guess${wrongGuessCount > 1 ? "es" : ""} × ${feeStr}`} v={(wrongGuessCount * fee).toFixed(2)} />
                )}
                <div style={{ height: 1, background: "var(--gm-border-soft)", margin: "10px 0" }} />
                <BreakdownRow label="Total pot" v={potStr} bold />
                <BreakdownRow label="3% offering" v={`-${offeringAmount}`} muted />
                <BreakdownRow label="Winner gets" v={winnerPayout} tone="var(--gm-ember)" bold large />
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 12px",
                    borderRadius: "var(--gm-r-sm)",
                    background: "oklch(0.74 0.15 295 / 0.06)",
                    border: "1px solid oklch(0.50 0.14 295 / 0.4)",
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <Icon.moon width={16} height={16} style={{ color: "var(--gm-spectral)", flex: "none", marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--gm-fg-dim)", lineHeight: 1.45 }}>
                    Winner&apos;s fee was refunded - the correct guess was free.
                  </span>
                </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer signature */}
          <div
            style={{
              marginTop: 36,
              padding: "18px 0 0",
              borderTop: "1px solid var(--gm-border-soft)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--gm-muted-2)",
              }}
            >
              The contract is the public memory. The ghost only spoke through it.
            </span>
            <Wordmark size={18} />
          </div>
        </div>
      </div>
    </AppChrome>
  );
}
