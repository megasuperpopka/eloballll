/**
 * Медленно падающие зелёные листочки для меню и экранов вне матча/турнира.
 */

import { useLowEffects } from "../core/MobileLayout.js";

const LEAF_SHADES = ["#2e7d32", "#388e3c", "#43a047", "#4caf50", "#66bb6a", "#81c784"];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function spawnLeaf(width, height, fromTop = true) {
  const size = rand(10, 20);
  return {
    x: Math.random() * width,
    y: fromTop ? rand(-height * 0.15, height) : height + rand(8, 40),
    vy: rand(28, 58),
    vx: rand(-14, 14),
    size,
    rotation: rand(0, Math.PI * 2),
    spin: rand(-1.4, 1.4),
    swayPhase: rand(0, Math.PI * 2),
    swaySpeed: rand(1.1, 2.4),
    swayAmp: rand(12, 28),
    shade: LEAF_SHADES[Math.floor(Math.random() * LEAF_SHADES.length)],
    variant: Math.floor(Math.random() * 3),
  };
}

function drawLeafShape(ctx, variant) {
  ctx.beginPath();
  if (variant === 0) {
    ctx.moveTo(0, -1);
    ctx.bezierCurveTo(0.85, -0.55, 0.95, 0.35, 0, 1);
    ctx.bezierCurveTo(-0.95, 0.35, -0.85, -0.55, 0, -1);
  } else if (variant === 1) {
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(0.75, 0, 0, 1);
    ctx.quadraticCurveTo(-0.55, 0.15, 0, -1);
  } else {
    ctx.ellipse(0, 0, 0.55, 1, 0.15, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(20,60,30,0.45)";
  ctx.lineWidth = 0.06;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -0.75);
  ctx.lineTo(0, 0.85);
  ctx.strokeStyle = "rgba(27,94,32,0.55)";
  ctx.lineWidth = 0.05;
  ctx.stroke();
}

export function createFallingLeavesFx(width, height, count = 32) {
  const leaves = [];
  const lowFx = useLowEffects();
  const targetCount = lowFx ? Math.max(10, Math.round(count * 0.4)) : count;

  function seed(n = targetCount) {
    leaves.length = 0;
    for (let i = 0; i < n; i += 1) {
      leaves.push(spawnLeaf(width, height, false));
    }
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (let i = 0; i < leaves.length; i += 1) {
      const leaf = leaves[i];
      leaf.swayPhase += leaf.swaySpeed * dt;
      leaf.x += (leaf.vx + Math.sin(leaf.swayPhase) * leaf.swayAmp * 0.12) * dt;
      leaf.y += leaf.vy * dt;
      leaf.rotation += leaf.spin * dt;
      if (leaf.y > height + leaf.size * 2) {
        leaves[i] = spawnLeaf(width, height, true);
        leaves[i].x = Math.random() * width;
      }
      if (leaf.x < -30) leaf.x = width + 20;
      if (leaf.x > width + 30) leaf.x = -20;
    }
  }

  function draw(ctx) {
    for (const leaf of leaves) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rotation);
      ctx.scale(leaf.size, leaf.size);
      ctx.globalAlpha = 0.72 + (leaf.variant % 3) * 0.08;
      ctx.fillStyle = leaf.shade;
      drawLeafShape(ctx, lowFx ? 2 : leaf.variant);
      ctx.restore();
    }
  }

  seed();

  return { seed, update, draw, get count() { return leaves.length; } };
}
