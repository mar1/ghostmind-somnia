"use client";

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
}

export function Stat({ label, value, unit, tone }: StatProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--gm-muted)",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          className="display"
          style={{
            fontSize: 30,
            color: tone || "var(--gm-fg)",
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--gm-muted)", letterSpacing: "0.08em" }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
