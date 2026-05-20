import { drawField, FIELD } from "./Field.js";
import { Ball } from "./Ball.js";
import { Player } from "./Player.js";
import { HUDCore } from "../ui/HUDCore.js";
import SkinSystem from "../systems/SkinSystem.js";

const MATCH_FOUND_TOTAL = 3.45;
const GOAL_PAUSE_SECONDS = 2;
const RECORD_INTERVAL = 1 / 14;
const MAX_FRAMES = 3600;

function cloneStyle(obj) {
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {
    /* ignore */
  }
  try {
    return JSON.parse(JSON.stringify(obj ?? null));
  } catch {
    return null;
  }
}

function scorerCode(name) {
  if (name === "ИГРОК") return 1;
  if (name === "БОТ") return 2;
  return 0;
}

function scorerLabel(code) {
  if (code === 1) return "ИГРОК";
  if (code === 2) return "БОТ";
  return "";
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mergeFrame(a, b, u) {
  return {
    t: lerp(a.t, b.t, u),
    bx: lerp(a.bx, b.bx, u),
    by: lerp(a.by, b.by, u),
    br: lerp(a.br, b.br, u),
    px: lerp(a.px, b.px, u),
    py: lerp(a.py, b.py, u),
    ox: lerp(a.ox, b.ox, u),
    oy: lerp(a.oy, b.oy, u),
    ls: u < 0.5 ? a.ls : b.ls,
    rs: u < 0.5 ? a.rs : b.rs,
    gp: lerp(a.gp, b.gp, u),
    sc: u < 0.5 ? a.sc : b.sc,
  };
}

function sampleAt(frames, time) {
  if (!frames.length) return null;
  if (time <= frames[0].t) return frames[0];
  const last = frames[frames.length - 1];
  if (time >= last.t) return last;
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  if (b.t <= a.t) return b;
  const u = (time - a.t) / (b.t - a.t);
  return mergeFrame(a, b, u);
}

export class MatchReplayRecorder {
  constructor() {
    this.frames = [];
    this._meta = null;
    this._recordT = 0;
    this._lastPushT = 0;
    this._finalPushed = false;
    this._lastGp = 0;
  }

  /** @param {import("./MatchCore.js").MatchCore} match */
  commitFrame(match) {
    if (match.introElapsed < MATCH_FOUND_TOTAL) return;
    if (!this._meta) {
      this._meta = {
        playerName: match.playerName,
        botName: match.botName,
        playerSkinId: SkinSystem.getActiveSkin()?.id ?? "default",
        botSkinId: match._matchBotSkinId,
        ballStyle: cloneStyle(SkinSystem.getActiveBallPaintValue()),
        goalStyle: cloneStyle(SkinSystem.getActiveGoalPaintValue()),
        playerMmr: match._introPlayerMmr,
        botMmr: match.botMmr,
        isTournament: match.isTournament,
      };
    }

    if (match.isFinished) {
      if (!this._finalPushed && this.frames.length < MAX_FRAMES) {
        this._pushSnapshot(match, this._recordT);
        this._finalPushed = true;
      }
      return;
    }

    const dt = match._lastDeltaTime ?? 0;

    if (this.frames.length === 0) {
      this._pushSnapshot(match, 0);
      this._lastPushT = 0;
    }

    this._recordT += dt;

    const gp = match.goalPauseTimer;
    const gpEdge = (gp > 0 && this._lastGp <= 0) || (gp <= 0 && this._lastGp > 0);
    this._lastGp = gp;

    const due = this._recordT - this._lastPushT >= RECORD_INTERVAL;
    if ((due || gpEdge) && this.frames.length < MAX_FRAMES) {
      this._pushSnapshot(match, this._recordT);
      this._lastPushT = this._recordT;
    }
  }

  /** @param {import("./MatchCore.js").MatchCore} match */
  _pushSnapshot(match, t) {
    const b = match.ball;
    this.frames.push({
      t,
      bx: b.x,
      by: b.y,
      br: b.rotation,
      px: match.player.x,
      py: match.player.y,
      ox: match.bot.x,
      oy: match.bot.y,
      ls: match.playerScore,
      rs: match.botScore,
      gp: Math.max(0, match.goalPauseTimer),
      sc: scorerCode(match._goalScorer),
    });
  }

  getFrameCount() {
    return this.frames.length;
  }

  exportPayload() {
    if (!this._meta || this.frames.length < 2) return null;
    return { v: 1, meta: this._meta, frames: this.frames.slice() };
  }
}

function drawGoalOverlayReplay(ctx, goalPauseTimer, scorerCodeVal) {
  if (goalPauseTimer <= 0) return;
  const progress = Math.min(1, (GOAL_PAUSE_SECONDS - goalPauseTimer) / 0.35);
  const eased = 1 - (1 - progress) ** 3;
  const centerX = FIELD.x + FIELD.width / 2;
  const centerY = FIELD.y + 96 - (1 - eased) * 40;
  const scale = 0.6 + eased * 0.5;
  const label = scorerLabel(scorerCodeVal);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.font = "bold 54px Arial";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.fillStyle = "#ffe54d";
  ctx.strokeText("ГОЛ!", 0, 0);
  ctx.fillText("ГОЛ!", 0, 0);
  ctx.font = "bold 30px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText(`ЗАБИЛ ${label}`, 0, 54);
  ctx.fillText(`ЗАБИЛ ${label}`, 0, 54);
  ctx.restore();
}

export class MatchReplayPlayer {
  /**
   * @param {{ v: number; meta: object; frames: object[] }} data
   */
  constructor(data) {
    this.data = data;
    this.meta = data.meta;
    this.frames = data.frames;
    this.time = 0;
    this.duration = this.frames[this.frames.length - 1]?.t ?? 0;
    this.ended = false;

    this.ball = new Ball();
    this.player = new Player({
      x: FIELD.x + FIELD.width * 0.25,
      y: FIELD.y + FIELD.height * 0.5,
      color: "#ffffff",
    });
    this.bot = new Player({
      x: FIELD.x + FIELD.width * 0.75,
      y: FIELD.y + FIELD.height * 0.5,
      color: "#ff6b6b",
    });
    this.hud = new HUDCore();
    SkinSystem.applySkinToPlayer(this.player, this.meta.playerSkinId);
    SkinSystem.applySkinToPlayer(this.bot, this.meta.botSkinId);
    this.ball.trail?.reset();
    this._applySample(sampleAt(this.frames, 0));
  }

  _applySample(s) {
    if (!s) return;
    this.ball.x = s.bx;
    this.ball.y = s.by;
    this.ball.rotation = s.br;
    this.player.x = s.px;
    this.player.y = s.py;
    this.bot.x = s.ox;
    this.bot.y = s.oy;
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.ended) return;
    this.time += dt;
    if (this.time >= this.duration) {
      this.time = this.duration;
      this.ended = true;
    }
    this._applySample(sampleAt(this.frames, this.time));
    this.ball.trail?.reset();
  }

  draw(ctx) {
    const goalStyle = this.meta.goalStyle ?? null;
    const ballStyle = this.meta.ballStyle ?? null;
    drawField(ctx, { goalPaintValue: goalStyle });

    this.ball.draw(ctx, ballStyle);
    this.player.draw(ctx);
    this.bot.draw(ctx);

    const s = sampleAt(this.frames, this.time);
    if (!s) return;

    this.hud.draw(ctx, {
      leftName: this.meta.playerName,
      rightName: this.meta.botName,
      leftScore: s.ls,
      rightScore: s.rs,
      mmr: this.meta.playerMmr,
      opponentMmr: this.meta.botMmr,
    });

    drawGoalOverlayReplay(ctx, s.gp, s.sc);

    ctx.save();
    ctx.fillStyle = "rgba(8, 20, 24, 0.55)";
    ctx.fillRect(FIELD.x + 12, FIELD.y + 86, 200, 36);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(FIELD.x + 12, FIELD.y + 86, 200, 36);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const tag = this.meta.isTournament ? "Повтор (турнир)" : "Повтор матча";
    ctx.fillText(tag, FIELD.x + 24, FIELD.y + 104);
    ctx.restore();
  }
}
