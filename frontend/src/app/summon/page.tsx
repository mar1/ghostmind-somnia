"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import { useAccount, useReadContract, useChainId } from "wagmi";
import { AppChrome } from "@/components/AppChrome";
import { Button, TextField, Icon, Badge, GhostOrb, FrameCard } from "@/components/ui";
import { useCreateGame } from "@/hooks";
import { Difficulty, LLM_DEPOSIT, ghostMindAbi, getContractAddress } from "@/contracts";

const difficultyOptions = [
  {
    key: Difficulty.Easy,
    title: "Easy",
    desc: "Very famous people everyone knows (celebrities, world leaders).",
  },
  {
    key: Difficulty.Medium,
    title: "Medium",
    desc: "Moderately famous, known in their field but not household names.",
  },
  {
    key: Difficulty.Hard,
    title: "Hard",
    desc: "Obscure or lesser-known historical figures.",
  },
];

function CostRow({
  label,
  v,
  muted,
  total,
  mono,
}: {
  label: string;
  v: string;
  muted?: string;
  total?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0" }}>
      <div>
        <span
          style={{
            fontSize: total ? 14 : 12.5,
            color: total ? "var(--gm-fg)" : "var(--gm-fg-dim)",
            fontWeight: total ? 500 : 400,
          }}
        >
          {label}
        </span>
        {muted && (
          <span style={{ fontSize: 11, color: "var(--gm-muted-2)", marginLeft: 8, fontStyle: "italic" }}>{muted}</span>
        )}
      </div>
      <span
        className={mono || total ? "mono" : ""}
        style={{
          fontSize: total ? 17 : 13.5,
          color: total ? "var(--gm-ember)" : "var(--gm-fg-dim)",
          letterSpacing: "0.02em",
        }}
      >
        {v === "—" ? "—" : `${v} STT`}
      </span>
    </div>
  );
}

export default function SummonPage() {
  const router = useRouter();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const { isConnected } = useAccount();
  const { data: gameCounter } = useReadContract({
    address: contractAddress,
    abi: ghostMindAbi,
    functionName: "gameCounter",
  });
  const nextGameId = gameCounter !== undefined ? gameCounter + BigInt(1) : BigInt(1);
  const [poolSeed, setPoolSeed] = useState("2.40");
  const [questionFee, setQuestionFee] = useState("0.18");
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Easy);

  const { createGame, isPending, isConfirming, isSuccess, error } = useCreateGame();

  const totalCost = (parseFloat(poolSeed) + LLM_DEPOSIT).toFixed(2);

  const handleSubmit = () => {
    if (!isConnected) return;

    const gameFee = parseEther(questionFee);
    const potSeed = parseEther(poolSeed);

    createGame(gameFee, difficulty, potSeed);
  };

  // Redirect to lobby on success
  useEffect(() => {
    if (isSuccess) {
      router.push("/");
    }
  }, [isSuccess, router]);

  const isLoading = isPending || isConfirming;

  return (
    <AppChrome>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.05fr 0.95fr", overflow: "hidden" }}>
        {/* Form column */}
        <div style={{ padding: "40px 56px", overflow: "auto" }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "var(--gm-phosphor)",
            }}
          >
            New round · Game master
          </div>
          <div
            className="display"
            style={{ fontSize: 54, color: "var(--gm-fg)", letterSpacing: "-0.025em", marginTop: 8, lineHeight: 1.05 }}
          >
            Summon a <span style={{ fontStyle: "italic", color: "var(--gm-spectral)" }}>séance</span>.
          </div>
          <div
            style={{
              fontSize: 14.5,
              color: "var(--gm-muted)",
              marginTop: 10,
              maxWidth: 520,
              lineHeight: 1.55,
              fontStyle: "italic",
            }}
          >
            Seed a pot. Set a price for each question. The Oracle will pick a famous figure in secret and answer until
            someone names them correctly.
          </div>

          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 22, maxWidth: 560 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <TextField
                label="Prize pool seed"
                value={poolSeed}
                onChange={setPoolSeed}
                mono
                suffix="STT"
                hint="Initial reward — grows with every paid question."
              />
              <TextField
                label="Fee per question"
                value={questionFee}
                onChange={setQuestionFee}
                mono
                suffix="STT"
                hint="Each ask costs fee + 0.24 oracle deposit."
              />
            </div>

            {/* Difficulty selector */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div
                  className="mono"
                  style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gm-muted)" }}
                >
                  Difficulty
                </div>
                <Badge tone="phosphor" mono icon={<Icon.check width={10} height={10} />}>
                  v2 · enum
                </Badge>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {difficultyOptions.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setDifficulty(o.key)}
                    disabled={isLoading}
                    style={{
                      border: `1px solid ${difficulty === o.key ? "var(--gm-phosphor)" : "var(--gm-border-soft)"}`,
                      background: difficulty === o.key ? "oklch(0.88 0.17 158 / 0.08)" : "var(--gm-surface-1)",
                      borderRadius: "var(--gm-r-sm)",
                      padding: "14px 14px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      textAlign: "left",
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 14,
                          color: difficulty === o.key ? "var(--gm-phosphor)" : "var(--gm-fg-dim)",
                          fontWeight: 500,
                        }}
                      >
                        {o.title}
                      </span>
                      {difficulty === o.key && <Icon.check width={14} height={14} style={{ color: "var(--gm-phosphor)" }} />}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--gm-muted)", lineHeight: 1.4 }}>{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hint */}
            <div
              style={{
                display: "flex",
                gap: 14,
                padding: "14px 16px",
                border: "1px dashed var(--gm-border)",
                borderRadius: "var(--gm-r-sm)",
                background: "oklch(0.74 0.15 295 / 0.05)",
              }}
            >
              <Icon.moon width={18} height={18} style={{ color: "var(--gm-spectral)", flex: "none", marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: "var(--gm-fg-dim)", lineHeight: 1.5 }}>
                Every question, answer, and wrong guess is public on-chain. The character&apos;s name is the only secret.{" "}
                <span style={{ color: "var(--gm-muted)", fontStyle: "italic" }}>That is the game.</span>
              </div>
            </div>

            {/* Cost breakdown */}
            <div
              style={{
                background: "var(--gm-surface-1)",
                border: "1px solid var(--gm-border-soft)",
                borderRadius: "var(--gm-r-md)",
                padding: 20,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: "var(--gm-muted)",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Cost breakdown
              </div>
              <CostRow label="Oracle init deposit" v={LLM_DEPOSIT.toString()} muted="returned to validators" />
              <CostRow label="Prize pool seed" v={poolSeed} muted="to the pot" />
              <CostRow label="Protocol fee" v="—" muted="3% taken from winner's pot" />
              <div style={{ height: 1, background: "var(--gm-border-soft)", margin: "10px 0" }} />
              <CostRow label="You'll send" v={totalCost} total mono />
            </div>

            {/* Error display */}
            {error && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "oklch(0.68 0.21 22 / 0.1)",
                  border: "1px solid var(--gm-crimson)",
                  borderRadius: "var(--gm-r-sm)",
                  color: "var(--gm-crimson)",
                  fontSize: 13,
                }}
              >
                {error.message || "Transaction failed"}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Button
                variant="primary"
                size="lg"
                icon={<Icon.flame width={16} height={16} />}
                onClick={handleSubmit}
                disabled={!isConnected || isLoading}
                style={{ opacity: !isConnected || isLoading ? 0.6 : 1 }}
              >
                {isLoading
                  ? isPending
                    ? "Confirm in wallet..."
                    : "Summoning..."
                  : isConnected
                    ? "Summon the Oracle"
                    : "Connect wallet first"}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => router.push("/")} disabled={isLoading}>
                Cancel
              </Button>
            </div>
            <div style={{ fontSize: 12, color: "var(--gm-muted-2)", maxWidth: 480, lineHeight: 1.5 }}>
              The contract sends {LLM_DEPOSIT} STT to the Somnia agent. It calls the{" "}
              <span className="mono" style={{ color: "var(--gm-phosphor)" }}>
                MCP server
              </span>{" "}
              which picks a character and responds{" "}
              <span className="mono" style={{ color: "var(--gm-phosphor)" }}>
                ready
              </span>{" "}
              — the name never appears on-chain.
            </div>
          </div>
        </div>

        {/* Preview column */}
        <aside
          style={{
            borderLeft: "1px solid var(--gm-border-soft)",
            background: "linear-gradient(180deg, oklch(0.17 0.02 264) 0%, var(--gm-bg) 100%)",
            padding: "40px 36px",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            className="mono"
            style={{ fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gm-muted)" }}
          >
            Oracle, prepared
          </div>

          <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 18px" }}>
            <GhostOrb size={210} state={isLoading ? "thinking" : "ready"} label={isLoading ? "summoning..." : "awaiting summons"} />
          </div>

          {/* MCP privacy architecture info */}
          <FrameCard padding={18}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gm-muted)",
                marginBottom: 10,
              }}
            >
              Privacy · MCP Architecture
            </div>
            <pre
              className="mono"
              style={{
                margin: 0,
                fontSize: 11.5,
                color: "var(--gm-fg-dim)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {`Game #${nextGameId}

The Oracle picks a character and stores
it privately on the MCP server.

All on-chain responses are limited to:
  → "ready" (game initialized)
  → "yes" / "no" (question answers)
  → "correct" / "incorrect" (guesses)

The character name never appears
in any transaction or receipt.`}
            </pre>
          </FrameCard>

          <div>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--gm-muted)",
                marginBottom: 12,
              }}
            >
              House rules
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "The character's name is never written on-chain.",
                "Each question costs a fee that grows the pot.",
                "Wrong guesses cost a fee and feed the pot.",
                "Correct guess wins pot minus 3% offering.",
              ].map((t) => (
                <li
                  key={t}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "14px 1fr",
                    gap: 10,
                    alignItems: "start",
                    fontSize: 13,
                    color: "var(--gm-fg-dim)",
                  }}
                >
                  <Icon.star width={11} height={11} style={{ color: "var(--gm-phosphor)", marginTop: 4 }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </AppChrome>
  );
}
