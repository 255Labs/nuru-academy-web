/**
 * Nuru AI Academy — Welcome Camp overworld engine.
 *
 * Plain JS, no framework dependencies — a small canvas game loop you could
 * lift into any host (React wraps it in WorldCanvas.tsx, but the engine
 * itself doesn't know React exists). This is the template: one region,
 * grid movement, tile collision, and an encounter callback the host uses
 * to open the real (tested) Battle Trial system.
 *
 * Tile legend:
 *   0 = grass (walkable)
 *   1 = tree / obstacle (blocked)
 *   2 = path (walkable, drawn differently for visual variety)
 *   3 = enemy encounter (walkable, but triggers onEncounter() once)
 *   4 = NPC (blocked like a wall; walk adjacent to it and press E to talk)
 */

const TILE = 48; // pixels per tile, before camera scale

// Welcome Camp — a small original 14x9 map. 0=grass 1=tree 2=path 3=enemy 4=npc.
// This is the "one region" slice: extend this array (or load a different
// one) to add more of your world map's 11 regions later — the engine
// itself doesn't care how many maps exist, it just renders whichever
// tilemap it's given.
export const WELCOME_CAMP_MAP = {
  width: 14,
  height: 9,
  playerStart: { x: 1, y: 4 },
  tiles: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 2, 2, 2, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 2, 1, 2, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 2, 0, 2, 0, 0, 4, 0, 0, 0, 0, 1],
    [1, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // NPC dialogue, keyed by "x,y" — matching the santa clarita reference
  // pattern of associating interactable data with a fixed position, but
  // written fresh for this map and this story.
  npcs: {
    "8,3": {
      name: "Village Elder",
      lines: [
        "Taa moja yaweza kuwasha elfu — one lamp can light a thousand others without losing its own flame.",
        "That's the whole of it, little one. Nuru doesn't know everything. She just carries a flame far enough for you to find your own.",
      ],
    },
  },
};

const COLORS = {
  grass: "#8FC97A",
  grassDark: "#7CB868",
  path: "#E3C88A",
  tree: "#3E6B4A",
  treeTrunk: "#6B4A2E",
};

export class WorldEngine {
  constructor(canvas, { map, onEncounter, onNearNPC, onInteract, spriteUrls }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.map = map;
    this.onEncounterCb = onEncounter;
    this.onNearNPCCb = onNearNPC;
    this.onInteractCb = onInteract;
    this.clearedEncounters = new Set();
    this.nearNPCKey = null;

    this.player = { ...map.playerStart, facing: "down", moving: false };
    this.target = { ...map.playerStart };
    this.moveT = 0; // 0..1 lerp progress between tile and target
    this.walkPhase = 0;

    this.keys = new Set();
    this.paused = false;
    this.running = true;

    this.sprites = {};
    this._loadSprites(spriteUrls);

    this._onKeyDown = (e) => this._handleKey(e, true);
    this._onKeyUp = (e) => this._handleKey(e, false);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  _loadSprites(urls) {
    Object.entries(urls).forEach(([key, url]) => {
      const img = new Image();
      img.src = url;
      this.sprites[key] = img;
    });
  }

  _handleKey(e, isDown) {
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
    const dir = map[e.key];
    if (dir) {
      e.preventDefault();
      if (isDown) this.keys.add(dir); else this.keys.delete(dir);
      return;
    }
    if (isDown && (e.key === "e" || e.key === "E") && this.nearNPCKey) {
      e.preventDefault();
      const npc = this.map.npcs?.[this.nearNPCKey];
      if (npc) this.onInteractCb?.(npc);
    }
  }

  _tileAt(x, y) {
    if (y < 0 || y >= this.map.height || x < 0 || x >= this.map.width) return 1;
    return this.map.tiles[y][x];
  }

  _tryMove() {
    if (this.player.moving || this.paused) return;
    let dx = 0, dy = 0, facing = this.player.facing;
    if (this.keys.has("up")) { dy = -1; facing = "up"; }
    else if (this.keys.has("down")) { dy = 1; facing = "down"; }
    else if (this.keys.has("left")) { dx = -1; facing = "left"; }
    else if (this.keys.has("right")) { dx = 1; facing = "right"; }
    else return;

    this.player.facing = facing;
    const nx = this.player.x + dx, ny = this.player.y + dy;
    const tile = this._tileAt(nx, ny);
    if (tile === 1 || tile === 4) return; // blocked (tree or NPC)

    this.target = { x: nx, y: ny };
    this.player.moving = true;
    this.moveT = 0;
  }

  _update(dt) {
    if (this.paused) return;
    this._tryMove();
    this._updateNearNPC();

    if (this.player.moving) {
      this.moveT += dt * 6; // movement speed — tiles per second
      this.walkPhase += dt * 10;
      if (this.moveT >= 1) {
        this.player.x = this.target.x;
        this.player.y = this.target.y;
        this.player.moving = false;
        this.moveT = 0;
        this._checkEncounter();
        this._updateNearNPC();
      }
    } else {
      this.walkPhase = 0;
    }
  }

  _updateNearNPC() {
    if (!this.map.npcs) return;
    const { x, y } = this.player;
    const adjacent = [`${x},${y - 1}`, `${x},${y + 1}`, `${x - 1},${y}`, `${x + 1},${y}`];
    const found = adjacent.find((k) => this.map.npcs[k]);
    if (found !== this.nearNPCKey) {
      this.nearNPCKey = found ?? null;
      this.onNearNPCCb?.(this.nearNPCKey ? this.map.npcs[this.nearNPCKey] : null);
    }
  }

  _checkEncounter() {
    const key = `${this.player.x},${this.player.y}`;
    const tile = this._tileAt(this.player.x, this.player.y);
    if (tile === 3 && !this.clearedEncounters.has(key)) {
      this.paused = true;
      this.onEncounterCb?.(key);
    }
  }

  /** Called by the host once a battle finishes — clears the tile (if
   * passed) and resumes the overworld loop either way. */
  resolveEncounter(key, passed) {
    if (passed) this.clearedEncounters.add(key);
    this.paused = false;
  }

  /** Pauses movement while an NPC dialogue box is open; call again with
   * no args (or via closeDialogue) once the player dismisses it. */
  openDialogue() {
    this.paused = true;
  }
  closeDialogue() {
    this.paused = false;
  }

  _drawTile(x, y, type) {
    const px = x * TILE, py = y * TILE;
    if (type === 1) {
      this.ctx.fillStyle = COLORS.grass;
      this.ctx.fillRect(px, py, TILE, TILE);
      this.ctx.fillStyle = COLORS.treeTrunk;
      this.ctx.fillRect(px + TILE * 0.42, py + TILE * 0.55, TILE * 0.16, TILE * 0.4);
      this.ctx.fillStyle = COLORS.tree;
      this.ctx.beginPath();
      this.ctx.arc(px + TILE / 2, py + TILE * 0.4, TILE * 0.38, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (type === 2) {
      this.ctx.fillStyle = COLORS.path;
      this.ctx.fillRect(px, py, TILE, TILE);
    } else {
      this.ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.grass : COLORS.grassDark;
      this.ctx.fillRect(px, py, TILE, TILE);
    }
  }

  _draw() {
    const { ctx, map } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        this._drawTile(x, y, map.tiles[y][x]);
      }
    }

    // Enemy tokens (any tile === 3, not yet cleared)
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === 3 && !this.clearedEncounters.has(`${x},${y}`)) {
          const bob = Math.sin(performance.now() / 300) * 4;
          this._drawSprite(this.sprites.doubt, x * TILE, y * TILE + bob, TILE, false);
        }
      }
    }

    // NPC tokens — procedurally drawn (no extracted art for these yet),
    // distinct warm colour so they read clearly as "friendly," not "enemy."
    if (map.npcs) {
      Object.keys(map.npcs).forEach((key) => {
        const [nx, ny] = key.split(",").map(Number);
        this._drawNPC(nx, ny, key === this.nearNPCKey);
      });
    }

    // Player, interpolated between grid cells while moving
    let px = this.player.x, py = this.player.y;
    if (this.player.moving) {
      px = this.player.x + (this.target.x - this.player.x) * this.moveT;
      py = this.player.y + (this.target.y - this.player.y) * this.moveT;
    }
    const bob = this.player.moving ? Math.abs(Math.sin(this.walkPhase)) * 5 : 0;
    const facingLeft = this.player.facing === "left";
    this._drawSprite(this.sprites.chipukizi, px * TILE, py * TILE - bob, TILE, facingLeft);
  }

  _drawNPC(x, y, isNear) {
    const ctx = this.ctx;
    const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
    ctx.save();
    ctx.fillStyle = "#B8863F";
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8A6330";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + TILE * 0.22, cy - TILE * 0.3);
    ctx.lineTo(cx + TILE * 0.22, cy + TILE * 0.32);
    ctx.stroke(); // a simple staff line — Village Elder silhouette cue
    if (isNear) {
      ctx.fillStyle = "#F5B942";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      const bob = Math.sin(performance.now() / 250) * 3;
      ctx.fillText("!", cx, cy - TILE * 0.55 + bob);
    }
    ctx.restore();
  }

  _drawSprite(img, px, py, size, flip) {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const ctx = this.ctx;
    const drawSize = size * 1.5;
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

  _loop(now) {
    if (!this.running) return;
    const dt = this._lastTime ? Math.min(0.05, (now - this._lastTime) / 1000) : 0;
    this._lastTime = now;
    this._update(dt);
    this._draw();
    this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  destroy() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
  }
}
