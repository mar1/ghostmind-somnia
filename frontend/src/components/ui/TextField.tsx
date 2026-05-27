"use client";

interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  suffix?: string;
  hint?: string;
  size?: "md" | "lg";
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  suffix,
  hint,
  size = "md",
}: TextFieldProps) {
  const fs = size === "lg" ? 16 : 14;
  const h = size === "lg" ? 52 : 42;

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && (
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--gm-muted)",
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--gm-surface-1)",
          border: "1px solid var(--gm-border)",
          borderRadius: "var(--gm-r-sm)",
          height: h,
          padding: "0 14px",
        }}
      >
        <input
          className={mono ? "mono" : ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--gm-fg)",
            fontSize: fs,
            fontFamily: mono ? "var(--gm-font-mono)" : "var(--gm-font-sans)",
          }}
        />
        {suffix && (
          <span
            className="mono"
            style={{ fontSize: 12, color: "var(--gm-muted)", letterSpacing: "0.08em" }}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && <span style={{ fontSize: 12, color: "var(--gm-muted)" }}>{hint}</span>}
    </label>
  );
}
