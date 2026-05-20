/** Короткий переход перед матчем пенальти: затемнение → вспышка «Пенальти» → старт. */
export const PENALTY_LAUNCH_DURATION = 0.9;

export function createPenaltyLaunch() {
  return { elapsed: 0 };
}

export function updatePenaltyLaunch(launch, deltaTime) {
  if (!launch) return false;
  launch.elapsed += deltaTime;
  return launch.elapsed >= PENALTY_LAUNCH_DURATION;
}

export function drawPenaltyLaunchOverlay(ctx, launch) {
  if (!launch) return;
  const t = launch.elapsed;
  const d = PENALTY_LAUNCH_DURATION;
  const fadeInEnd = d * 0.38;
  const fadeOutStart = d * 0.52;

  let alpha = 0;
  if (t < fadeInEnd) alpha = t / fadeInEnd;
  else if (t < fadeOutStart) alpha = 1;
  else alpha = 1 - (t - fadeOutStart) / (d - fadeOutStart);

  ctx.fillStyle = `rgba(4, 8, 18, ${alpha * 0.94})`;
  ctx.fillRect(0, 0, 1200, 700);

  if (t > fadeInEnd * 0.55 && t < fadeOutStart + 0.12) {
    const textT = clamp01((t - fadeInEnd * 0.55) / 0.22);
    const textAlpha = textT < 0.5 ? textT * 2 : 1 - (textT - 0.5) * 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, textAlpha));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 56px Arial";
    ctx.fillStyle = "#fff59d";
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 6;
    ctx.strokeText("ПЕНАЛЬТИ", 600, 320);
    ctx.fillText("ПЕНАЛЬТИ", 600, 320);
    ctx.font = "22px Arial";
    ctx.fillStyle = "rgba(226, 232, 240, 0.95)";
    ctx.fillText("Забей 5 голов вратарю", 600, 378);
    ctx.restore();
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
