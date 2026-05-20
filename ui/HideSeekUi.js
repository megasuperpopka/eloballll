import SkinSystem from "../systems/SkinSystem.js";
import { drawParkMap, PARK } from "../game/HideSeekAssets.js";
import { drawHideSeekJoystick } from "./HideSeekJoystick.js";
import { HIDING_DURATION, SEEK_DURATION } from "../game/HideSeekGame.js";

export const hideSeekRoleUi = {
  hideButton: { x: 200, y: 300, w: 360, h: 88 },
  seekButton: { x: 640, y: 300, w: 360, h: 88 },
  backButton: { x: 20, y: 18, w: 120, h: 48 },
};

export const hideSeekResultUi = {
  menuButton: { x: 420, y: 580, w: 360, h: 52 },
};

export const hideSeekConfirmUi = {
  yesButton: { x: 340, y: 400, w: 220, h: 52 },
  noButton: { x: 640, y: 400, w: 220, h: 52 },
};

function isInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawHideSeekRoleSelect(ctx, drawButton, uiTime, overlayAlpha) {
  const bg = ctx.createLinearGradient(0, 0, 0, 700);
  bg.addColorStop(0, "#1a237e");
  bg.addColorStop(0.5, "#283593");
  bg.addColorStop(1, "#0d1b2a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 700);

  const pulse = 0.5 + 0.5 * Math.sin(uiTime * 2.5);
  ctx.fillStyle = `rgba(129,199,132,${0.08 + pulse * 0.06})`;
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.arc(100 + i * 95, 120 + (i % 3) * 40, 30 + (i % 4) * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px Arial";
  ctx.fillText("Прятки", 600, 140);
  ctx.font = "22px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Весенний парк · мемы и укрытия", 600, 195);
  ctx.fillText("Спрячься или стань «водой» и найди мема", 600, 228);

  drawButton(hideSeekRoleUi.hideButton, "Прятаться", "#2e7d32");
  drawButton(hideSeekRoleUi.seekButton, "Искать мемов", "#1565c0");
  drawButton(hideSeekRoleUi.backButton, "Назад", "#455a64");

  if (overlayAlpha > 0.02) {
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, 1200, 700);
  }
}

export function getHideSeekRoleActionAt(x, y) {
  if (isInRect(x, y, hideSeekRoleUi.backButton)) return "BACK";
  if (isInRect(x, y, hideSeekRoleUi.hideButton)) return "HIDE";
  if (isInRect(x, y, hideSeekRoleUi.seekButton)) return "SEEK";
  return null;
}

export function drawHideSeekConfirmDialog(ctx, game, drawButton) {
  if (!game.confirmSpotId) return;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, 1200, 700);

  const pw = 720;
  const ph = 200;
  const px = 240;
  const py = 250;
  ctx.fillStyle = "rgba(12, 22, 18, 0.96)";
  ctx.strokeStyle = "rgba(129,199,132,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 16);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Arial";
  ctx.fillText(game.getConfirmLabel(), 600, py + 56);
  ctx.font = "18px Arial";
  ctx.fillStyle = "rgba(226,232,240,0.9)";
  ctx.fillText("Подойди ближе к объекту на карте", 600, py + 92);

  drawButton(hideSeekConfirmUi.yesButton, "Да", "#2e7d32");
  drawButton(hideSeekConfirmUi.noButton, "Нет", "#546e7a");
}

export function getHideSeekConfirmActionAt(x, y) {
  if (isInRect(x, y, hideSeekConfirmUi.yesButton)) return "YES";
  if (isInRect(x, y, hideSeekConfirmUi.noButton)) return "NO";
  return null;
}

/**
 * @param {import("../game/HideSeekGame.js").HideSeekGame} game
 * @param {ReturnType<import("./HideSeekJoystick.js").createHideSeekJoystick>} joy
 */
export function drawHideSeekPlay(ctx, game, uiTime, drawButton, joy) {
  drawParkMap(ctx, game.spots, {
    selectedId: game.selectedSpotId,
    checkedIds: game.checkedSpots,
    hiddenSpotId: game.getHiddenSpotIdForDraw(),
  });

  if (game.shouldDrawPlayerAvatar()) {
    const skin = SkinSystem.getActiveSkin();
    SkinSystem.drawSkinInCircle(ctx, skin, game.playerX, game.playerY, 28);
    ctx.textAlign = "center";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeText("ТЫ", game.playerX, game.playerY + 44);
    ctx.fillText("ТЫ", game.playerX, game.playerY + 44);
  }

  if (game.shouldDrawBotSeeker()) {
    const skin = SkinSystem.getSkinById(game.botMemeSkinId);
    SkinSystem.drawSkinInCircle(ctx, skin, game.botX, game.botY, 28);
    ctx.textAlign = "center";
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#e3f2fd";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeText("ВОДА", game.botX, game.botY + 44);
    ctx.fillText("ВОДА", game.botX, game.botY + 44);
  }

  if (game.canMovePlayer() && joy) {
    drawHideSeekJoystick(ctx, joy);
  }

  const barY = 8;
  ctx.fillStyle = "rgba(8, 22, 12, 0.78)";
  ctx.fillRect(0, barY, 1200, 44);
  ctx.textAlign = "center";
  ctx.font = "bold 20px Arial";
  ctx.fillStyle = "#e8f5e9";
  ctx.fillText(game.getStatusLine(), 600, barY + 28);

  const timerY = 54;
  if (game.phase === "hiding") {
    const t = Math.max(0, game.hideTimer);
    const pct = t / HIDING_DURATION;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(PARK.x, timerY, PARK.w, 10);
    ctx.fillStyle = game.playerRole === "hider" ? "#66bb6a" : "#42a5f5";
    ctx.fillRect(PARK.x, timerY, PARK.w * pct, 10);
  }
  if (game.phase === "seeking") {
    const t = Math.max(0, game.seekTimer);
    const pct = t / SEEK_DURATION;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(PARK.x, timerY, PARK.w, 10);
    ctx.fillStyle = "#ff7043";
    ctx.fillRect(PARK.x, timerY, PARK.w * pct, 10);
  }

  if (game.phase === "announce") {
    const a = Math.min(1, game.phaseTime / 0.55);
    ctx.fillStyle = `rgba(0,0,0,${0.5 * a})`;
    ctx.fillRect(0, 0, 1200, 700);
    ctx.textAlign = "center";
    ctx.font = "bold 44px Arial";
    ctx.fillStyle = game.playerRole === "hider" ? "#ff5252" : "#4fc3f7";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 6;
    const msg = game.playerRole === "hider" ? "Вода начала поиски!" : "Ищи мема!";
    ctx.strokeText(msg, 600, 340);
    ctx.fillText(msg, 600, 340);
    ctx.font = "22px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${SEEK_DURATION} секунд на поиск`, 600, 392);
  }

  drawHideSeekConfirmDialog(ctx, game, drawButton);

  if (game.phase === "result") {
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, 0, 1200, 700);
    const win = game.result === "win";
    ctx.textAlign = "center";
    ctx.font = "bold 48px Arial";
    ctx.fillStyle = win ? "#69f0ae" : "#ff8a80";
    ctx.fillText(win ? "УСПЕХ!" : "ПОЙМАЛИ", 600, 220);
    ctx.font = "24px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(game.resultMessage, 600, 280);

    if (win && game.playerRole === "seeker" && game.rewardSkinId) {
      const skin = SkinSystem.getSkinById(game.rewardSkinId);
      ctx.save();
      ctx.translate(600, 400);
      ctx.beginPath();
      ctx.arc(0, 0, 72, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 4;
      ctx.stroke();
      SkinSystem.drawSkinInCircle(ctx, skin, 0, 0, 64);
      ctx.restore();
      ctx.font = "bold 22px Arial";
      ctx.fillStyle = "#ffe082";
      ctx.fillText(skin?.name ?? "Мем-скин", 600, 500);
      if (game.rewardGold > 0) {
        ctx.fillText(`+${game.rewardGold} gold`, 600, 532);
      }
    }

    drawButton(hideSeekResultUi.menuButton, "В меню", "#455a64");
  }
}

export function getHideSeekResultActionAt(x, y) {
  if (isInRect(x, y, hideSeekResultUi.menuButton)) return "MENU";
  return null;
}
