"use client";

import { useId } from "react";

type OrbState = "ready" | "thinking" | "answered-yes" | "answered-no" | "revealing";

interface GhostOrbProps {
  size?: number;
  state?: OrbState;
  label?: string;
  animate?: boolean;
}

const palette: Record<OrbState, string> = {
  ready: "var(--gm-phosphor)",
  thinking: "var(--gm-spectral)",
  "answered-yes": "var(--gm-phosphor)",
  "answered-no": "var(--gm-crimson)",
  revealing: "var(--gm-ember)",
};

export function GhostOrb({ size = 160, state = "ready", label, animate = true }: GhostOrbProps) {
  const c = palette[state];
  const gid = useId().replace(/:/g, "");

  const haloClass = !animate
    ? ""
    : state === "revealing" || state === "thinking"
      ? "gm-orb-halo-strong"
      : "gm-orb-halo";
  const ringSlowClass = animate ? "gm-orb-ring-slow" : "";
  const ringFastClass = animate ? "gm-orb-ring-fast" : "";
  const bobClass = animate ? "gm-orb-bob" : "";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* outer halo — breathing */}
      <div
        className={haloClass}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${c} 0%, transparent 62%)`,
        }}
      />

      {/* one-time flash on state change */}
      {animate && (state === "answered-yes" || state === "answered-no" || state === "revealing") && (
        <div
          key={state + "-flash"}
          className="gm-orb-flash"
          style={{
            position: "absolute",
            inset: "15%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${c} 0%, transparent 60%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* rings + face */}
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <radialGradient id={`orb-${gid}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={c} stopOpacity="0.85" />
            <stop offset="55%" stopColor={c} stopOpacity="0.15" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* outer dotted ring — slow rotation */}
        <g className={ringSlowClass}>
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="none"
            stroke={c}
            strokeOpacity="0.18"
            strokeWidth="0.6"
            strokeDasharray="2 6"
          />
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a} 100 100)`}>
              <circle cx="100" cy="14" r="1.6" fill={c} />
            </g>
          ))}
        </g>

        {/* middle ring — counter-rotation */}
        <g className={ringFastClass}>
          <circle
            cx="100"
            cy="100"
            r="74"
            fill="none"
            stroke={c}
            strokeOpacity="0.32"
            strokeWidth="0.6"
            strokeDasharray="1 4"
          />
        </g>

        {/* solid inner ring + gradient core */}
        <g className={bobClass}>
          <circle cx="100" cy="100" r="56" fill="none" stroke={c} strokeOpacity="0.55" strokeWidth="0.8" />
          <circle cx="100" cy="100" r="56" fill={`url(#orb-${gid})`} />

          {state === "thinking" ? (
            <g>
              <circle className={animate ? "gm-orb-think-d1" : ""} cx="84" cy="100" r="2.6" fill={c} />
              <circle className={animate ? "gm-orb-think-d2" : ""} cx="100" cy="100" r="2.6" fill={c} />
              <circle className={animate ? "gm-orb-think-d3" : ""} cx="116" cy="100" r="2.6" fill={c} />
            </g>
          ) : state === "answered-no" ? (
            <g stroke={c} strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M88 92l8 8M96 92l-8 8" />
              <path d="M112 92l-8 8M104 92l8 8" />
            </g>
          ) : (
            <g fill={c}>
              <ellipse className={animate ? "gm-orb-blink" : ""} cx="88" cy="98" rx="3" ry="4.5" />
              <ellipse className={animate ? "gm-orb-blink delay" : ""} cx="112" cy="98" rx="3" ry="4.5" />
            </g>
          )}
        </g>
      </svg>

      {label && (
        <div
          className="mono"
          style={{
            position: "absolute",
            bottom: -22,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: c,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
