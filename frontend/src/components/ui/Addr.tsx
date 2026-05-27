"use client";

interface AddrProps {
  value: string;
  label?: string;
}

export function Addr({ value, label }: AddrProps) {
  const short = value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--gm-fg-dim)",
        padding: "3px 8px",
        borderRadius: 6,
        background: "var(--gm-surface-2)",
        border: "1px solid var(--gm-border-soft)",
        letterSpacing: "0.04em",
      }}
    >
      {label && <span style={{ color: "var(--gm-muted)" }}>{label}</span>}
      <span>{short}</span>
    </span>
  );
}
