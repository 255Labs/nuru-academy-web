"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Play, RotateCcw,
  Flame, Zap, Coins as CoinsIcon,
} from "lucide-react";
import {
  BAOBAB_FOREST_MAP, BaobabForestRenderer, parseCommands, runProgram, TILE_SIZE,
} from "@/game/codeConsoleEngine.js";
import { NuruMoodImg } from "./NuruMoodImg";

const DEFAULT_SCRIPT = `# Write your commands below
moveRight()
moveRight()
attack()
moveDown()
moveDown()
moveRight()
collect()`;

const CANVAS_W = BAOBAB_FOREST_MAP.width * TILE_SIZE;
const CANVAS_H = BAOBAB_FOREST_MAP.height * TILE_SIZE;

export function CodeConsoleGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<InstanceType<typeof BaobabForestRenderer> | null>(null);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [history, setHistory] = useState<ReturnType<typeof runProgram>["history"]>([{
    player: { ...BAOBAB_FOREST_MAP.playerStart, facing: "down" },
    enemies: BAOBAB_FOREST_MAP.enemies.map((e: { id: string; x: number; y: number; hp: number }) => ({ ...e, defeated: false })),
    gemCollected: false,
    narration: "Ready. Press Run to begin.",
    ok: true,
  }]);
  const [result, setResult] = useState<ReturnType<typeof runProgram>["result"] | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [outputLines, setOutputLines] = useState<string[]>(["> Ready. Press Run to begin."]);

  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new BaobabForestRenderer(canvasRef.current, {
      chipukizi: "/game/chipukizi.png",
      doubt: "/game/doubt.png",
    });
    let animId: number;
    const raf = () => {
      rendererRef.current?.render(BAOBAB_FOREST_MAP, history[step]);
      animId = requestAnimationFrame(raf);
    };
    animId = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.render(BAOBAB_FOREST_MAP, history[step]);
  }, [step, history]);

  function handleRun() {
    const commands = parseCommands(script);
    const { history: newHistory, result: newResult } = runProgram(BAOBAB_FOREST_MAP, commands);
    setHistory(newHistory);
    setResult(newResult);
    setOutputLines(["> Running your code..."]);
    setStep(0);
    setPlaying(true);

    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= newHistory.length) {
        clearInterval(interval);
        setPlaying(false);
        return;
      }
      setStep(i);
      setOutputLines((lines) => [...lines, newHistory[i].narration]);
    }, 550);
  }

  function handleReset() {
    setHistory([{
      player: { ...BAOBAB_FOREST_MAP.playerStart, facing: "down" as const },
      enemies: BAOBAB_FOREST_MAP.enemies.map((e: { id: string; x: number; y: number; hp: number }) => ({ ...e, defeated: false })),
      gemCollected: false,
      narration: "Ready. Press Run to begin.",
      ok: true,
    }]);
    setResult(null);
    setStep(0);
    setPlaying(false);
    setOutputLines(["> Ready. Press Run to begin."]);
  }

  const totalDefeated = history[step]?.enemies.filter((e: { defeated: boolean }) => e.defeated).length ?? 0;
  const gemDone = history[step]?.gemCollected ?? false;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_260px] gap-4">
      {/* Left panel */}
      <div className="flex flex-col gap-3">
        <div className="bg-nuru-ink text-white rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <NuruMoodImg mood="helping" size={44} className="rounded-xl" />
            <div>
              <div className="font-bold text-sm">Chipukizi</div>
              <div className="text-[11px] text-white/60">The Young Explorer</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-white/60">LEVEL <span className="text-white font-bold">8</span></div>
          <div className="h-1.5 rounded-full bg-white/15 mt-1 overflow-hidden">
            <div className="h-full bg-nuru-purple" style={{ width: "42%" }} />
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-white/60">
            <Zap size={12} className="text-nuru-gold" /> ENERGY <span className="text-white font-bold ml-auto">80/100</span>
          </div>
        </div>

        <div className="bg-nuru-card border border-nuru-line rounded-2xl p-4">
          <div className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase mb-2">Mission objective</div>
          <p className="text-sm text-nuru-ink2 leading-snug mb-3">Defeat the Shadow Bots by using the right commands.</p>
          <div className="flex flex-col gap-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" readOnly checked={totalDefeated >= 2} className="accent-nuru-purple" />
              Defeat all enemies <span className="ml-auto text-nuru-muted text-xs">{totalDefeated}/2</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" readOnly checked={gemDone} className="accent-nuru-purple" />
              Collect the code gem <span className="ml-auto text-nuru-muted text-xs">{gemDone ? 1 : 0}/1</span>
            </label>
          </div>
        </div>

        <div className="bg-nuru-card border border-nuru-line rounded-2xl p-4">
          <div className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase mb-2">Controls guide</div>
          <div className="flex flex-col gap-1 text-[13px] font-mono text-nuru-ink2">
            {["moveUp()", "moveDown()", "moveLeft()", "moveRight()", "attack()", "collect()"].map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Center: game view */}
      <div className="flex flex-col gap-3">
        <div className="bg-nuru-card border border-nuru-line rounded-2xl p-3">
          <div className="flex items-start gap-3 mb-3">
            <NuruMoodImg mood="excited" size={44} />
            <div className="bg-nuru-lav rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] text-nuru-ink2 leading-snug">
              Shadow bots are blocking the path! Use your commands to defeat them and collect the Code Gem.
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border-2 border-nuru-line mx-auto" style={{ width: CANVAS_W, maxWidth: "100%" }}>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ width: "100%", height: "auto" }} />
          </div>
        </div>

        <div className="bg-nuru-card border border-nuru-line rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase">Command console</div>
            <div className="flex gap-2">
              <button
                onClick={handleRun}
                disabled={playing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nuru-green text-white text-xs font-bold disabled:opacity-50"
              >
                <Play size={12} fill="white" /> Run
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nuru-purple text-white text-xs font-bold"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            spellCheck={false}
            rows={8}
            className="w-full bg-nuru-ink text-green-400 font-mono text-[13px] rounded-xl p-3 leading-relaxed resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-nuru-ink text-white rounded-2xl p-3 h-40 overflow-y-auto">
            <div className="text-[11px] font-bold tracking-wide text-white/50 uppercase mb-1.5">Output</div>
            {outputLines.map((line, i) => (
              <div key={i} className="text-[12px] font-mono text-green-400 leading-relaxed">{line}</div>
            ))}
          </div>
          <div className="bg-nuru-card border border-nuru-line rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase">Visual execution</div>
              <span className="text-[11px] font-bold text-nuru-ink2">Step {step}/{history.length - 1}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <button onClick={() => setStep(0)} disabled={playing} className="p-1.5 rounded-lg bg-nuru-bg disabled:opacity-40"><ChevronFirst size={14} /></button>
              <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={playing} className="p-1.5 rounded-lg bg-nuru-bg disabled:opacity-40"><ChevronLeft size={14} /></button>
              <button onClick={() => setStep((s) => Math.min(history.length - 1, s + 1))} disabled={playing} className="p-1.5 rounded-lg bg-nuru-bg disabled:opacity-40"><ChevronRight size={14} /></button>
              <button onClick={() => setStep(history.length - 1)} disabled={playing} className="p-1.5 rounded-lg bg-nuru-bg disabled:opacity-40"><ChevronLast size={14} /></button>
            </div>
            <p className="text-[12px] text-nuru-muted text-center mt-2 leading-snug">{history[step]?.narration}</p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-col gap-3">
        <div className="bg-nuru-card border border-nuru-line rounded-2xl p-4">
          <div className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase mb-2">Tasks</div>
          <div className="flex flex-col gap-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" readOnly checked={totalDefeated >= 2} className="accent-nuru-purple" />
              Defeat all Shadow Bots <span className="ml-auto text-nuru-muted text-xs">{totalDefeated}/2</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" readOnly checked={gemDone} className="accent-nuru-purple" />
              Collect the Code Gem <span className="ml-auto text-nuru-muted text-xs">{gemDone ? 1 : 0}/1</span>
            </label>
          </div>
        </div>
        <div className="bg-nuru-card border border-nuru-line rounded-2xl p-4">
          <div className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase mb-2">World story</div>
          <p className="text-[13px] text-nuru-ink2 leading-relaxed">
            The Baobab Forest was once a place of wisdom and balance. But the Shadow Bots corrupted its logic. Help restore the path of knowledge.
          </p>
        </div>
        {result?.complete && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <div className="font-bold text-sm text-nuru-greenDeep">Chapter complete!</div>
            <div className="text-xs text-nuru-greenDeep/80 mt-1">All Shadow Bots defeated, Code Gem collected.</div>
          </div>
        )}
      </div>

      <div className="xl:col-span-3 flex items-center gap-4 bg-nuru-card border border-nuru-line rounded-2xl px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-nuru-ink">
          <Flame size={14} className="text-nuru-gold" /> 7 day streak
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-nuru-ink">
          <CoinsIcon size={14} className="text-nuru-gold" /> +35 lesson XP
        </div>
        <div className="flex-1" />
        <span className="text-xs text-nuru-muted">Level progress</span>
        <div className="w-28 h-1.5 rounded-full bg-nuru-lav overflow-hidden">
          <div className="h-full bg-nuru-purple" style={{ width: "42%" }} />
        </div>
        <span className="text-xs font-bold text-nuru-ink">42%</span>
      </div>
    </div>
  );
}
