"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import { GhostOrb } from "@/components/ui";
import { useActiveGames } from "@/hooks";
import { GamePhase } from "@/contracts";

export default function ActiveRoundPage() {
  const router = useRouter();
  const { games, isLoading } = useActiveGames(20);

  useEffect(() => {
    if (isLoading) return;

    const active =
      games.find((g) => g.phase === GamePhase.Active || g.phase === GamePhase.Processing) ??
      games.find((g) => g.phase === GamePhase.Initializing);

    if (active) {
      router.replace(`/game/${active.gameId}`);
      return;
    }

    router.replace("/");
  }, [games, isLoading, router]);

  return (
    <AppChrome>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <GhostOrb size={120} state="thinking" label="finding round..." />
        </div>
      </div>
    </AppChrome>
  );
}
