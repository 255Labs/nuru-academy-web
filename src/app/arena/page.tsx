"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { DuelLobby } from "@/components/duels/DuelLobby";
import { DuelWaitingRoom } from "@/components/duels/DuelWaitingRoom";
import { DuelRunner } from "@/components/duels/DuelRunner";
import { DuelResults } from "@/components/duels/DuelResults";

type Stage =
  | { name: "lobby" }
  | { name: "waiting"; roomId: string; quizId: string }
  | { name: "racing"; roomId: string; quizId: string }
  | { name: "results"; roomId: string };

export default function ArenaPage() {
  const [stage, setStage] = useState<Stage>({ name: "lobby" });
  const [lastMode, setLastMode] = useState<"1v1" | "group">("1v1");

  return (
    <Shell>
      <TopBar title="Arena" subtitle="Live runner duels — race a friend or a stranger through real questions." />

      {stage.name === "lobby" && (
        <DuelLobby
          onEnterRoom={(roomId, quizId, mode) => {
            setLastMode(mode);
            setStage({ name: "waiting", roomId, quizId });
          }}
        />
      )}

      {stage.name === "waiting" && (
        <DuelWaitingRoom
          roomId={stage.roomId}
          quizId={stage.quizId}
          mode={lastMode}
          onMatched={(roomId) => setStage({ name: "racing", roomId, quizId: stage.quizId })}
          onCancel={() => setStage({ name: "lobby" })}
        />
      )}

      {stage.name === "racing" && (
        <DuelRunner
          roomId={stage.roomId}
          quizId={stage.quizId}
          onFinished={() => setStage({ name: "results", roomId: stage.roomId })}
        />
      )}

      {stage.name === "results" && (
        <DuelResults roomId={stage.roomId} onRematch={() => setStage({ name: "lobby" })} />
      )}
    </Shell>
  );
}
