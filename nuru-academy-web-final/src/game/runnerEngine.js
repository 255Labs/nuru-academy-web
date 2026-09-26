/**
 * Nuru AI Academy — Multiplayer Endless Runner Engine
 *
 * Pure canvas, no framework dependencies. Renders two runners (your
 * character + opponent) side-by-side on the same canvas, each in their
 * own lane. Progress is driven by real duel_participants data — the
 * opponent's position is synced live from Supabase Realtime, not
 * simulated. Correct answers boost the local runner; the opponent's
 * runner moves whenever their current_question_idx advances in the DB.
 *
 * Architecture:
 *   RunnerEngine  — game loop, physics, drawing
 *   Host (React)  — calls engine.setMyProgress() / engine.setOpponentProgress()
 *                   whenever Realtime delivers updates
 *
 * Lane layout (canvas 600 × 280):
 *   Lane 0 (top)    — local player
 *   Lane 1 (bottom) — opponent (or lanes 2,3 for group duels)
 */

const CANVAS_W = 600;
const CANVAS_H = 280;
const LANE_H = CANVAS_H / 2;
const GROUND_Y_RATIO = 0.72; // ground line as fraction of lane height

// Runner physics
const GRAVITY = 1800;       // px/s²
const JUMP_V = -560;        // px/s initial jump velocity
const RUNNER_X = 90;        // fixed x position of runner on screen
const RUNNER_SIZE = 44;

// Scenery scroll speed (px/s) — increases with progress
const BASE_SCROLL = 180;
const MAX_SCROLL = 420;

// Obstacle visual: floating question panels every N px of virtual distance
const PANEL_INTERVAL = 320;

// Particle burst on correct answer
const BURST_COUNT = 14;

const PLAYER_COLORS = ["#6B4EFF", "#22C55E", "#F5B942", "#EF4444"];
const TRACK_BG = ["#1A1035", "#0D2416", "#2A1A00", "#2A0A0A"];
const GROUND_COLOR = ["#3D2B80", "#0F4A28", "#5A3800", "#5A1010"];
const SKY_COLORS = [
  ["#0F0720", "#1A1035"],
  ["#071A0F", "#0D2416"],
  ["#1A0F00", "#2A1A00"],
  ["#1A0007", "#2A000A"],
];

function lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)); }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 200;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 80;
    this.life = 1; this.size = 4 + Math.random() * 5;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 400 * dt;
    this.life -= dt * 2.2;
  }
  draw(ctx, offsetY) {
    if (this.life <= 0) return;
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y + offsetY, this.size * this.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class Runner {
  constructor(laneIndex, color, totalQuestions) {
    this.laneIndex = laneIndex;
    this.color = color;
    this.totalQ = Math.max(1, totalQuestions);
    // progress: 0..1 fraction of questions done
    this.progress = 0;
    this.targetProgress = 0;
    // jump physics
    this.vy = 0;
    this.jumpY = 0; // offset from ground (negative = in air)
    this.grounded = true;
    // visual
    this.walkPhase = 0;
    this.particles = [];
    this.missFlash = 0; // seconds remaining of red flash
    this.hitFlash = 0;  // seconds remaining of gold flash
    this.finished = false;
    this.rank = null;
    // virtual scroll distance (for scenery)
    this.scrollX = 0;
    this.scrollSpeed = BASE_SCROLL;
  }

  get groundY() {
    return LANE_H * GROUND_Y_RATIO;
  }

  jump() {
    if (this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
    }
  }

  burst(ctx, laneOffsetY) {
    for (let i = 0; i < BURST_COUNT; i++) {
      this.particles.push(new Particle(RUNNER_X, this.groundY - 20, this.color));
    }
    this.hitFlash = 0.35;
    this.jump();
  }

  miss() {
    this.missFlash = 0.4;
  }

  update(dt) {
    // Smooth progress interpolation
    this.progress = lerp(this.progress, this.targetProgress, dt * 4);

    // Scroll speed ramps up with progress
    this.scrollSpeed = lerp(BASE_SCROLL, MAX_SCROLL, this.progress);
    this.scrollX += this.scrollSpeed * dt;

    // Jump physics
    if (!this.grounded) {
      this.vy += GRAVITY * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY >= 0) {
        this.jumpY = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }

    // Walk animation
    if (this.grounded) {
      this.walkPhase += this.scrollSpeed * dt * 0.06;
    }

    // Flash timers
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.missFlash > 0) this.missFlash -= dt;

    // Particles
    this.particles = this.particles.filter((p) => p.life > 0);
    this.particles.forEach((p) => p.update(dt));
  }

  draw(ctx, laneOffsetY, label, spriteImg, colorIdx) {
    const groundY = this.groundY;
    const runnerY = groundY + this.jumpY - RUNNER_SIZE;
    const cx = RUNNER_X;

    // Particles behind runner
    this.particles.forEach((p) => p.draw(ctx, laneOffsetY));

    // Shadow on ground
    ctx.save();
    ctx.globalAlpha = 0.25 - Math.abs(this.jumpY) * 0.003;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, laneOffsetY + groundY + 4, 20 - Math.abs(this.jumpY) * 0.1, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Runner sprite or fallback polygon
    if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
      ctx.save();
      if (this.hitFlash > 0) {
        ctx.filter = "brightness(2) saturate(0.5) sepia(1) hue-rotate(20deg)";
      } else if (this.missFlash > 0) {
        ctx.filter = "brightness(0.6) sepia(1) hue-rotate(320deg)";
      }
      const drawSize = RUNNER_SIZE * 1.6;
      const ox = cx - drawSize / 2;
      const oy = laneOffsetY + runnerY - (drawSize - RUNNER_SIZE);
      ctx.drawImage(spriteImg, ox, oy, drawSize, drawSize);
      ctx.restore();
    } else {
      // Procedural fallback runner
      ctx.save();
      ctx.fillStyle = this.hitFlash > 0 ? "#FFD700" : this.missFlash > 0 ? "#FF4444" : this.color;
      // body
      ctx.beginPath();
      ctx.roundRect(cx - 10, laneOffsetY + runnerY, 20, 28, 4);
      ctx.fill();
      // head
      ctx.beginPath();
      ctx.arc(cx, laneOffsetY + runnerY - 8, 11, 0, Math.PI * 2);
      ctx.fill();
      // legs
      const legSwing = Math.sin(this.walkPhase) * 8;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.roundRect(cx - 8, laneOffsetY + runnerY + 26, 7, 12 + legSwing, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(cx + 1, laneOffsetY + runnerY + 26, 7, 12 - legSwing, 3);
      ctx.fill();
      ctx.restore();
    }

    // Player label badge
    ctx.save();
    const badgeX = cx;
    const badgeY = laneOffsetY + runnerY - (spriteImg ? RUNNER_SIZE * 0.6 : 30);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(badgeX - 28, badgeY - 12, 56, 18, 8);
    ctx.fill();
    ctx.fillStyle = this.color;
    ctx.font = "bold 10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, badgeX, badgeY - 3);
    ctx.restore();
  }
}

export class RunnerEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   totalQuestions: number,
   *   playerCount: number,      // 2 for 1v1, up to 4
   *   myIndex: number,          // which runner is "me"
   *   labels: string[],         // display name per runner
   *   spriteUrl: string,        // chipukizi.png URL
   *   bgColorIndex: number,     // 0-3 track colour theme
   *   onGameEnd: (ranks: number[]) => void,
   * }} opts
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;

    const count = clamp(opts.playerCount ?? 2, 2, 4);
    this.runners = Array.from({ length: count }, (_, i) =>
      new Runner(i, PLAYER_COLORS[i % PLAYER_COLORS.length], opts.totalQuestions)
    );

    this.laneHeight = CANVAS_H / count;

    // Sprite
    this.sprite = new Image();
    this.sprite.src = opts.spriteUrl;

    // Question panel state
    this.showingQuestion = false;
    this.pendingQuestionX = null; // virtual X where next panel appears

    this.running = true;
    this._lastTime = null;
    this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  /** Called by React whenever Supabase delivers a participant update */
  setProgress(runnerIndex, questionIdx, correctCount) {
    const r = this.runners[runnerIndex];
    if (!r) return;
    r.targetProgress = clamp(questionIdx / r.totalQ, 0, 1);
  }

  /** Called by React on a correct answer by the local player */
  onCorrectAnswer(runnerIndex) {
    const r = this.runners[runnerIndex];
    if (!r) return;
    r.burst(this.ctx, 0);
  }

  /** Called by React on a wrong answer by the local player */
  onWrongAnswer(runnerIndex) {
    const r = this.runners[runnerIndex];
    if (!r) return;
    r.miss();
  }

  /** Called when a runner finishes all questions */
  setFinished(runnerIndex, rank) {
    const r = this.runners[runnerIndex];
    if (!r) return;
    r.finished = true;
    r.rank = rank;
    r.targetProgress = 1;
  }

  _update(dt) {
    this.runners.forEach((r) => r.update(dt));
  }

  _drawLane(laneIndex) {
    const { ctx } = this;
    const runner = this.runners[laneIndex];
    const laneH = this.laneHeight;
    const offsetY = laneIndex * laneH;
    const colorIdx = this.opts.bgColorIndex ?? 0;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, offsetY, 0, offsetY + laneH);
    const skyC = SKY_COLORS[colorIdx] ?? SKY_COLORS[0];
    sky.addColorStop(0, skyC[0]);
    sky.addColorStop(1, skyC[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, offsetY, CANVAS_W, laneH);

    // Scrolling stars / bg dots
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#fff";
    const starSeed = laneIndex * 100;
    for (let i = 0; i < 18; i++) {
      const sx = ((starSeed + i * 71 + runner.scrollX * 0.04) % CANVAS_W + CANVAS_W) % CANVAS_W;
      const sy = offsetY + (((starSeed + i * 37) % 1000) / 1000) * laneH * 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Distant silhouette hills
    const hillScroll = (runner.scrollX * 0.15) % CANVAS_W;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = PLAYER_COLORS[colorIdx] ?? "#6B4EFF";
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      const base = offsetY + laneH * (pass === 0 ? 0.65 : 0.75);
      ctx.moveTo(-hillScroll + pass * 40, base);
      for (let x = 0; x <= CANVAS_W + 120; x += 60) {
        const hx = x - hillScroll + pass * 40;
        const hy = base - Math.sin((hx / 120 + laneIndex) * Math.PI) * (pass === 0 ? 38 : 22);
        ctx.lineTo(hx, hy);
      }
      ctx.lineTo(CANVAS_W + 60, base + laneH);
      ctx.lineTo(-60, base + laneH);
      ctx.fill();
    }
    ctx.restore();

    // Ground
    const groundY = offsetY + runner.groundY;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, groundY + laneH * 0.28);
    const gc = GROUND_COLOR[colorIdx] ?? GROUND_COLOR[0];
    groundGrad.addColorStop(0, gc);
    groundGrad.addColorStop(1, "#000");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, CANVAS_W, laneH - runner.groundY + 4);

    // Ground line
    ctx.strokeStyle = PLAYER_COLORS[colorIdx] ?? PLAYER_COLORS[0];
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(CANVAS_W, groundY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Scrolling ground dashes
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([30, 40]);
    ctx.lineDashOffset = -(runner.scrollX * 0.5) % 70;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 8);
    ctx.lineTo(CANVAS_W, groundY + 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Floating distance markers (track checkpoints)
    const markerInterval = 100;
    const markerVirtual = Math.floor(runner.scrollX / markerInterval) * markerInterval;
    for (let m = markerVirtual; m <= markerVirtual + CANVAS_W + markerInterval; m += markerInterval) {
      const mx = ((m - runner.scrollX) % CANVAS_W + CANVAS_W) % CANVAS_W;
      if (mx < 10 || mx > CANVAS_W - 10) continue;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mx, offsetY + laneH * 0.1);
      ctx.lineTo(mx, groundY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Runner
    const label = this.opts.labels?.[laneIndex] ?? `P${laneIndex + 1}`;
    const isMe = laneIndex === this.opts.myIndex;
    const sprite = isMe ? this.sprite : null; // opponent uses procedural for now
    runner.draw(ctx, offsetY, label, sprite, colorIdx);

    // Finished banner
    if (runner.finished) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(CANVAS_W - 130, offsetY + laneH * 0.3, 125, 32);
      ctx.fillStyle = PLAYER_COLORS[laneIndex % PLAYER_COLORS.length];
      ctx.font = "bold 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        runner.rank ? `🏁 Finished #${runner.rank}` : "🏁 Done!",
        CANVAS_W - 67,
        offsetY + laneH * 0.3 + 16
      );
      ctx.restore();
    }

    // Lane divider (except last lane)
    if (laneIndex < this.runners.length - 1) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, offsetY + laneH);
      ctx.lineTo(CANVAS_W, offsetY + laneH);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawProgressRail() {
    const { ctx } = this;
    const railH = 4;
    const railY = CANVAS_H - railH;
    const railPad = 80;

    // Background rail
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(railPad, railY, CANVAS_W - railPad * 2, railH);

    this.runners.forEach((r, i) => {
      const w = (CANVAS_W - railPad * 2) * r.progress;
      ctx.fillStyle = PLAYER_COLORS[i % PLAYER_COLORS.length];
      ctx.globalAlpha = 0.7;
      ctx.fillRect(railPad, railY, w, railH);
      ctx.globalAlpha = 1;

      // dot marker
      ctx.fillStyle = PLAYER_COLORS[i % PLAYER_COLORS.length];
      ctx.beginPath();
      ctx.arc(railPad + w, railY + railH / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _draw() {
    const { ctx } = this;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    for (let i = 0; i < this.runners.length; i++) {
      this._drawLane(i);
    }

    this._drawProgressRail();
  }

  _loop(now) {
    if (!this.running) return;
    const dt = this._lastTime ? Math.min(0.05, (now - this._lastTime) / 1000) : 0;
    this._lastTime = now;
    this._update(dt);
    this._draw();
    this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  destroy() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}

export const RUNNER_CANVAS_W = CANVAS_W;
export const RUNNER_CANVAS_H = CANVAS_H;
