/**
 * Baobab Forest — Chapter 2 "code console" demo engine.
 *
 * A different game mode from src/game/engine.js (the real-time WASD
 * world): here the player WRITES a sequence of commands, hits Run, and
 * watches them execute one at a time — matching the "Programming" subject
 * format from the curriculum sheets (write logic, defeat the bug/enemy,
 * progress). Plain JS, framework-agnostic, no eval() anywhere — commands
 * are parsed against a fixed whitelist, never executed as real code.
 */

const TILE = 56;

// Baobab Forest — a small original 8x6 map. 0=ground 1=spike(blocked)
// 2=gem. Enemies and the gem are separate objects (not baked into the
// tile grid) since they carry their own state (health, collected).
export const BAOBAB_FOREST_MAP = {
  width: 8,
  height: 6,
  playerStart: { x: 0, y: 2 },
  tiles: [
    [0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  enemies: [
    { id: "bot-a", x: 3, y: 2, hp: 1 },
    { id: "bot-b", x: 6, y: 1, hp: 1 },
  ],
  gem: { x: 3, y: 4 },
};

const COMMAND_PATTERN = /^(moveUp|moveDown|moveLeft|moveRight|attack|collect)\(\)$/;

/** Parses raw console text into a whitelisted command list. Anything that
 * doesn't match a known command becomes a `{ type: "error", raw }` entry
 * so the UI can report exactly which line was invalid — never executed,
 * never eval'd. */
export function parseCommands(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const match = line.match(COMMAND_PATTERN);
      return match ? { type: match[1], raw: line } : { type: "error", raw: line };
    });
}

const DIRS = {
  moveUp: { dx: 0, dy: -1, facing: "up" },
  moveDown: { dx: 0, dy: 1, facing: "down" },
  moveLeft: { dx: -1, dy: 0, facing: "left" },
  moveRight: { dx: 1, dy: 0, facing: "right" },
};

/**
 * Runs the full command list against the map and returns a history array
 * — one frame per command, each a full snapshot (not a diff), so the UI
 * can jump to any step instantly without replaying from the start.
 */
export function runProgram(map, commands) {
  let player = { ...map.playerStart, facing: "down" };
  let enemies = map.enemies.map((e) => ({ ...e, defeated: false }));
  let gemCollected = false;

  const history = [{
    player: { ...player },
    enemies: enemies.map((e) => ({ ...e })),
    gemCollected,
    narration: "Ready. Press Run to begin.",
    ok: true,
  }];

  function tileAt(x, y) {
    if (y < 0 || y >= map.height || x < 0 || x >= map.width) return 1;
    return map.tiles[y][x];
  }
  function enemyAt(x, y) {
    return enemies.find((e) => e.x === x && e.y === y && !e.defeated);
  }

  for (const cmd of commands) {
    let narration = "";
    let ok = true;

    if (cmd.type === "error") {
      narration = `Unknown command: "${cmd.raw}" — skipped.`;
      ok = false;
    } else if (DIRS[cmd.type]) {
      const { dx, dy, facing } = DIRS[cmd.type];
      player = { ...player, facing };
      const nx = player.x + dx, ny = player.y + dy;
      const blocked = tileAt(nx, ny) === 1;
      const enemyThere = enemyAt(nx, ny);
      if (blocked) {
        narration = `Chipukizi tries to move ${facing} — a spike blocks the way!`;
        ok = false;
      } else if (enemyThere) {
        narration = `Chipukizi tries to move ${facing} — a Shadow Bot blocks the path.`;
        ok = false;
      } else {
        player = { ...player, x: nx, y: ny };
        narration = `Chipukizi moves ${facing}.`;
      }
    } else if (cmd.type === "attack") {
      const { dx, dy } = DIRS[
        player.facing === "up" ? "moveUp" : player.facing === "down" ? "moveDown"
        : player.facing === "left" ? "moveLeft" : "moveRight"
      ];
      const target = enemyAt(player.x + dx, player.y + dy);
      if (target) {
        enemies = enemies.map((e) => (e.id === target.id ? { ...e, hp: e.hp - 1, defeated: e.hp - 1 <= 0 } : e));
        const stillAlive = enemies.filter((e) => !e.defeated).length;
        narration = enemies.find((e) => e.id === target.id).defeated
          ? `Chipukizi attacks Shadow Bot. Shadow Bot defeated! ${stillAlive} Shadow Bot${stillAlive === 1 ? "" : "s"} remaining...`
          : "Chipukizi attacks Shadow Bot. It's still standing.";
      } else {
        narration = "Chipukizi attacks — but there's nothing there.";
        ok = false;
      }
    } else if (cmd.type === "collect") {
      if (map.gem.x === player.x && map.gem.y === player.y && !gemCollected) {
        gemCollected = true;
        narration = "Code Gem collected!";
      } else {
        narration = "Nothing to collect here.";
        ok = false;
      }
    }

    history.push({
      player: { ...player },
      enemies: enemies.map((e) => ({ ...e })),
      gemCollected,
      narration,
      ok,
    });
  }

  const defeatedCount = enemies.filter((e) => e.defeated).length;
  return {
    history,
    result: {
      enemiesDefeated: defeatedCount,
      totalEnemies: enemies.length,
      gemCollected,
      complete: defeatedCount === enemies.length && gemCollected,
    },
  };
}

const COLORS = { ground: "#D9C08A", groundAlt: "#CFB578", spike: "#8B7355" };

export class BaobabForestRenderer {
  constructor(canvas, spriteUrls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sprites = {};
    Object.entries(spriteUrls).forEach(([key, url]) => {
      const img = new Image();
      img.src = url;
      this.sprites[key] = img;
    });
  }

  render(map, frame) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const px = x * TILE, py = y * TILE;
        const tile = map.tiles[y][x];
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.ground : COLORS.groundAlt;
        ctx.fillRect(px, py, TILE, TILE);
        if (tile === 1) {
          ctx.fillStyle = COLORS.spike;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const sx = px + 10 + i * 14;
            ctx.moveTo(sx, py + TILE - 8);
            ctx.lineTo(sx + 7, py + 10);
            ctx.lineTo(sx + 14, py + TILE - 8);
            ctx.fill();
          }
        }
      }
    }

    if (!frame.gemCollected) {
      const gx = map.gem.x * TILE + TILE / 2, gy = map.gem.y * TILE + TILE / 2;
      const bob = Math.sin(performance.now() / 300) * 3;
      ctx.fillStyle = "#8B6CFF";
      ctx.beginPath();
      ctx.moveTo(gx, gy - 14 + bob);
      ctx.lineTo(gx + 11, gy + bob);
      ctx.lineTo(gx, gy + 14 + bob);
      ctx.lineTo(gx - 11, gy + bob);
      ctx.fill();
    }

    frame.enemies.forEach((e) => {
      if (e.defeated) return;
      this._drawSprite(this.sprites.doubt, e.x * TILE, e.y * TILE, TILE);
    });

    this._drawSprite(this.sprites.chipukizi, frame.player.x * TILE, frame.player.y * TILE, TILE, frame.player.facing === "left");
  }

  _drawSprite(img, px, py, size, flip) {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const ctx = this.ctx;
    const drawSize = size * 1.4;
    const offsetX = px - (drawSize - size) / 2;
    const offsetY = py - (drawSize - size);
    ctx.save();
    if (flip) {
      ctx.translate(offsetX + drawSize, offsetY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, drawSize, drawSize);
    } else {
      ctx.drawImage(img, offsetX, offsetY, drawSize, drawSize);
    }
    ctx.restore();
  }
}

export const TILE_SIZE = TILE;
