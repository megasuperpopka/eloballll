import StorageSystem from "./StorageSystem.js";
import CurrencySystem from "./CurrencySystem.js";
import SkinSystem from "./SkinSystem.js";

export const WHEEL_SLOT_COUNT = 8;
export const WHEEL_SPIN_TOKEN_COST = 5;
export const WHEEL_REFRESH_GOLD_COST = 2000;

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getWheelPool() {
  return SkinSystem.getAllSkins().filter(
    (s) =>
      s.caseGroup !== "admin" &&
      s.id !== "default" &&
      s.type !== "painted" &&
      (s.type === "ball_paint" ||
        s.type === "goal_paint" ||
        s.type === "image" ||
        s.type === "dual" ||
        s.type === "color"),
  );
}

function pickWheelSkinIds() {
  const pool = getWheelPool();
  if (pool.length === 0) return Array(WHEEL_SLOT_COUNT).fill("default");
  const ids = shuffle(pool.map((s) => s.id));
  const out = [];
  for (let i = 0; i < WHEEL_SLOT_COUNT; i += 1) {
    out.push(ids[i % ids.length]);
  }
  return shuffle(out);
}

function readWheelBlob() {
  const raw = StorageSystem.getFortuneWheel();
  if (!raw || typeof raw !== "object") return null;
  const skinIds = Array.isArray(raw.skinIds)
    ? raw.skinIds.filter((id) => typeof id === "string").slice(0, WHEEL_SLOT_COUNT)
    : [];
  if (skinIds.length !== WHEEL_SLOT_COUNT) return null;
  return {
    dayKey: typeof raw.dayKey === "string" ? raw.dayKey : "",
    skinIds,
  };
}

function writeWheelBlob(blob) {
  StorageSystem.setFortuneWheel({
    dayKey: blob.dayKey,
    skinIds: blob.skinIds.slice(0, WHEEL_SLOT_COUNT),
  });
}

function msUntilNextDay() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, next.getTime() - now.getTime());
}

function formatTimeUntilRefresh(ms) {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

const FortuneWheelSystem = {
  WHEEL_SLOT_COUNT,
  WHEEL_SPIN_TOKEN_COST,
  WHEEL_REFRESH_GOLD_COST,

  ensureDailyWheel() {
    const today = todayKey();
    const cur = readWheelBlob();
    if (cur && cur.dayKey === today) return cur;
    const blob = { dayKey: today, skinIds: pickWheelSkinIds() };
    writeWheelBlob(blob);
    return blob;
  },

  regenerateWheel() {
    const blob = { dayKey: todayKey(), skinIds: pickWheelSkinIds() };
    writeWheelBlob(blob);
    return blob;
  },

  getTokens() {
    return StorageSystem.getFortuneTokens();
  },

  grantMatchWinToken() {
    const before = StorageSystem.getFortuneTokens();
    StorageSystem.setFortuneTokens(before + 1);
    return 1;
  },

  canUseFreeSpin() {
    return StorageSystem.getFortuneWheelFreeSpinDay() !== todayKey();
  },

  getSnapshot() {
    const wheel = this.ensureDailyWheel();
    const skins = wheel.skinIds.map((id) => SkinSystem.getSkinById(id)).filter(Boolean);
    return {
      tokens: this.getTokens(),
      skinIds: wheel.skinIds,
      skins,
      dayKey: wheel.dayKey,
      msUntilRefresh: msUntilNextDay(),
      refreshLabel: formatTimeUntilRefresh(msUntilNextDay()),
      freeSpinAvailable: this.canUseFreeSpin(),
    };
  },

  refreshForGold() {
    if (!CurrencySystem.spend(WHEEL_REFRESH_GOLD_COST)) {
      return { ok: false, reason: "NOT_ENOUGH_GOLD" };
    }
    const wheel = this.regenerateWheel();
    return { ok: true, wheel };
  },

  spin() {
    const useFreeSpin = this.canUseFreeSpin();
    if (!useFreeSpin && this.getTokens() < WHEEL_SPIN_TOKEN_COST) {
      return { ok: false, reason: "NOT_ENOUGH_TOKENS", skin: null, index: -1 };
    }
    const wheel = this.ensureDailyWheel();
    if (useFreeSpin) {
      StorageSystem.setFortuneWheelFreeSpinDay(todayKey());
    } else {
      StorageSystem.setFortuneTokens(this.getTokens() - WHEEL_SPIN_TOKEN_COST);
    }
    const index = Math.floor(Math.random() * WHEEL_SLOT_COUNT);
    const skinId = wheel.skinIds[index];
    const alreadyOwned = SkinSystem.hasSkin(skinId);
    const skin = SkinSystem.unlockSkin(skinId);
    return {
      ok: true,
      reason: null,
      index,
      skin,
      isDuplicate: alreadyOwned,
      tokensLeft: this.getTokens(),
      usedFreeSpin: useFreeSpin,
    };
  },
};

export default FortuneWheelSystem;
