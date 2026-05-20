function drawPentagon(ctx, x, y, radius, fill) {
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function defaultBallStyle() {
  return { base: "#ffffff", pattern: "classic", accent: "#111111" };
}

function defaultGoalStyle() {
  return {
    frame: "rgba(255,255,255,0.35)",
    back: "rgba(255,255,255,0.18)",
    net: "rgba(255,255,255,0.2)",
    glow: false,
  };
}

function mergeBallStyle(style) {
  return style ? { ...defaultBallStyle(), ...style } : defaultBallStyle();
}

function mergeGoalStyle(style) {
  return style ? { ...defaultGoalStyle(), ...style } : defaultGoalStyle();
}

const MatchCosmeticRender = {
  defaultBallStyle,
  defaultGoalStyle,
  mergeBallStyle,
  mergeGoalStyle,

  drawBall(ctx, x, y, radius, style, rotation = 0) {
    const s = mergeBallStyle(style);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = s.base;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    if (s.pattern === "split" && s.accent2) {
      ctx.fillStyle = s.accent2;
      ctx.fillRect(-radius, 0, radius * 2, radius);
    } else if (s.pattern === "stripes") {
      ctx.fillStyle = s.accent2 || s.accent;
      for (let i = -3; i <= 3; i += 1) {
        ctx.save();
        ctx.rotate((i / 7) * Math.PI);
        ctx.fillRect(-radius * 0.15, -radius, radius * 0.3, radius * 2);
        ctx.restore();
      }
    } else if (s.pattern === "neon") {
      const g = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
      g.addColorStop(0, s.accent);
      g.addColorStop(0.55, s.base);
      g.addColorStop(1, s.accent2 || s.accent);
      ctx.fillStyle = g;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    } else if (s.pattern === "star" || s.pattern === "diamond") {
      const g = ctx.createLinearGradient(-radius, -radius, radius, radius);
      g.addColorStop(0, s.accent);
      g.addColorStop(0.5, s.base);
      g.addColorStop(1, s.accent2 || s.accent);
      ctx.fillStyle = g;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55, radius * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawPentagon(ctx, 0, 0, radius * 0.34, s.accent);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * radius * 0.63;
      const py = Math.sin(angle) * radius * 0.63;
      drawPentagon(ctx, px, py, radius * 0.2, s.accent);
    }
    ctx.restore();

    const glare = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.35, radius * 0.05, x, y, radius);
    glare.addColorStop(0, "rgba(255,255,255,0.75)");
    glare.addColorStop(0.5, "rgba(255,255,255,0.12)");
    glare.addColorStop(1, "rgba(0,0,0,0.1)");
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = glare;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(17,24,39,0.8)";
    ctx.stroke();
  },

  drawGoalPreview(ctx, cx, cy, w, h, style) {
    const s = mergeGoalStyle(style);
    const gx = cx - w / 2;
    const gy = cy - h / 2;
    ctx.save();
    if (s.glow) {
      ctx.shadowColor = s.frame;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = s.back;
    ctx.fillRect(gx, gy, w, h);
    ctx.strokeStyle = s.frame;
    ctx.lineWidth = 3;
    ctx.strokeRect(gx, gy, w, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = s.net;
    ctx.lineWidth = 1;
    const step = Math.max(5, Math.floor(w / 5));
    for (let xi = gx; xi <= gx + w; xi += step) {
      ctx.beginPath();
      ctx.moveTo(xi, gy);
      ctx.lineTo(xi, gy + h);
      ctx.stroke();
    }
    for (let yi = gy; yi <= gy + h; yi += step) {
      ctx.beginPath();
      ctx.moveTo(gx, yi);
      ctx.lineTo(gx + w, yi);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawGoalsOnField(ctx, leftGoal, rightGoal, style) {
    const s = mergeGoalStyle(style);
    const drawOne = (g) => {
      if (s.glow) {
        ctx.save();
        ctx.shadowColor = s.frame;
        ctx.shadowBlur = 16;
        ctx.fillStyle = s.back;
        ctx.fillRect(g.x, g.y, g.width, g.height);
        ctx.restore();
      } else {
        ctx.fillStyle = s.back;
        ctx.fillRect(g.x, g.y, g.width, g.height);
      }
      ctx.strokeStyle = s.frame;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(g.x, g.y, g.width, g.height);
      ctx.strokeStyle = s.net;
      ctx.lineWidth = 1;
      const step = 9;
      for (let xi = g.x; xi <= g.x + g.width; xi += step) {
        ctx.beginPath();
        ctx.moveTo(xi, g.y);
        ctx.lineTo(xi, g.y + g.height);
        ctx.stroke();
      }
      for (let yi = g.y; yi <= g.y + g.height; yi += step) {
        ctx.beginPath();
        ctx.moveTo(g.x, yi);
        ctx.lineTo(g.x + g.width, yi);
        ctx.stroke();
      }
    };
    drawOne(leftGoal);
    drawOne(rightGoal);
  },

  drawInventoryPreview(ctx, skin, cx, cy, radius) {
    if (!skin) return;
    if (skin.type === "ball_paint") {
      this.drawBall(ctx, cx, cy, radius, skin.value, 0.4);
      return;
    }
    if (skin.type === "goal_paint") {
      const pw = radius * 2.1;
      const ph = radius * 1.55;
      this.drawGoalPreview(ctx, cx, cy, pw, ph, skin.value);
    }
  },
};

export default MatchCosmeticRender;
