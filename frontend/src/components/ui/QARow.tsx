"use client";

import { Badge } from "./Badge";
import { Icon } from "./Icon";

interface QARowProps {
  idx: number;
  q: string;
  a: string;
  asker?: string;
}

export function QARow({ idx, q, a, asker }: QARowProps) {
  const yes = (a || "").toLowerCase().startsWith("y") || a === "correct";
  const isGuess = (q || "").startsWith("GUESS:");
  const isCorrect = a === "correct";
  const isIncorrect = a === "incorrect";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr auto",
        gap: 14,
        padding: "14px 16px",
        borderBottom: "1px solid var(--gm-border-soft)",
        alignItems: "start",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--gm-muted)",
          letterSpacing: "0.1em",
          paddingTop: 2,
        }}
      >
        {String(idx).padStart(2, "0")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: "var(--gm-fg)",
            display: "flex",
            gap: 8,
            alignItems: "baseline",
          }}
        >
          {isGuess && (
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                color: "var(--gm-ember)",
                textTransform: "uppercase",
              }}
            >
              Guess
            </span>
          )}
          <span>{isGuess ? q.replace(/^GUESS:\s*/, "") : q}</span>
        </div>
        {asker && (
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: "var(--gm-muted-2)",
              letterSpacing: "0.06em",
            }}
          >
            asked by {asker}
          </div>
        )}
      </div>
      <div>
        {isCorrect ? (
          <Badge tone="phosphor" mono icon={<Icon.check width={11} height={11} />}>
            correct
          </Badge>
        ) : isIncorrect ? (
          <Badge tone="crimson" mono icon={<Icon.cross width={11} height={11} />}>
            incorrect
          </Badge>
        ) : yes ? (
          <Badge tone="phosphor" mono icon={<Icon.check width={11} height={11} />}>
            yes
          </Badge>
        ) : (
          <Badge tone="neutral" mono icon={<Icon.cross width={11} height={11} />}>
            no
          </Badge>
        )}
      </div>
    </div>
  );
}
