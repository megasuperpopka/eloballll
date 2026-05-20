import { getBallDrawScale, useLowEffects } from "../core/MobileLayout.js";
import MatchCosmeticRender from "../systems/MatchCosmeticRender.js";

function trailPaletteFromStyle(style) {
  const s = MatchCosmeticRender.mergeBallStyle(style);
  const colors = [s.accent, s.accent2 || s.base, s.base].filter((c) => typeof c === "string");
  const uniq = [...new Set(colors)];

  if (s.pattern === "neon") {
    return { colors: uniq.length ? uniq : ["#00e5ff", "#ff00e5"], glow: true, spacing: 7, maxPoints: 30, ttl: 0.62 };
  }
  if (s.pattern === "star" || s.pattern === "diamond") {
    return { colors: uniq.length ? uniq : ["#e040fb", "#40c4ff"], glow: true, sparkles: true, spacing: 8, maxPoints: 26, ttl: 0.55 };
  }
  if (s.pattern === "stripes") {
    return { colors: uniq.length ? uniq : [s.accent, s.base], glow: false, spacing: 9, maxPoints: 22, ttl: 0.48 };
  }
  if (s.pattern === "split") {
    return { colors: uniq.length ? uniq : [s.base, s.accent], glow: false, spacing: 10, maxPoints: 20, ttl: 0.45 };
  }
  return {
    colors: uniq.length ? uniq : ["rgba(255,255,255,0.55)", "rgba(148,163,184,0.45)"],
    glow: false,
    spacing: 11,
    maxPoints: 18,
    ttl: 0.4,
  };
}

export class BallTrail {
  constructor() {
    this.points = [];
    this._distAcc = 0;
  }

  reset() {
    this.points = [];
    this._distAcc = 0;
  }

  update(ball, deltaTime, ballStyle) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;

    const speed = Math.hypot(ball.vx, ball.vy);
    const palette = trailPaletteFromStyle(ballStyle);
    const low = useLowEffects();
    const maxPoints = low ? Math.min(10, palette.maxPoints) : palette.maxPoints;
    const spacing = low ? palette.spacing * 1.35 : palette.spacing;
    const drawR = ball.radius * getBallDrawScale();

    for (let i = this.points.length - 1; i >= 0; i -= 1) {
      const p = this.points[i];
      p.life -= deltaTime / p.ttl;
      if (p.life <= 0) this.points.splice(i, 1);
    }

    if (speed < 45) {
      this._distAcc = 0;
      return;
    }

    this._distAcc += speed * deltaTime;
    while (this._distAcc >= spacing) {
      this._distAcc -= spacing;
      const t = speed / 520;
      this.points.push({
        x: ball.x - ball.vx * 0.012,
        y: ball.y - ball.vy * 0.012,
        r: drawR * (0.22 + Math.min(0.18, t * 0.12)),
        life: 1,
        ttl: palette.ttl,
        color: palette.colors[this.points.length % palette.colors.length],
        glow: palette.glow,
        sparkle: palette.sparkles && Math.random() < 0.35,
      });
    }

    while (this.points.length > maxPoints) {
      this.points.shift();
    }
  }

  draw(ctx) {
    if (this.points.length === 0) return;

    for (const p of this.points) {
      const a = Math.max(0, Math.min(1, p.life));
      if (a <= 0.02) continue;

      ctx.save();
      ctx.globalAlpha = a * (p.glow ? 0.72 : 0.58);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.65 + (1 - a) * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14 * a;
      }
      ctx.fill();
      ctx.restore();

      if (p.sparkle && a > 0.25) {
        ctx.save();
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}
