import SettingsSystem from "../systems/SettingsSystem.js";

export const settingsUi = {
  backButton: { x: 20, y: 18, w: 120, h: 48 },
  musicTrack: { x: 220, y: 268, w: 760, h: 28 },
  sfxTrack: { x: 220, y: 388, w: 760, h: 28 },
  /** @type {"music" | "sfx" | null} */
  dragging: null,
  dragPointerId: null,
};

const MENU_MUSIC_BASE = 0.55;

function valueFromTrackX(track, px) {
  const t = (px - track.x) / track.w;
  return Math.max(0, Math.min(1, t));
}

export function getSettingsSliderAt(px, py) {
  const pad = 18;
  const hit = (track) =>
    px >= track.x - pad &&
    px <= track.x + track.w + pad &&
    py >= track.y - pad &&
    py <= track.y + track.h + pad;

  if (hit(settingsUi.musicTrack)) return "music";
  if (hit(settingsUi.sfxTrack)) return "sfx";
  return null;
}

export function applySettingsSliderPointer(which, px) {
  const track = which === "music" ? settingsUi.musicTrack : settingsUi.sfxTrack;
  const value = valueFromTrackX(track, px);
  if (which === "music") {
    SettingsSystem.setMusicVolume(value);
  } else {
    SettingsSystem.setSfxVolume(value);
  }
}

export function drawSettingsScreen(ctx, drawButton) {
  const vignette = ctx.createRadialGradient(600, 120, 40, 600, 350, 620);
  vignette.addColorStop(0, "rgba(45,212,191,0.12)");
  vignette.addColorStop(0.45, "rgba(15,23,42,0)");
  vignette.addColorStop(1, "rgba(7,11,20,0.92)");
  ctx.fillStyle = "#070b14";
  ctx.fillRect(0, 0, 1200, 700);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 1200, 700);

  drawButton(settingsUi.backButton, "← Назад", "#37474f");

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 40px Arial";
  ctx.fillText("Настройки", 600, 108);
  ctx.font = "18px Arial";
  ctx.fillStyle = "rgba(148,163,184,0.95)";
  ctx.fillText("Громкость сохраняется на этом устройстве", 600, 148);

  drawVolumeSlider(
    ctx,
    settingsUi.musicTrack,
    "Музыка",
    SettingsSystem.getMusicVolume(),
    "#2dd4bf",
  );
  drawVolumeSlider(
    ctx,
    settingsUi.sfxTrack,
    "Звуки (клики, удары и т.д.)",
    SettingsSystem.getSfxVolume(),
    "#60a5fa",
  );
}

function drawVolumeSlider(ctx, track, label, value, accent) {
  const labelY = track.y - 42;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 22px Arial";
  ctx.fillText(label, track.x, labelY);

  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.font = "bold 22px Arial";
  ctx.fillText(SettingsSystem.formatPercent(value), track.x + track.w, labelY);

  const trackY = track.y + track.h / 2;
  const trackH = 10;
  ctx.beginPath();
  ctx.roundRect(track.x, trackY - trackH / 2, track.w, trackH, 5);
  ctx.fillStyle = "rgba(30,41,59,0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const fillW = Math.max(0, track.w * value);
  if (fillW > 2) {
    ctx.beginPath();
    ctx.roundRect(track.x, trackY - trackH / 2, fillW, trackH, 5);
    ctx.fillStyle = accent;
    ctx.fill();
  }

  const thumbX = track.x + track.w * value;
  const thumbR = 16;
  ctx.beginPath();
  ctx.arc(thumbX, trackY, thumbR, 0, Math.PI * 2);
  ctx.fillStyle = "#f8fafc";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
}
