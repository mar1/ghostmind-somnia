"use client";

import { Icon } from "./Icon";

interface WordmarkProps {
  size?: number;
  sub?: boolean;
}

export function Wordmark({ size = 28, sub = false }: WordmarkProps) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.35 }}>
      <div
        style={{
          width: size * 1.15,
          height: size * 1.15,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--gm-border-strong)",
          background:
            "radial-gradient(circle at 35% 30%, var(--gm-phosphor-dim) 0%, transparent 65%), var(--gm-surface-1)",
          boxShadow: "var(--gm-glow-phosphor)",
          position: "relative",
        }}
      >
        <Icon.sigil
          width={size * 0.78}
          height={size * 0.78}
          style={{ color: "var(--gm-phosphor)" }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          className="display"
          style={{ fontSize: size, color: "var(--gm-fg)", letterSpacing: "-0.02em" }}
        >
          Ghost
          <span style={{ fontStyle: "italic", fontWeight: 300, color: "var(--gm-phosphor)" }}>
            Mind
          </span>
        </span>
        {sub && (
          <span
            className="mono"
            style={{
              fontSize: size * 0.32,
              marginTop: size * 0.18,
              color: "var(--gm-muted)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Oracle on Somnia · v2
          </span>
        )}
      </div>
    </div>
  );
}
