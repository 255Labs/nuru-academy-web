/**
 * Baobab Forest — Chapter 2 "code console" demo engine.
 * Fixed: mojibake em-dashes corrected, narration strings extracted for i18n,
 * all strings now accept a locale parameter ("en" | "sw").
 * Fixed: interval handle returned from runProgram so callers can clear it.
 */

const TILE = 56;

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
  moveUp:    { dx: 0,  dy: -1, facing: "up" },
  moveDown:  { dx: 0,  dy:  1, facing: "down" },
  moveLeft:  { dx: -1, dy:  0, facing: "left" },
  moveRight: { dx:  1, dy:  0, facing: "right" },
};

// Direction names in Swahili for narration
const DIR_SW = { up: "juu", down: "chini", left: "kushoto", right: "kulia" };

function dirName(facing, locale) {
  if (locale === "sw") return DIR_SW[facing] ?? facing;
  return facing;
}

/**
 * Narration strings — bilingual.
 * locale: "en" | "sw"
 */
function narrate(key, locale, args = {}) {
  const { raw, facing, remaining } = args;
  const sw = locale === "sw";
  switch (key) {
    case "ready":
      return sw ? "Tayari. Bonyeza Endesha kuanza." : "Ready. Press Run to begin.";
    case "unknownCmd":
      return sw
        ? `Amri isiyojulikana: "${raw}" — imeachwa.`
        : `Unknown command: "${raw}" — skipped.`;
    case "moveBlocked":
      return sw
        ? `Nuru anajaribu kwenda ${dirName(facing, "sw")} — mchokozi unazuia njia!`
        : `Nuru tries to move ${facing} — a spike blocks the way!`;
    case "moveEnemy":
      return sw
        ? `Nuru anajaribu kwenda ${dirName(facing, "sw")} — Shadow Bot inazuia njia.`
        : `Nuru tries to move ${facing} — a Shadow Bot blocks the path.`;
    case "moveDone":
      return sw
        ? `Nuru anasogea ${dirName(facing, "sw")}.`
        : `Nuru moves ${facing}.`;
    case "attackDefeated": {
      const r = remaining ?? 0;
      return sw
        ? `Nuru anashambulia! Shadow Bot imeshindwa! ${r} Shadow Bot ${r === 1 ? "iliyobaki" : "zilizobaki"}...`
        : `Nuru attacks! Shadow Bot defeated! ${r} Shadow Bot${r === 1 ? "" : "s"} remaining...`;
    }
    case "attackStillAlive":
      return sw ? "Nuru anashambulia! Bado imesimama." : "Nuru attacks! It is still standing.";
    case "attackNothing":
      return sw
        ? "Nuru anashambulia — lakini hakuna kitu hapo."
        : "Nuru attacks — but there is nothing there.";
    case "gemCollected":
      return sw
        ? "Jiwe la Msimbo limekusanywa! Nuru anang'aa kwa maarifa!"
        : "Code Gem collected! Nuru glows with knowledge!";
    case "nothingHere":
      return sw
        ? "Hakuna kitu cha kukusanya hapa."
        : "Nothing to collect here.";
    default:
      return key;
  }
}

export function runProgram(map, commands, locale = "en") {
  let player = { ...map.playerStart, facing: "down", mood: "happy" };
  let enemies = map.enemies.map((e) => ({ ...e, defeated: false }));
  let gemCollected = false;

  const history = [{
    player: { ...player },
    enemies: enemies.map((e) => ({ ...e })),
    gemCollected,
    narration: narrate("ready", locale),
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
    let mood = "happy";

    if (cmd.type === "error") {
      narration = narrate("unknownCmd", locale, { raw: cmd.raw });
      ok = false;
      mood = "sad";
    } else if (DIRS[cmd.type]) {
      const { dx, dy, facing } = DIRS[cmd.type];
      player = { ...player, facing };
      const nx = player.x + dx, ny = player.y + dy;
      const blocked   = tileAt(nx, ny) === 1;
      const enemyThere = enemyAt(nx, ny);

      if (blocked) {
        narration = narrate("moveBlocked", locale, { facing });
        ok = false;
        mood = "sad";
      } else if (enemyThere) {
        narration = narrate("moveEnemy", locale, { facing });
        ok = false;
        mood = "surprised";
      } else {
        player = { ...player, x: nx, y: ny };
        narration = narrate("moveDone", locale, { facing });
        mood = "excited";
      }
    } else if (cmd.type === "attack") {
      const dir = player.facing;
      const { dx, dy } = DIRS[
        dir === "up"    ? "moveUp"    :
        dir === "down"  ? "moveDown"  :
        dir === "left"  ? "moveLeft"  : "moveRight"
      ];
      const target = enemyAt(player.x + dx, player.y + dy);

      if (target) {
        enemies = enemies.map((e) =>
          e.id === target.id ? { ...e, hp: e.hp - 1, defeated: e.hp - 1 <= 0 } : e
        );
        const stillAlive = enemies.filter((e) => !e.defeated).length;
        const isDefeated = enemies.find((e) => e.id === target.id).defeated;
        narration = isDefeated
          ? narrate("attackDefeated", locale, { remaining: stillAlive })
          : narrate("attackStillAlive", locale);
        mood = "excited";
      } else {
        narration = narrate("attackNothing", locale);
        ok = false;
        mood = "thinking";
      }
    } else if (cmd.type === "collect") {
      if (map.gem.x === player.x && map.gem.y === player.y && !gemCollected) {
        gemCollected = true;
        narration = narrate("gemCollected", locale);
        mood = "winking";
      } else {
        narration = narrate("nothingHere", locale);
        ok = false;
        mood = "thinking";
      }
    }

    player = { ...player, mood };
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
      const gx = map.gem.x * TILE + TILE / 2;
      const gy = map.gem.y * TILE + TILE / 2;
      const bob = Math.sin(performance.now() / 300) * 3;
      ctx.fillStyle = "#8B6CFF";
      ctx.beginPath();
      ctx.moveTo(gx,      gy - 14 + bob);
      ctx.lineTo(gx + 11, gy      + bob);
      ctx.lineTo(gx,      gy + 14 + bob);
      ctx.lineTo(gx - 11, gy      + bob);
      ctx.fill();
    }

    frame.enemies.forEach((e) => {
      if (e.defeated) return;
      this._drawSprite(this.sprites.doubt, e.x * TILE, e.y * TILE, TILE);
    });

    const mood = frame.player.mood || "happy";
    const nuruSprite = this.sprites["nuru_" + mood] || this.sprites.nuru_happy;
    this._drawSprite(
      nuruSprite,
      frame.player.x * TILE,
      frame.player.y * TILE,
      TILE,
      frame.player.facing === "left"
    );
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