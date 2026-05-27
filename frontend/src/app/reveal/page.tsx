"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import { GhostOrb } from "@/components/ui";
import { useFinishedGames } from "@/hooks";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

export default function RevealIndexPage() {
  const router = useRouter();
  const { games, isLoading } = useFinishedGames(20);

  useEffect(() => {
    if (isLoading) return;

    const withWinner = games.find((g) => g.winner !== ZERO_ADDR);
    const latest = withWinner ?? games[0];

    if (latest) {
      router.replace(`/reveal/${latest.gameId}`);
      return;
    }

    router.replace("/");
  }, [games, isLoading, router]);

  return (
    <AppChrome>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <GhostOrb size={120} state="revealing" label="finding reveal..." />
        </div>
      </div>
    </AppChrome>
  );
}
