const FADE_IN = 0.9;
const HOLD = 3;
const FADE_OUT = 0.9;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t) {
  return t * t * t;
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

/**
 * Заставка при входе: «Skyline Kick представляет» на чёрном фоне.
 */
export function createSkylineKickIntro() {
  let phase = "fade_in";
  let phaseTime = 0;
  let done = false;

  return {
    update(deltaTime) {
      if (done || !Number.isFinite(deltaTime) || deltaTime <= 0) return;
      phaseTime += deltaTime;

      if (phase === "fade_in" && phaseTime >= FADE_IN) {
        phase = "hold";
        phaseTime = 0;
      } else if (phase === "hold" && phaseTime >= HOLD) {
        phase = "fade_out";
        phaseTime = 0;
      } else if (phase === "fade_out" && phaseTime >= FADE_OUT) {
        done = true;
      }
    },

    isDone() {
      return done;
    },

    /** Прозрачность всего оверлея (в конце уходит к 0). */
    getOverlayAlpha() {
      if (done) return 0;
      if (phase === "fade_out") {
        const t = clamp01(phaseTime / FADE_OUT);
        return 1 - easeInCubic(t);
      }
      return 1;
    },

    /** Прозрачность надписи (появление / исчезновение). */
    getTextAlpha() {
      if (done) return 0;
      if (phase === "fade_in") {
        return easeOutCubic(clamp01(phaseTime / FADE_IN));
      }
      if (phase === "hold") return 1;
      const t = clamp01(phaseTime / FADE_OUT);
      return 1 - easeInCubic(t);
    },

    /** Лёгкое «свечение» при появлении. */
    getGlowStrength() {
      if (phase === "fade_in") {
        return easeOutCubic(clamp01(phaseTime / FADE_IN));
      }
      if (phase === "hold") return 1;
      return 1 - easeInCubic(clamp01(phaseTime / FADE_OUT));
    },
  };
}

export function drawSkylineKickIntro(ctx, intro, uiTime) {
  if (intro.isDone()) return;

  const overlayA = intro.getOverlayAlpha();
  const textA = intro.getTextAlpha();
  const glow = intro.getGlowStrength();

  if (overlayA <= 0.01) return;

  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${overlayA})`;
  ctx.fillRect(0, 0, 1200, 700);

  if (textA > 0.02) {
    const cx = 600;
    const cy = 350;
    const breathe = 0.04 * Math.sin(uiTime * 2.2);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.save();
    ctx.globalAlpha = textA * 0.35 * glow;
    ctx.shadowColor = "rgba(45,212,191,0.9)";
    ctx.shadowBlur = 48 + 24 * glow;
    ctx.font = "bold 72px Arial";
    ctx.fillStyle = "#2dd4bf";
    ctx.fillText("SKYLINE KICK", cx, cy - 28);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = textA;
    const titleGrad = ctx.createLinearGradient(cx - 280, cy - 60, cx + 280, cy + 20);
    titleGrad.addColorStop(0, "#5eead4");
    titleGrad.addColorStop(0.5, "#ffffff");
    titleGrad.addColorStop(1, "#38bdf8");
    ctx.font = `bold ${Math.round(68 + breathe * 4)}px Arial`;
    ctx.fillStyle = titleGrad;
    ctx.shadowColor = `rgba(45,212,191,${0.45 * glow})`;
    ctx.shadowBlur = 18 * glow;
    ctx.fillText("SKYLINE KICK", cx, cy - 28);

    ctx.font = `500 ${Math.round(30 + breathe * 2)}px Arial`;
    ctx.fillStyle = `rgba(241,245,249,${0.88})`;
    ctx.shadowBlur = 0;
    ctx.fillText("представляет", cx, cy + 42);
    ctx.restore();
  }

  ctx.restore();
}
