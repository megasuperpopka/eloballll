/**
 * Раскладка только для нативного приложения (Capacitor APK / iOS).
 * В обычном браузере на ПК всё остаётся как было.
 */

/** В APK: визуальный размер игрока, бота и мяча (физика не меняется). */
export const NATIVE_MOBILE_WORLD_DRAW_SCALE = 1.5;

/** @deprecated используй NATIVE_MOBILE_WORLD_DRAW_SCALE */
export const NATIVE_MOBILE_PLAYER_DRAW_SCALE = NATIVE_MOBILE_WORLD_DRAW_SCALE;

/** Кнопки и зоны тапа в UI (меню, магазин, мастер скина и т.д.). */
export const NATIVE_MOBILE_UI_BUTTON_SCALE = 1.5;

export function isNativeMobileApp() {
  try {
    return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** APK, телефон в браузере, узкий экран — меньше частиц и проще отрисовка. */
let cachedUseLowEffects = null;

export function useLowEffects() {
  if (cachedUseLowEffects !== null) return cachedUseLowEffects;
  if (isNativeMobileApp()) {
    cachedUseLowEffects = true;
    return true;
  }
  try {
    const w = typeof window !== "undefined" ? window : null;
    if (!w) {
      cachedUseLowEffects = false;
      return false;
    }
    const touch = (w.navigator?.maxTouchPoints ?? 0) > 0;
    const coarse = w.matchMedia?.("(pointer: coarse)")?.matches === true;
    const narrow = w.innerWidth > 0 && w.innerWidth <= 1024;
    const reduceMotion = w.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    cachedUseLowEffects = reduceMotion || (touch && (coarse || narrow));
  } catch {
    cachedUseLowEffects = false;
  }
  return cachedUseLowEffects;
}

/** Сколько частиц конфетти спавнить относительно ПК (0…1). */
export function getConfettiSpawnScale() {
  return useLowEffects() ? 0.3 : 1;
}

export function getConfettiMaxParticles() {
  return useLowEffects() ? 95 : 380;
}

export function getPlayerDrawScale() {
  return isNativeMobileApp() ? NATIVE_MOBILE_WORLD_DRAW_SCALE : 1;
}

export function getBallDrawScale() {
  return isNativeMobileApp() ? NATIVE_MOBILE_WORLD_DRAW_SCALE : 1;
}

export function getUiButtonScale() {
  return isNativeMobileApp() ? NATIVE_MOBILE_UI_BUTTON_SCALE : 1;
}

/**
 * Увеличивает прямоугольник относительно центра (и отрисовка, и hit-test совпадают).
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {number} scale
 */
export function scaleUiRectAroundCenter(rect, scale) {
  if (!rect || scale === 1) return;
  const nw = rect.w * scale;
  const nh = rect.h * scale;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  rect.x = cx - nw / 2;
  rect.y = cy - nh / 2;
  rect.w = nw;
  rect.h = nh;
}

/** Увеличить кнопку у правого верхнего угла (правый край на месте). */
export function scaleUiRectAnchorTopRight(rect, scale) {
  if (!rect || scale === 1) return;
  const right = rect.x + rect.w;
  const top = rect.y;
  rect.w *= scale;
  rect.h *= scale;
  rect.x = right - rect.w;
  rect.y = top;
}
