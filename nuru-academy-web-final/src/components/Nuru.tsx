"use client";

export type NuruMood = "idle" | "wave" | "cheer" | "think";

interface NuruProps {
  size?: number;
  mood?: NuruMood;
  className?: string;
}

/**
 * Nuru mascot — always uses the sprite sheet (/nuru/sprites.png).
 * The sprite sheet is preloaded in layout.tsx so it is always instant.
 *
 * Sprite sheet: 7 columns × 4 rows (669×373 px)
 *   idle  → row 0, col 0
 *   wave  → row 1, col 5
 *   cheer → row 2, col 2
 *   think → row 3, col 6
 */
const SPRITE: Record<NuruMood, { col: number; row: number }> = {
  idle:  { col: 0, row: 0 },
  wave:  { col: 5, row: 1 },
  cheer: { col: 2, row: 2 },
  think: { col: 6, row: 3 },
};
const COLS = 7;
const ROWS = 4;

export function Nuru({ size = 72, mood = "idle", className = "" }: NuruProps) {
  const { col, row } = SPRITE[mood];
  const posX = (col / (COLS - 1)) * 100;
  const posY = (row / (ROWS - 1)) * 100;

  return (
    <div
      role="img"
      aria-label={`Nuru — ${mood}`}
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        backgroundImage: "url(/nuru/sprites.png)",
        backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
        backgroundPosition: `${posX}% ${posY}%`,
        backgroundRepeat: "no-repeat",
        filter: "drop-shadow(0 6px 14px rgba(107,78,255,.28))",
      }}
    />
  );
}
