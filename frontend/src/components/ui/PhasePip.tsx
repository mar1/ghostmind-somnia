"use client";

type Phase = "Initializing" | "Active" | "Processing" | "Finished";

interface PhasePipProps {
  phase: Phase;
}

const phaseMap: Record<Phase, { c: string; label: string }> = {
  Initializing: { c: "var(--gm-spectral)", label: "Summoning" },
  Active: { c: "var(--gm-phosphor)", label: "Open" },
  Processing: { c: "var(--gm-ember)", label: "Channeling" },
  Finished: { c: "var(--gm-muted)", label: "Ended" },
};

export function PhasePip({ phase }: PhasePipProps) {
  const m = phaseMap[phase] || { c: "var(--gm-muted)", label: phase };
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 10.5,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: m.c,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: m.c,
          boxShadow: `0 0 8px ${m.c}`,
        }}
      />
      {m.label}
    </span>
  );
}
