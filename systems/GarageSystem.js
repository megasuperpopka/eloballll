import CurrencySystem from "./CurrencySystem.js";
import SkinSystem from "./SkinSystem.js";
import { resolveGameAssetUrl } from "./AssetUrl.js";

export const GARAGE_KINDS = {
  normal: {
    id: "normal",
    price: 1500,
    dropCount: 5,
    imagePath: "assets/images/skins/garaz.png",
    title: "Гараж",
  },
  mega: {
    id: "mega",
    price: 3000,
    dropCount: 10,
    imagePath: "assets/images/skins/garaz2.png",
    title: "Гараж x10",
  },
};

/** @type {Map<string, HTMLImageElement>} */
const garageImages = new Map();

/** Top / Legendary / Mythic в гараже реже Rare / Epic (только гараж; ÷2 к прошлому балансу). */
const GARAGE_HIGH_RARITY_WEIGHT = 0.5 / 3 / 5 / 2;
const GARAGE_NORMAL_RARITY_WEIGHT = 1;

const GARAGE_DOWNWEIGHTED_RARITIES = new Set(["Mythic", "Legendary", "Top"]);

function getGarageConfig(kind) {
  return GARAGE_KINDS[kind] || GARAGE_KINDS.normal;
}

function getGarageSkinPool() {
  return SkinSystem.getAllSkins().filter(
    (s) =>
      s.id !== "default" &&
      s.caseGroup !== "admin" &&
      (s.type === "image" || s.type === "color" || s.type === "dual"),
  );
}

function skinGarageWeight(skin) {
  return GARAGE_DOWNWEIGHTED_RARITIES.has(skin.rarity)
    ? GARAGE_HIGH_RARITY_WEIGHT
    : GARAGE_NORMAL_RARITY_WEIGHT;
}

function pickWeightedGarageSkin(pool) {
  let total = 0;
  for (let i = 0; i < pool.length; i += 1) {
    total += skinGarageWeight(pool[i]);
  }
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= skinGarageWeight(pool[i]);
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function pickRandomSkins(pool, count) {
  const drops = [];
  for (let i = 0; i < count; i += 1) {
    drops.push(pickWeightedGarageSkin(pool));
  }
  return drops;
}

const GarageSystem = {
  getConfig(kind = "normal") {
    return { ...getGarageConfig(kind) };
  },

  getPrice(kind = "normal") {
    return getGarageConfig(kind).price;
  },

  canOpen(kind = "normal") {
    return CurrencySystem.getGold() >= getGarageConfig(kind).price;
  },

  getGarageImage(kind = "normal") {
    const cfg = getGarageConfig(kind);
    if (!garageImages.has(cfg.id)) {
      const img = new Image();
      img.src = resolveGameAssetUrl(cfg.imagePath);
      garageImages.set(cfg.id, img);
    }
    return garageImages.get(cfg.id);
  },

  preloadGarageImages() {
    for (const key of Object.keys(GARAGE_KINDS)) {
      this.getGarageImage(key);
    }
  },

  /** @deprecated используй preloadGarageImages */
  preloadGarageImage() {
    this.preloadGarageImages();
  },

  /**
   * @param {"normal" | "mega"} [kind]
   * @returns {{ ok: true, drops: { skin: object, isDuplicate: boolean }[], goldLeft: number, kind: string } | { ok: false, reason: string, drops: [] }}
   */
  open(kind = "normal") {
    const cfg = getGarageConfig(kind);
    if (!this.canOpen(kind)) {
      return { ok: false, reason: "NOT_ENOUGH_GOLD", drops: [] };
    }
    const spent = CurrencySystem.spend(cfg.price);
    if (!spent) {
      return { ok: false, reason: "NOT_ENOUGH_GOLD", drops: [] };
    }

    const pool = getGarageSkinPool();
    if (pool.length === 0) {
      return { ok: false, reason: "NO_SKINS", drops: [] };
    }

    const rolled = pickRandomSkins(pool, cfg.dropCount);
    const drops = rolled.map((skin) => {
      const wasOwned = SkinSystem.hasSkin(skin.id);
      const unlocked = SkinSystem.unlockSkin(skin.id);
      return { skin: unlocked, isDuplicate: wasOwned };
    });

    return { ok: true, drops, goldLeft: CurrencySystem.getGold(), kind: cfg.id };
  },
};

export default GarageSystem;
