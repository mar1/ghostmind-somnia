"use client";

import { ReactNode } from "react";

type BadgeTone = "neutral" | "phosphor" | "ember" | "spectral" | "crimson";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  mono?: boolean;
}

const tones = {
  neutral: { bg: "var(--gm-surface-2)", fg: "var(--gm-fg-dim)", bd: "var(--gm-border)" },
  phosphor: { bg: "oklch(0.88 0.17 158 / 0.10)", fg: "var(--gm-phosphor)", bd: "oklch(0.55 0.16 158 / 0.45)" },
  ember: { bg: "oklch(0.82 0.14 65 / 0.10)", fg: "var(--gm-ember)", bd: "oklch(0.55 0.13 65 / 0.45)" },
  spectral: { bg: "oklch(0.74 0.15 295 / 0.10)", fg: "var(--gm-spectral)", bd: "oklch(0.50 0.14 295 / 0.45)" },
  crimson: { bg: "oklch(0.68 0.21 22 / 0.10)", fg: "var(--gm-crimson)", bd: "oklch(0.50 0.18 22 / 0.45)" },
};

export function Badge({ children, tone = "neutral", icon, mono }: BadgeProps) {
  const t = tones[tone];
  return (
    <span
      className={mono ? "mono" : ""}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        letterSpacing: mono ? "0.08em" : "0.02em",
        textTransform: mono ? "uppercase" : "none",
        fontWeight: 500,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
