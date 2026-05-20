import { resolveGameAssetUrl } from "../systems/AssetUrl.js";

export const MAP_PATH = "assets/images/maps/pryatki.png";

export const OBJECT_TEMPLATES = [
  { kind: "tree", file: "assets/images/objects/derevo.png", label: "Дерево", drawW: 118, drawH: 118, count: 5 },
  { kind: "bush", file: "assets/images/objects/kyst.png", label: "Куст", drawW: 96, drawH: 96, count: 6 },
  { kind: "bench", file: "assets/images/objects/skameika.png", label: "Скамейка", drawW: 108, drawH: 58, count: 3 },
  { kind: "mound", file: "assets/images/objects/kychka.png", label: "Земляная кучка", drawW: 92, drawH: 82, count: 4 },
];

/** Игровая зона поверх карты (отступы от краёв). */
export const PARK = { x: 24, y: 48, w: 1152, h: 604 };

const imageCache = new Map();

function loadImage(path) {
  if (imageCache.has(path)) return imageCache.get(path);
  const img = new Image();
  img.src = resolveGameAssetUrl(path);
  imageCache.set(path, img);
  return img;
}

export function preloadHideSeekAssets() {
  loadImage(MAP_PATH);
  for (const t of OBJECT_TEMPLATES) loadImage(t.file);
}

export function getMapImage() {
  return loadImage(MAP_PATH);
}

export function getObjectImage(file) {
  return loadImage(file);
}

function rectsOverlap(a, b, pad = 18) {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

/**
 * Случайная расстановка объектов на карте.
 * @returns {{ id: string, kind: string, label: string, file: string, x: number, y: number, w: number, h: number }[]}
 */
export function generateRandomSpots() {
  const placed = [];
  let idN = 0;

  for (const tpl of OBJECT_TEMPLATES) {
    for (let i = 0; i < tpl.count; i += 1) {
      let spot = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const w = tpl.drawW;
        const h = tpl.drawH;
        const x = PARK.x + 40 + Math.random() * (PARK.w - w - 80);
        const y = PARK.y + 40 + Math.random() * (PARK.h - h - 80);
        const candidate = { x, y, w, h };
        if (placed.every((p) => !rectsOverlap(candidate, p))) {
          spot = {
            id: `${tpl.kind}_${idN}`,
            kind: tpl.kind,
            label: tpl.label,
            file: tpl.file,
            ...candidate,
          };
          break;
        }
      }
      if (spot) {
        placed.push(spot);
        idN += 1;
      }
    }
  }
  return placed;
}

export function spotCenter(spot) {
  return { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 };
}

export function clampToPark(x, y, margin = 22) {
  return {
    x: Math.max(PARK.x + margin, Math.min(PARK.x + PARK.w - margin, x)),
    y: Math.max(PARK.y + margin, Math.min(PARK.y + PARK.h - margin, y)),
  };
}

export function hitTestSpot(px, py, spots) {
  for (let i = spots.length - 1; i >= 0; i -= 1) {
    const s = spots[i];
    if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return s;
  }
  return null;
}

export function findNearestSpot(px, py, spots, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const s of spots) {
    const c = spotCenter(s);
    const d = Math.hypot(px - c.x, py - c.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function drawParkMap(ctx, spots, spotState) {
  const { selectedId = null, checkedIds = new Set(), hiddenSpotId = null } = spotState ?? {};

  const mapImg = getMapImage();
  if (mapImg.complete && mapImg.naturalWidth > 0) {
    ctx.drawImage(mapImg, 0, 0, 1200, 700);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 700);
    g.addColorStop(0, "#81d4fa");
    g.addColorStop(1, "#aed581");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1200, 700);
  }

  for (const spot of spots) {
    const img = getObjectImage(spot.file);
    const cx = spot.x + spot.w / 2;
    const cy = spot.y + spot.h / 2;

    if (spot.id === selectedId) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 235, 59, 0.95)";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(spot.x - 6, spot.y - 6, spot.w + 12, spot.h + 12);
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (checkedIds.has(spot.id) && spot.id !== hiddenSpotId) {
      ctx.fillStyle = "rgba(100,116,139,0.4)";
      ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
    }

    ctx.save();
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, spot.x, spot.y, spot.w, spot.h);
    } else {
      ctx.fillStyle = "#66bb6a";
      ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
    }
    ctx.restore();

    if (spot.id === hiddenSpotId) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy - 6, 20, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.strokeStyle = "#1565c0";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }
}
