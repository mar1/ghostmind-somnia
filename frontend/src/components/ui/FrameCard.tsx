"use client";

import { ReactNode, CSSProperties } from "react";

interface FrameCardProps {
  children: ReactNode;
  padding?: number;
  glow?: boolean;
  style?: CSSProperties;
}

function Bracket({
  pos,
  color = "var(--gm-border-strong)",
  size = 10,
  offset = -1,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  color?: string;
  size?: number;
  offset?: number;
}) {
  const posStyles: Record<string, CSSProperties> = {
    tl: { top: offset, left: offset },
    tr: { top: offset, right: offset },
    bl: { bottom: offset, left: offset },
    br: { bottom: offset, right: offset },
  };

  const borderMap: Record<string, CSSProperties> = {
    tl: { borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` },
    tr: { borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` },
    bl: { borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` },
    br: { borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` },
  };

  return (
    <span
      style={{
        position: "absolute",
        width: size,
        height: size,
        ...posStyles[pos],
        ...borderMap[pos],
      }}
    />
  );
}

export function FrameCard({ children, padding = 22, glow, style }: FrameCardProps) {
  return (
    <div
      style={{
        position: "relative",
        background: "var(--gm-surface-1)",
        border: "1px solid var(--gm-border-soft)",
        borderRadius: "var(--gm-r-md)",
        padding,
        boxShadow: glow
          ? "0 0 0 1px oklch(0.55 0.16 158 / 0.25), 0 0 32px -8px oklch(0.55 0.16 158 / 0.3)"
          : "none",
        ...style,
      }}
    >
      <Bracket pos="tl" />
      <Bracket pos="tr" />
      <Bracket pos="bl" />
      <Bracket pos="br" />
      {children}
    </div>
  );
}
