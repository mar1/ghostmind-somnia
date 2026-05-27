"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ember" | "ghost" | "quiet" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  full?: boolean;
}

const sizes = {
  sm: { padding: "8px 14px", fontSize: 13, height: 32 },
  md: { padding: "11px 18px", fontSize: 14, height: 40 },
  lg: { padding: "14px 22px", fontSize: 15, height: 48 },
};

const variants = {
  primary: {
    background: "var(--gm-phosphor)",
    color: "oklch(0.18 0.04 158)",
    border: "1px solid oklch(0.78 0.16 158)",
    boxShadow: "var(--gm-glow-phosphor)",
    fontWeight: 600,
  },
  ember: {
    background: "var(--gm-ember)",
    color: "oklch(0.20 0.05 65)",
    border: "1px solid oklch(0.72 0.14 65)",
    boxShadow: "var(--gm-glow-ember)",
    fontWeight: 600,
  },
  ghost: {
    background: "transparent",
    color: "var(--gm-fg)",
    border: "1px solid var(--gm-border)",
  },
  quiet: {
    background: "var(--gm-surface-2)",
    color: "var(--gm-fg)",
    border: "1px solid var(--gm-border-soft)",
  },
  danger: {
    background: "transparent",
    color: "var(--gm-crimson)",
    border: "1px solid oklch(0.45 0.16 22)",
  },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  full,
  style,
  ...rest
}: ButtonProps) {
  const s = sizes[size];
  const v = variants[variant];

  return (
    <button
      {...rest}
      style={{
        ...v,
        padding: s.padding,
        fontSize: s.fontSize,
        height: s.height,
        borderRadius: "var(--gm-r-sm)",
        fontFamily: "var(--gm-font-sans)",
        letterSpacing: "0.005em",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
        width: full ? "100%" : undefined,
        transition: "transform .12s ease, filter .12s ease",
        ...style,
      }}
    >
      {icon && <span style={{ display: "inline-flex", color: "currentColor" }}>{icon}</span>}
      <span>{children}</span>
      {iconRight && <span style={{ display: "inline-flex", color: "currentColor" }}>{iconRight}</span>}
    </button>
  );
}
