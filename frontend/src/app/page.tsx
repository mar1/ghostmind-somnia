"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { AppChrome } from "@/components/AppChrome";
import { Button, Badge, Icon, PhasePip } from "@/components/ui";
import { useActiveGames, type GameSummary } from "@/hooks";
import { GamePhase, LLM_DEPOSIT } from "@/contracts";

type Filter = "all" | "open" | "high-pot" | "few-questions" | "your-rounds";

// Helper to format address for display
function formatAddr(addr: `0x${string}`): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Map GamePhase enum to display string
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

interface RoundCardProps {
  game: GameSummary;
  isMine: boolean;
  isHot?: boolean;
}

function RoundCard({ game, isMine, isHot }: RoundCardProps) {
  const phase = phaseToString(game.phase);
  const potStr = parseFloat(formatEther(game.pot)).toFixed(2);
  const feeStr = parseFloat(formatEther(game.gameFee)).toFixed(2);
  const questionsAsked = Number(game.questionCount);

  return (
    <div
      style={{
        position: "relative",
        background: isHot
          ? "linear-gradient(180deg, oklch(0.21 0.04 158 / 0.25), var(--gm-surface-1))"
          : "var(--gm-surface-1)",
        border: `1px solid ${isHot ? "oklch(0.55 0.16 158 / 0.4)" : "var(--gm-border-soft)"}`,
        borderRadius: "var(--gm-r-md)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: isHot ? "0 0 28px -10px oklch(0.55 0.16 158 / 0.4)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--gm-muted)", letterSpacing: "0.16em" }}>
            ROUND
          </div>
          <div className="display" style={{ fontSize: 30, color: "var(--gm-fg)", lineHeight: 1, marginTop: 2 }}>
            #{String(game.gameId).padStart(4, "0")}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <PhasePip phase={phase} />
          {isMine && (
            <Badge tone="spectral" mono>
              your round
            </Badge>
          )}
        </div>
      </div>

      {/* Pot + meta */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 4 }}>
        <div>
          <div
            className="mono"
            style={{ fontSize: 10, color: "var(--gm-muted)", letterSpacing: "0.18em", textTransform: "uppercase" }}
          >
            Pot
          </div>
          <div className="display" style={{ fontSize: 32, color: "var(--gm-ember)", lineHeight: 1, marginTop: 4 }}>
            {potStr}
            <span className="mono" style={{ fontSize: 11, color: "var(--gm-muted)", letterSpacing: "0.08em", marginLeft: 6 }}>
              STT
            </span>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            paddingLeft: 18,
            borderLeft: "1px solid var(--gm-border-soft)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <Mini label="fee/ask" value={`${feeStr} STT`} />
          <Mini label="questions" value={`${game.questionCount}`} />
          <Mini label="gm" value={formatAddr(game.gameMaster)} mono />
          <Mini label="asked" value={`${questionsAsked} Q&A`} />
        </div>
      </div>

      {/* Status indicator */}
      <div
        style={{
          background: "var(--gm-surface-2)",
          border: "1px solid var(--gm-border-soft)",
          borderRadius: "var(--gm-r-sm)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="mono"
            style={{ fontSize: 9.5, color: "var(--gm-muted)", letterSpacing: "0.16em", textTransform: "uppercase" }}
          >
            status
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--gm-fg-dim)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {phase === "Initializing"
              ? "Oracle is preparing..."
              : phase === "Processing"
                ? "Oracle is thinking..."
                : `${questionsAsked} questions asked`}
          </div>
        </div>
        <Badge tone={phase === "Processing" ? "spectral" : "phosphor"} mono>
          {phase.toLowerCase()}
        </Badge>
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <Link href={`/game/${game.gameId}`} style={{ flex: 1 }}>
          <Button variant="primary" iconRight={<Icon.arrow width={14} height={14} />} full>
            Enter the séance
          </Button>
        </Link>
        <Link href={`/game/${game.gameId}`}>
          <Button variant="quiet" icon={<Icon.eye width={14} height={14} />}>
            Read
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Mini({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div
        className="mono"
        style={{ fontSize: 9.5, color: "var(--gm-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}
      >
        {label}
      </div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 12.5, color: "var(--gm-fg-dim)", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function SidePanel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div
          className="mono"
          style={{ fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gm-fg-dim)" }}
        >
          {title}
        </div>
        {eyebrow && (
          <span className="mono" style={{ fontSize: 10, color: "var(--gm-muted-2)", letterSpacing: "0.1em" }}>
            {eyebrow}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

export default function SeanceHall() {
  const { address } = useAccount();
  const { games, isLoading, totalGames } = useActiveGames(20);
  const [filter, setFilter] = useState<Filter>("all");

  // Filter games based on selected filter
  const filteredGames = games.filter((game) => {
    switch (filter) {
      case "open":
        return game.phase === GamePhase.Active;
      case "high-pot":
        return true; // Will be sorted by pot
      case "few-questions":
        return true; // Will be sorted by questions
      case "your-rounds":
        return address?.toLowerCase() === game.gameMaster.toLowerCase();
      default:
        return true;
    }
  });

  // Sort games based on filter
  const sortedGames = [...filteredGames].sort((a, b) => {
    if (filter === "few-questions") {
      return Number(a.questionCount) - Number(b.questionCount);
    }
    // Default: sort by pot (highest first)
    return b.pot > a.pot ? 1 : -1;
  });

  const highestPot = sortedGames[0]?.pot;

  return (
    <AppChrome>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 360px", gap: 0, overflow: "hidden" }}>
        {/* main */}
        <div style={{ padding: "32px 32px 36px", overflow: "auto" }}>
          {/* Header band */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              paddingBottom: 24,
              marginBottom: 24,
              borderBottom: "1px solid var(--gm-border-soft)",
            }}
          >
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "var(--gm-phosphor)",
                }}
              >
                Active séances · {games.length} open
              </div>
              <div
                className="display"
                style={{ fontSize: 46, color: "var(--gm-fg)", letterSpacing: "-0.02em", marginTop: 8 }}
              >
                Séance <span style={{ fontStyle: "italic", color: "var(--gm-spectral)" }}>Hall</span>
              </div>
              <div style={{ fontSize: 14, color: "var(--gm-muted)", marginTop: 6, fontStyle: "italic" }}>
                Pick a round. Pay to ask. Name the ghost to claim the pot.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="ghost" icon={<Icon.eye width={14} height={14} />}>
                My rounds
              </Button>
              <Link href="/summon">
                <Button variant="primary" icon={<Icon.flame width={15} height={15} />}>
                  Summon a round
                </Button>
              </Link>
            </div>
          </div>

          {/* Filter row */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {[
              { label: "All", value: "all" as Filter },
              { label: "Open", value: "open" as Filter },
              { label: "High pot", value: "high-pot" as Filter },
              { label: "Few questions", value: "few-questions" as Filter },
              { label: "Your rounds", value: "your-rounds" as Filter },
            ].map((f) => {
              const isActive = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  style={{
                    fontSize: 12.5,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: isActive ? "var(--gm-surface-2)" : "transparent",
                    color: isActive ? "var(--gm-fg)" : "var(--gm-muted)",
                    border: `1px solid ${isActive ? "var(--gm-border)" : "transparent"}`,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
            <span style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 11, color: "var(--gm-muted)", letterSpacing: "0.1em", alignSelf: "center" }}>
              sort: {filter === "few-questions" ? "fewest questions" : "hottest pot"}
            </span>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--gm-muted)" }}>
              <div className="mono" style={{ fontSize: 12, letterSpacing: "0.16em" }}>Loading séances...</div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && games.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 18, color: "var(--gm-fg-dim)", marginBottom: 8 }}>No active séances</div>
              <div style={{ fontSize: 14, color: "var(--gm-muted)", marginBottom: 24 }}>Be the first to summon the Oracle.</div>
              <Link href="/summon">
                <Button variant="primary" icon={<Icon.flame width={15} height={15} />}>
                  Summon a round
                </Button>
              </Link>
            </div>
          )}

          {/* Rounds grid */}
          {!isLoading && games.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {sortedGames.map((game) => (
                <RoundCard
                  key={game.gameId.toString()}
                  game={game}
                  isMine={address?.toLowerCase() === game.gameMaster.toLowerCase()}
                  isHot={game.pot === highestPot}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side rail */}
        <aside
          style={{
            borderLeft: "1px solid var(--gm-border-soft)",
            padding: "28px 24px",
            overflow: "auto",
            background: "linear-gradient(180deg, oklch(0.155 0.014 264), var(--gm-bg))",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <SidePanel title="How a séance works">
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                ["01", "The Oracle picks a famous mind. The name is never written down."],
                ["02", "Players pay a fee to ask one yes-or-no question. The fee grows the pot."],
                ["03", "Every answer is recorded by the contract. Receipts are public."],
                ["04", "Name the ghost to take the pot, minus a 3% offering."],
              ].map(([n, t]) => (
                <li key={n} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 12, alignItems: "start" }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--gm-phosphor)", letterSpacing: "0.1em" }}>
                    {n}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--gm-fg-dim)", lineHeight: 1.5 }}>{t}</span>
                </li>
              ))}
            </ol>
          </SidePanel>

          <SidePanel title="Tonight's spirits" eyebrow="Top pots">
            {sortedGames.slice(0, 3).map((game) => (
              <Link
                key={game.gameId.toString()}
                href={`/game/${game.gameId}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px dashed var(--gm-border-soft)",
                  }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--gm-muted)" }}>
                      #{String(game.gameId).padStart(4, "0")}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--gm-fg-dim)", fontStyle: "italic" }}>
                      {game.questionCount.toString()} questions asked
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 14, color: "var(--gm-ember)" }}>
                    {parseFloat(formatEther(game.pot)).toFixed(2)}{" "}
                    <span style={{ fontSize: 10, color: "var(--gm-muted)" }}>STT</span>
                  </span>
                </div>
              </Link>
            ))}
            {games.length === 0 && !isLoading && (
              <div style={{ fontSize: 13, color: "var(--gm-muted)", fontStyle: "italic", padding: "10px 0" }}>
                No active games
              </div>
            )}
          </SidePanel>

          <SidePanel title="Network">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0" }}>
              <span style={{ color: "var(--gm-muted)" }}>Chain</span>
              <span className="mono" style={{ color: "var(--gm-fg-dim)" }}>Somnia · 50312</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0" }}>
              <span style={{ color: "var(--gm-muted)" }}>Oracle</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--gm-phosphor)", fontSize: 11.5 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--gm-phosphor)",
                    boxShadow: "0 0 8px var(--gm-phosphor)",
                  }}
                />
                live · 1.4s avg
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0" }}>
              <span style={{ color: "var(--gm-muted)" }}>Deposit per call</span>
              <span className="mono" style={{ color: "var(--gm-fg-dim)" }}>{LLM_DEPOSIT} STT</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0" }}>
              <span style={{ color: "var(--gm-muted)" }}>Total games</span>
              <span className="mono" style={{ color: "var(--gm-fg-dim)" }}>{totalGames?.toString() ?? "..."}</span>
            </div>
          </SidePanel>
        </aside>
      </div>
    </AppChrome>
  );
}
