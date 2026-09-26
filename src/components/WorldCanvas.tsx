"use client";

import { useEffect, useRef, useState } from "react";
import { WorldEngine, WELCOME_CAMP_MAP } from "@/game/engine.js";
import { MissionQuestModal } from "./MissionQuestModal";
import { NuruMoodImg } from "./NuruMoodImg";
import { useGameStore } from "@/lib/store";
import { TRACKS } from "@/data/curriculum";

const CANVAS_W = WELCOME_CAMP_MAP.width * 48;
const CANVAS_H = WELCOME_CAMP_MAP.height * 48;
const FADE_MS = 260;

interface NPCLine { name: string; lines: string[] }

/**
 * Mounts the plain-JS WorldEngine on a <canvas> and bridges it to the rest
 * of the app: walking into an enemy tile pauses the overworld and opens
 * the same MissionQuestModal → BattleTrial → battle_start/battle_answer/
 * battle_finish pipeline already built and tested for Mission Quests.
 * Nothing about the battle backend is different here — this is the
 * overworld shell around the existing, real system, not a new one.
 *
 * Also wires a proximity-based NPC interaction (walk up, press E) and a
 * short fade transition into/out of battle, so encounters don't just pop
 * a modal open with no visual handoff.
 */
export function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const [encounterKey, setEncounterKey] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [nearNPC, setNearNPC] = useState<NPCLine | null>(null);
  const [dialogue, setDialogue] = useState<{ npc: NPCLine; lineIdx: number } | null>(null);

  const activeTrack = useGameStore((s) => s.activeTrack);
  const activeModuleIdx = useGameStore((s) => s.activeModuleIdx[activeTrack]);
  const passMission = useGameStore((s) => s.passMission);
  const addXP = useGameStore((s) => s.addXP);
  const addCoins = useGameStore((s) => s.addCoins);

  const track = TRACKS.find((t) => t.id === activeTrack)!;
  const mod = track.modules[activeModuleIdx];

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new WorldEngine(canvasRef.current, {
      map: WELCOME_CAMP_MAP,
      spriteUrls: { chipukizi: "/game/chipukizi.png", doubt: "/game/doubt.png" },
      onEncounter: (key: string) => {
        setEncounterKey(key);
        setFading(true);
        setTimeout(() => setShowModal(true), FADE_MS);
      },
      onNearNPC: (npc: NPCLine | null) => setNearNPC(npc),
      onInteract: (npc: NPCLine) => {
        engineRef.current?.openDialogue();
        setDialogue({ npc, lineIdx: 0 });
      },
    });
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

  function closeBattle(passed: boolean, pct?: number) {
    setShowModal(false);
    setTimeout(() => {
      engineRef.current?.resolveEncounter(encounterKey!, passed);
      setEncounterKey(null);
      setFading(false);
      if (passed && pct !== undefined) {
        passMission(activeTrack, mod.id, pct);
        addXP(500);
        addCoins(250);
      }
    }, FADE_MS);
  }

  function advanceDialogue() {
    if (!dialogue) return;
    const next = dialogue.lineIdx + 1;
    if (next < dialogue.npc.lines.length) {
      setDialogue({ ...dialogue, lineIdx: next });
    } else {
      setDialogue(null);
      engineRef.current?.closeDialogue();
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 text-center">
        <div className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase">Region 1</div>
        <h2 className="font-display font-bold text-xl text-nuru-ink">Welcome Camp</h2>
        <p className="text-sm text-nuru-muted mt-1">
          Arrow keys or WASD to move, E to talk. Walk into Doubt to begin a Trial of Light.
        </p>
      </div>

      <div className="relative rounded-2xl2 overflow-hidden border-4 border-nuru-card shadow-pop" style={{ width: CANVAS_W, height: CANVAS_H }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />

        {/* Fade-to-dark transition between exploring and battling */}
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: fading ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
        />

        {/* "Press E to talk" prompt while adjacent to an NPC, hidden once dialogue is open */}
        {nearNPC && !dialogue && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-nuru-ink text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            Press E to talk to the {nearNPC.name}
          </div>
        )}

        {/* NPC dialogue box */}
        {dialogue && (
          <div
            onClick={advanceDialogue}
            className="absolute inset-x-3 bottom-3 bg-white rounded-xl shadow-2xl p-4 cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <NuruMoodImg mood="helping" size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-nuru-purple uppercase tracking-wide mb-1">
                  {dialogue.npc.name}
                </div>
                <p className="text-sm text-nuru-ink leading-relaxed">{dialogue.npc.lines[dialogue.lineIdx]}</p>
                <div className="text-[10px] text-nuru-muted mt-1.5">Click to continue</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && mod.quiz && (
        <MissionQuestModal
          quiz={mod.quiz}
          moduleId={`${activeTrack}:${mod.id}`}
          tone={track.tone}
          weekLabel={`Week ${mod.week}`}
          onClose={() => closeBattle(false)}
          onFinish={(passed, pct) => closeBattle(passed, pct)}
        />
      )}
    </div>
  );
}
