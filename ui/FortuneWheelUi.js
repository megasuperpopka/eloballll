import SkinSystem from "../systems/SkinSystem.js";
import FortuneWheelSystem from "../systems/FortuneWheelSystem.js";

export const WHEEL_CX = 600;
export const WHEEL_CY = 355;
export const WHEEL_R = 215;

const SEGMENT_COLORS = [
  "#a8e6cf",
  "#ffd3e1",
  "#fff9c4",
  "#b3e5fc",
  "#c5e1a5",
  "#ffe0b2",
  "#e1bee7",
  "#f8bbd0",
];

function drawSpringBackdrop(ctx, uiTime) {
  const bg = ctx.createLinearGradient(0, 0, 0, 700);
  bg.addColorStop(0, "#e8f5e9");
  bg.addColorStop(0.45, "#fff8e1");
  bg.addColorStop(1, "#fce4ec");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 700);

  for (let i = 0; i < 18; i += 1) {
    const px = (i * 113 + uiTime * 12) % 1280 - 40;
    const py = 40 + (i % 6) * 105;
    ctx.fillStyle = `rgba(129,199,132,${0.06 + (i % 3) * 0.03})`;
    ctx.beginPath();
    ctx.arc(px, py, 8 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  const petals = 6;
  for (let p = 0; p < petals; p += 1) {
    const a = (p / petals) * Math.PI * 2 + uiTime * 0.2;
    const fx = 600 + Math.cos(a) * 520;
    const fy = 120 + Math.sin(a) * 80;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(a);
    ctx.fillStyle = "rgba(244,143,177,0.12)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFlower(ctx, x, y, size, hue) {
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.translate(x + Math.cos(a) * size * 0.45, y + Math.sin(a) * size * 0.45);
    ctx.fillStyle = hue;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#fff59d";
  ctx.beginPath();
  ctx.arc(x, y, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function slotLabel(skin) {
  if (!skin) return "?";
  if (skin.type === "ball_paint") return "Мяч";
  if (skin.type === "goal_paint") return "Ворота";
  return "Скин";
}

export function layoutFortuneWheelControls(shopUi) {
  shopUi.wheelSpinButton = { x: 420, y: 612, w: 280, h: 52 };
  shopUi.wheelRefreshButton = { x: 720, y: 612, w: 280, h: 52 };
  shopUi.wheelResultOkButton = { x: 470, y: 580, w: 260, h: 50 };
}

export function drawFortuneWheelScreen(ctx, opts) {
  const {
    shopUi,
    snapshot,
    uiTime,
    drawButton,
    drawRarityBadge,
    getRarityVisual,
  } = opts;

  const panelTop = opts.panelTop ?? 128;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, panelTop, 1200, 700 - panelTop);
  ctx.clip();
  drawSpringBackdrop(ctx, uiTime);
  drawFlower(ctx, 88, 220, 22, "rgba(240,98,146,0.55)");
  drawFlower(ctx, 1110, 210, 20, "rgba(129,199,132,0.55)");
  drawFlower(ctx, 100, 620, 18, "rgba(255,213,79,0.5)");
  drawFlower(ctx, 1100, 610, 20, "rgba(186,104,200,0.45)");

  ctx.textAlign = "center";
  ctx.fillStyle = "#2e7d32";
  ctx.font = "bold 28px Arial";
  ctx.fillText("Весеннее колесо", 600, 198);
  ctx.font = "14px Arial";
  ctx.fillStyle = "rgba(46,125,50,0.8)";
  ctx.fillText(`Авто-обновление через ${snapshot.refreshLabel}`, 600, 222);

  const slotCount = FortuneWheelSystem.WHEEL_SLOT_COUNT;
  const slice = (Math.PI * 2) / slotCount;
  const rotation = shopUi.wheelRotation || 0;

  ctx.save();
  ctx.translate(WHEEL_CX, WHEEL_CY);
  ctx.rotate(rotation);

  for (let i = 0; i < slotCount; i += 1) {
    const a0 = -Math.PI / 2 + i * slice;
    const a1 = a0 + slice;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, WHEEL_R, a0, a1);
    ctx.closePath();
    ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const mid = (a0 + a1) / 2;
    const skin = snapshot.skins[i];
    const pr = WHEEL_R * 0.72;
    const px = Math.cos(mid) * pr;
    const py = Math.sin(mid) * pr;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(mid + Math.PI / 2);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.strokeStyle = getRarityVisual(skin?.rarity).color;
    ctx.lineWidth = 2;
    ctx.stroke();
    SkinSystem.drawSkinInCircle(ctx, skin, 0, 0, 24);
    ctx.fillStyle = "#1b5e20";
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "center";
    ctx.fillText(slotLabel(skin), 0, 38);
    ctx.restore();
  }

  const hubGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 52);
  hubGrad.addColorStop(0, "#fffde7");
  hubGrad.addColorStop(0.6, "#ffeb3b");
  hubGrad.addColorStop(1, "#f9a825");
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = "#f57f17";
  ctx.lineWidth = 3;
  ctx.stroke();
  drawFlower(ctx, 0, 0, 14, "rgba(244,67,54,0.75)");

  ctx.restore();

  ctx.save();
  ctx.translate(WHEEL_CX, WHEEL_CY - WHEEL_R - 18);
  ctx.fillStyle = "#e91e63";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-22, -36);
  ctx.lineTo(22, -36);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ad1457";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const rimPulse = 0.5 + 0.5 * Math.sin(uiTime * 3);
  ctx.beginPath();
  ctx.arc(WHEEL_CX, WHEEL_CY, WHEEL_R + 10, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(129,199,132,${0.35 + rimPulse * 0.25})`;
  ctx.lineWidth = 6;
  ctx.stroke();

  if (!shopUi.wheelSpinning && !shopUi.wheelShowResult) {
    const freeSpin = snapshot.freeSpinAvailable === true;
    const canPay =
      snapshot.tokens >= FortuneWheelSystem.WHEEL_SPIN_TOKEN_COST;
    const spinLabel = freeSpin
      ? "Крутить (бесплатно сегодня)"
      : `Крутить (${FortuneWheelSystem.WHEEL_SPIN_TOKEN_COST} жетонов)`;
    drawButton(shopUi.wheelSpinButton, spinLabel, freeSpin || canPay ? "#2e7d32" : "#546e7a");
    drawButton(
      shopUi.wheelRefreshButton,
      `Обновить (${FortuneWheelSystem.WHEEL_REFRESH_GOLD_COST} gold)`,
      "#f57c00",
    );
    ctx.textAlign = "center";
    ctx.font = "15px Arial";
    ctx.fillStyle = "rgba(30,70,32,0.75)";
    const spinHint = freeSpin
      ? "Сегодня доступен 1 бесплатный спин · дальше — жетоны"
      : "Бесплатный спин завтра · победа в матче = +1 жетон";
    ctx.fillText(`${spinHint} · колесо обновляется каждые сутки`, 600, 678);
  }

  if (shopUi.wheelShowResult && shopUi.wheelResult?.skin) {
    ctx.fillStyle = "rgba(8,20,12,0.72)";
    ctx.fillRect(0, 0, 1200, 700);
    const skin = shopUi.wheelResult.skin;
    const style = getRarityVisual(skin.rarity);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Arial";
    ctx.fillText("Твой приз!", 600, 200);
    ctx.save();
    ctx.translate(600, 340);
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 4;
    ctx.stroke();
    SkinSystem.drawSkinInCircle(ctx, skin, 0, 0, 78);
    ctx.restore();
    ctx.font = "bold 26px Arial";
    ctx.fillText(skin.name, 600, 455);
    drawRarityBadge(530, 472, 140, 28, skin.rarity);
    if (shopUi.wheelResult.isDuplicate) {
      ctx.font = "17px Arial";
      ctx.fillStyle = "#ffe082";
      ctx.fillText("(уже был в инвентаре)", 600, 510);
    }
    drawButton(shopUi.wheelResultOkButton, "Забрать", "#2e7d32");
  }

  ctx.restore();
}
