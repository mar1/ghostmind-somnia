"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wordmark, Badge, Icon } from "./ui";

interface AppChromeProps {
  children: ReactNode;
}

const tabs = [
  { name: "Séance Hall", href: "/" },
  { name: "Summon", href: "/summon" },
  { name: "Reveals", href: "/reveal" },
  { name: "Rankings", href: "/leaderboard" },
];

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "var(--gm-bg)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top nav */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: "1px solid var(--gm-border-soft)",
          background: "linear-gradient(to bottom, oklch(0.16 0.014 264), var(--gm-bg))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Wordmark size={22} />
          </Link>
          <nav style={{ display: "flex", gap: 6 }}>
            {tabs.map((t) => {
              const isActive =
                t.href === "/"
                  ? pathname === "/"
                  : pathname === t.href || pathname.startsWith(`${t.href}/`);
              return (
                <Link
                  key={t.name}
                  href={t.href}
                  style={{
                    fontSize: 13,
                    padding: "7px 12px",
                    borderRadius: 6,
                    color: isActive ? "var(--gm-fg)" : "var(--gm-muted)",
                    background: isActive ? "var(--gm-surface-2)" : "transparent",
                    border: isActive ? "1px solid var(--gm-border)" : "1px solid transparent",
                    letterSpacing: "0.01em",
                    textDecoration: "none",
                  }}
                >
                  {t.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--gm-muted)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Somnia · testnet
          </span>
          <span style={{ width: 1, height: 18, background: "var(--gm-border)" }} />
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: {
                      opacity: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          style={{
                            background: "var(--gm-phosphor)",
                            color: "oklch(0.18 0.04 158)",
                            border: "1px solid oklch(0.78 0.16 158)",
                            padding: "8px 16px",
                            borderRadius: "var(--gm-r-sm)",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Connect Wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          style={{
                            background: "var(--gm-crimson)",
                            color: "white",
                            border: "none",
                            padding: "8px 16px",
                            borderRadius: "var(--gm-r-sm)",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          Wrong network
                        </button>
                      );
                    }

                    return (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {account.displayBalance && (
                          <Badge tone="phosphor" mono icon={<Icon.flame width={11} height={11} />}>
                            {account.displayBalance}
                          </Badge>
                        )}
                        <button
                          onClick={openAccountModal}
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
                            cursor: "pointer",
                          }}
                        >
                          {account.displayName}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
