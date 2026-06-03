"use client";

import { useAccount } from "wagmi";
import { AppChrome } from "@/components/AppChrome";
import { Badge, Stat, Addr, Icon } from "@/components/ui";
import { useLeaderboard, usePlayerStats, useGlobalStats } from "@/hooks";

function formatAddr(addr: `0x${string}`): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface LeaderboardRowProps {
  rank: number;
  address: `0x${string}`;
  questionsAsked: bigint;
  correctGuesses: bigint;
  incorrectGuesses: bigint;
  isCurrentUser: boolean;
}

function LeaderboardRow({
  rank,
  address,
  questionsAsked,
  correctGuesses,
  incorrectGuesses,
  isCurrentUser,
}: LeaderboardRowProps) {
  const totalGuesses = correctGuesses + incorrectGuesses;
  const winRate =
    totalGuesses > BigInt(0)
      ? Math.round((Number(correctGuesses) / Number(totalGuesses)) * 100)
      : 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "50px 1fr 100px 80px 100px 80px",
        alignItems: "center",
        padding: "14px 16px",
        background: isCurrentUser
          ? "linear-gradient(90deg, oklch(0.21 0.04 158 / 0.15), transparent)"
          : "transparent",
        borderBottom: "1px solid var(--gm-border-soft)",
        borderLeft: isCurrentUser ? "2px solid var(--gm-phosphor)" : "2px solid transparent",
      }}
    >
      {/* Rank */}
      <div
        className="mono"
        style={{
          fontSize: rank <= 3 ? 18 : 14,
          fontWeight: rank <= 3 ? 600 : 400,
          color:
            rank === 1
              ? "var(--gm-ember)"
              : rank === 2
                ? "var(--gm-fg-dim)"
                : rank === 3
                  ? "oklch(0.65 0.10 50)"
                  : "var(--gm-muted)",
        }}
      >
        #{rank}
      </div>

      {/* Address */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="mono" style={{ fontSize: 13, color: "var(--gm-fg-dim)" }}>
          {formatAddr(address)}
        </span>
        {isCurrentUser && (
          <Badge tone="phosphor" mono>
            you
          </Badge>
        )}
        {rank === 1 && (
          <Badge tone="ember" mono icon={<Icon.flame width={10} height={10} />}>
            leader
          </Badge>
        )}
      </div>

      {/* Questions Asked */}
      <div className="mono" style={{ fontSize: 13, color: "var(--gm-fg-dim)", textAlign: "right" }}>
        {questionsAsked.toString()}
      </div>

      {/* Correct Guesses (Wins) */}
      <div
        className="mono"
        style={{
          fontSize: 13,
          color: correctGuesses > BigInt(0) ? "var(--gm-phosphor)" : "var(--gm-muted)",
          textAlign: "right",
        }}
      >
        {correctGuesses.toString()}
      </div>

      {/* Incorrect Guesses */}
      <div
        className="mono"
        style={{
          fontSize: 13,
          color: incorrectGuesses > BigInt(0) ? "var(--gm-crimson)" : "var(--gm-muted)",
          textAlign: "right",
        }}
      >
        {incorrectGuesses.toString()}
      </div>

      {/* Win Rate */}
      <div
        className="mono"
        style={{
          fontSize: 12,
          color: winRate > 50 ? "var(--gm-phosphor)" : "var(--gm-muted)",
          textAlign: "right",
        }}
      >
        {winRate}%
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "50px 1fr 100px 80px 100px 80px",
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: "1px solid var(--gm-border)",
        background: "var(--gm-surface-2)",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--gm-muted)" }}
      >
        RANK
      </div>
      <div
        className="mono"
        style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--gm-muted)" }}
      >
        PLAYER
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          color: "var(--gm-muted)",
          textAlign: "right",
        }}
      >
        QUESTIONS
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          color: "var(--gm-muted)",
          textAlign: "right",
        }}
      >
        WINS
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          color: "var(--gm-muted)",
          textAlign: "right",
        }}
      >
        WRONG
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          color: "var(--gm-muted)",
          textAlign: "right",
        }}
      >
        WIN %
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

export default function LeaderboardPage() {
  const { address } = useAccount();
  const { leaderboard, totalPlayers, isLoading } = useLeaderboard(50);
  const { stats: myStats } = usePlayerStats(address);
  const { globalStats } = useGlobalStats();

  // Find current user's rank
  const myRank = address
    ? leaderboard.findIndex((e) => e.address.toLowerCase() === address.toLowerCase()) + 1
    : 0;

  return (
    <AppChrome>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", gap: 0, overflow: "hidden" }}>
        {/* Main content */}
        <div style={{ padding: "32px 32px 36px", overflow: "auto" }}>
          {/* Header */}
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
                Hall of spirits · {totalPlayers.toString()} players
              </div>
              <div
                className="display"
                style={{ fontSize: 46, color: "var(--gm-fg)", letterSpacing: "-0.02em", marginTop: 8 }}
              >
                <span style={{ fontStyle: "italic", color: "var(--gm-spectral)" }}>Rankings</span>
              </div>
              <div style={{ fontSize: 14, color: "var(--gm-muted)", marginTop: 6, fontStyle: "italic" }}>
                Who has whispered with the Oracle the most?
              </div>
            </div>
          </div>

          {/* Leaderboard table */}
          <div
            style={{
              border: "1px solid var(--gm-border-soft)",
              borderRadius: "var(--gm-r-md)",
              overflow: "hidden",
            }}
          >
            <TableHeader />

            {isLoading && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--gm-muted)" }}>
                <div className="mono" style={{ fontSize: 12, letterSpacing: "0.16em" }}>
                  Summoning spirits...
                </div>
              </div>
            )}

            {!isLoading && leaderboard.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 16, color: "var(--gm-fg-dim)", marginBottom: 8 }}>
                  No players yet
                </div>
                <div style={{ fontSize: 13, color: "var(--gm-muted)" }}>
                  Be the first to commune with the Oracle
                </div>
              </div>
            )}

            {!isLoading &&
              leaderboard.map((entry, idx) => (
                <LeaderboardRow
                  key={entry.address}
                  rank={idx + 1}
                  address={entry.address}
                  questionsAsked={entry.questionsAsked}
                  correctGuesses={entry.correctGuesses}
                  incorrectGuesses={entry.incorrectGuesses}
                  isCurrentUser={
                    !!address && entry.address.toLowerCase() === address.toLowerCase()
                  }
                />
              ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside
          style={{
            borderLeft: "1px solid var(--gm-border-soft)",
            padding: "28px 24px",
            overflow: "auto",
            background: "linear-gradient(180deg, oklch(0.155 0.014 264), var(--gm-bg))",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* Your Stats */}
          {address && myStats && (
            <SidePanel title="Your Stats">
              <div
                style={{
                  background: "var(--gm-surface-1)",
                  border: "1px solid var(--gm-border-soft)",
                  borderRadius: "var(--gm-r-md)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {myRank > 0 && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span
                      className="display"
                      style={{ fontSize: 36, color: "var(--gm-phosphor)" }}
                    >
                      #{myRank}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--gm-muted)", letterSpacing: "0.12em" }}
                    >
                      of {totalPlayers.toString()}
                    </span>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--gm-muted)",
                      }}
                    >
                      Questions
                    </div>
                    <div className="mono" style={{ fontSize: 20, color: "var(--gm-fg-dim)", marginTop: 4 }}>
                      {myStats.questionsAsked.toString()}
                    </div>
                  </div>
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--gm-muted)",
                      }}
                    >
                      Wins
                    </div>
                    <div className="mono" style={{ fontSize: 20, color: "var(--gm-phosphor)", marginTop: 4 }}>
                      {myStats.correctGuesses.toString()}
                    </div>
                  </div>
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--gm-muted)",
                      }}
                    >
                      Wrong Guesses
                    </div>
                    <div className="mono" style={{ fontSize: 20, color: "var(--gm-crimson)", marginTop: 4 }}>
                      {myStats.incorrectGuesses.toString()}
                    </div>
                  </div>
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--gm-muted)",
                      }}
                    >
                      Win Rate
                    </div>
                    <div className="mono" style={{ fontSize: 20, color: "var(--gm-fg-dim)", marginTop: 4 }}>
                      {myStats.correctGuesses + myStats.incorrectGuesses > BigInt(0)
                        ? Math.round(
                            (Number(myStats.correctGuesses) /
                              Number(myStats.correctGuesses + myStats.incorrectGuesses)) *
                              100
                          )
                        : 0}
                      %
                    </div>
                  </div>
                </div>
              </div>
            </SidePanel>
          )}

          {/* Connect prompt if not connected */}
          {!address && (
            <SidePanel title="Your Stats">
              <div
                style={{
                  background: "var(--gm-surface-1)",
                  border: "1px solid var(--gm-border-soft)",
                  borderRadius: "var(--gm-r-md)",
                  padding: 18,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 13, color: "var(--gm-muted)", fontStyle: "italic" }}>
                  Connect wallet to see your stats
                </div>
              </div>
            </SidePanel>
          )}

          {/* Global Stats */}
          <SidePanel title="Global Stats">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0" }}>
                <span style={{ color: "var(--gm-muted)" }}>Total Players</span>
                <span className="mono" style={{ color: "var(--gm-fg-dim)" }}>
                  {globalStats.totalPlayers.toString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0" }}>
                <span style={{ color: "var(--gm-muted)" }}>Questions Asked</span>
                <span className="mono" style={{ color: "var(--gm-fg-dim)" }}>
                  {globalStats.totalQuestions.toString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0" }}>
                <span style={{ color: "var(--gm-muted)" }}>Correct Guesses</span>
                <span className="mono" style={{ color: "var(--gm-phosphor)" }}>
                  {globalStats.totalCorrectGuesses.toString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0" }}>
                <span style={{ color: "var(--gm-muted)" }}>Wrong Guesses</span>
                <span className="mono" style={{ color: "var(--gm-crimson)" }}>
                  {globalStats.totalIncorrectGuesses.toString()}
                </span>
              </div>
            </div>
          </SidePanel>

          {/* Ranking info */}
          <SidePanel title="How Rankings Work">
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["01", "Players are ranked by wins (correct guesses) first"],
                ["02", "Ties are broken by number of questions asked"],
                ["03", "Stats update in real-time after each game action"],
              ].map(([n, t]) => (
                <li key={n} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, alignItems: "start" }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--gm-phosphor)", letterSpacing: "0.1em" }}>
                    {n}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--gm-fg-dim)", lineHeight: 1.5 }}>{t}</span>
                </li>
              ))}
            </ol>
          </SidePanel>
        </aside>
      </div>
    </AppChrome>
  );
}
