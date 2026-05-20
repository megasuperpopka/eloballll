import StorageSystem from "./StorageSystem.js";
import CurrencySystem from "./CurrencySystem.js";
import SkinSystem from "./SkinSystem.js";

/** Цена продажи в gold: [редкость][цветной | мемный]. */
const SELL_GOLD = {
  Rare: { color: 50, meme: 100, vip: 40 },
  Epic: { color: 100, meme: 200, vip: 80 },
  Mythic: { color: 200, meme: 1000, vip: 150 },
  Legendary: { color: 500, meme: 2000, vip: 280 },
  Top: { color: 3000, meme: 10000, vip: 600 },
};

function sellCategory(skin) {
  if (!skin) return null;
  if (skin.type === "image") return "meme";
  if (skin.type === "color" || skin.type === "dual") return "color";
  if (skin.type === "ball_paint" || skin.type === "goal_paint") return "vip";
  return null;
}

const SkinSellSystem = {
  SELL_GOLD,

  /** @returns {number | null} цена в gold или null если продать нельзя */
  getSellPrice(skinOrId) {
    const skin = typeof skinOrId === "string" ? SkinSystem.getSkinById(skinOrId) : skinOrId;
    if (!skin || skin.id === "default") return null;
    if (skin.type === "painted") return null;
    const rarityKey = String(skin.rarity || "").toLowerCase();
    if (rarityKey === "админ" || rarityKey === "admin") return null;
    const cat = sellCategory(skin);
    if (!cat) return null;
    const row = SELL_GOLD[skin.rarity];
    if (!row) return null;
    return row[cat] ?? null;
  },

  canSell(skinId) {
    return this.getSellPrice(skinId) !== null;
  },

  /**
   * @returns {{ ok: true, gold: number } | { ok: false, reason: "UNKNOWN" | "CANT_SELL" | "LAST_SKIN" }}
   */
  sell(skinId) {
    const id = typeof skinId === "string" ? skinId : "";
    if (!id || id === "default") return { ok: false, reason: "CANT_SELL" };

    const skin = SkinSystem.getSkinById(id);
    const price = this.getSellPrice(skin);
    if (price === null) return { ok: false, reason: "CANT_SELL" };

    const inventory = StorageSystem.getInventory();
    if (!inventory.includes(id)) return { ok: false, reason: "UNKNOWN" };

    const without = inventory.filter((sid) => sid !== id);
    if (without.length === 0) {
      return { ok: false, reason: "LAST_SKIN" };
    }
    if (!without.includes("default")) {
      without.unshift("default");
    }

    StorageSystem.setInventory(without);

    const active = StorageSystem.getActiveSkin();
    if (active === id) {
      const fallback = without.includes("default") ? "default" : without[0];
      StorageSystem.setActiveSkin(fallback);
    }
    if (StorageSystem.getActiveBallPaint() === id) StorageSystem.setActiveBallPaint("");
    if (StorageSystem.getActiveGoalPaint() === id) StorageSystem.setActiveGoalPaint("");

    CurrencySystem.addGold(price);
    return { ok: true, gold: price };
  },
};

export default SkinSellSystem;
