/** Виртуальный джойстик для режима «Прятки». */

const BASE = { x: 118, y: 578, r: 72 };
const STICK_MAX = 48;

export function createHideSeekJoystick() {
  return {
    active: false,
    pointerId: null,
    baseX: BASE.x,
    baseY: BASE.y,
    stickX: BASE.x,
    stickY: BASE.y,
    dx: 0,
    dy: 0,
  };
}

function clampStick(joy, px, py) {
  const dx = px - joy.baseX;
  const dy = py - joy.baseY;
  const d = Math.hypot(dx, dy);
  if (d <= STICK_MAX) {
    joy.stickX = px;
    joy.stickY = py;
  } else {
    joy.stickX = joy.baseX + (dx / d) * STICK_MAX;
    joy.stickY = joy.baseY + (dy / d) * STICK_MAX;
  }
  const nd = Math.min(STICK_MAX, d);
  joy.dx = nd > 4 ? (dx / d) * (nd / STICK_MAX) : 0;
  joy.dy = nd > 4 ? (dy / d) * (nd / STICK_MAX) : 0;
}

export function joystickPointerDown(joy, pointerId, x, y) {
  if (Math.hypot(x - joy.baseX, y - joy.baseY) > BASE.r + 24) return false;
  joy.active = true;
  joy.pointerId = pointerId;
  clampStick(joy, x, y);
  return true;
}

export function joystickPointerMove(joy, pointerId, x, y) {
  if (!joy.active || joy.pointerId !== pointerId) return;
  clampStick(joy, x, y);
}

export function joystickPointerUp(joy, pointerId) {
  if (!joy.active || joy.pointerId !== pointerId) return;
  joy.active = false;
  joy.pointerId = null;
  joy.stickX = joy.baseX;
  joy.stickY = joy.baseY;
  joy.dx = 0;
  joy.dy = 0;
}

export function drawHideSeekJoystick(ctx, joy) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
  ctx.beginPath();
  ctx.arc(joy.baseX, joy.baseY, BASE.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(45, 212, 191, 0.85)";
  ctx.beginPath();
  ctx.arc(joy.stickX, joy.stickY, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function isPointOnJoystick(joy, x, y) {
  return Math.hypot(x - joy.baseX, y - joy.baseY) <= BASE.r + 30;
}
