import { FIELD, GOALS } from "./Field.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Бот только в роли вратаря: защищает правые ворота, не атакует.
 */
export class PenaltyGoalkeeperAI {
  constructor(bot, ball, options = {}) {
    this.bot = bot;
    this.ball = ball;
    const skill = clamp(Number(options.skill) || 0.4, 0, 1);
    // В 2 раза медленнее — легче забить.
    this.speed = lerp(150, 270, skill);
  }

  update(deltaTime) {
    const dt = deltaTime;
    if (!Number.isFinite(dt) || dt <= 0) return;

    const bot = this.bot;
    const ball = this.ball;
    const goal = GOALS.right;
    const goalMidY = goal.y + goal.height / 2;
    const padY = bot.radius + 6;
    const minY = goal.y + padY;
    const maxY = goal.y + goal.height - padY;
    const keepX = FIELD.x + FIELD.width - bot.radius - 28;

    let targetY = goalMidY;
    if (ball.x > FIELD.x + FIELD.width * 0.42) {
      const lead = 0.06;
      targetY = ball.y + ball.vy * lead;
      targetY = clamp(targetY, minY, maxY);
    }

    bot.moveTowards(keepX, targetY, dt, this.speed);
  }
}
