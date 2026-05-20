import { drawField, FIELD, GOALS } from "./Field.js";
import { Player } from "./Player.js";
import { Ball } from "./Ball.js";
import { AICore } from "./AICore.js";
import { PenaltyGoalkeeperAI } from "./PenaltyGoalkeeperAI.js";
import { grantPenaltyWinRewards, PENALTY_WIN_GOALS } from "../systems/PenaltySystem.js";
import { resolveCollision, separateBallFromBody } from "../systems/CollisionCore.js";
import { HUDCore } from "../ui/HUDCore.js";
import EloSystem from "../systems/EloSystem.js";
import CurrencySystem from "../systems/CurrencySystem.js";
import { awardTrophyAfterMatchWin, MILESTONE_TROPHY_COUNT } from "../systems/TrophySystem.js";
import SkinSystem from "../systems/SkinSystem.js";
import AudioManager from "../core/AudioManager.js";
import StorageSystem from "../systems/StorageSystem.js";
import { AccountAuth } from "../systems/AccountAuth.js";
import {
  getConfettiMaxParticles,
  getConfettiSpawnScale,
  getPlayerDrawScale,
  useLowEffects,
} from "../core/MobileLayout.js";
import { MatchReplayRecorder } from "./MatchReplayRecorder.js";

const WIN_SCORE = 4;
const GOAL_PAUSE_SECONDS = 2;
const RESULT_ANIM_DURATION = 1.35;

const CUP_POP_START = 0.08;
const CUP_POP_DURATION = 0.78;

/** Экран «матч найден»: заезд аватарок, затем расход через ~3 с после показа. */
const MATCH_FOUND_SLIDE_IN = 0.55;
const MATCH_FOUND_HOLD = 3;
const MATCH_FOUND_SLIDE_OUT = 0.45;
const MATCH_FOUND_TOTAL = MATCH_FOUND_HOLD + MATCH_FOUND_SLIDE_OUT;

/** После «VS» бот не бежит к мячу, мяч стоит на месте. */
const KICKOFF_GRACE_SECONDS = 0.45;

/** Случайный ник соперника: русские имена, уменьшительные, псевдонимы, латынь. Без «кото»-темы. */
const BOT_RANDOM_NAMES = [
  "Артём",
  "Максим",
  "Даниил",
  "Егор",
  "Кирилл",
  "Никита",
  "Степан",
  "Дмитрий",
  "Александр",
  "Иван",
  "Андрей",
  "Михаил",
  "Тимофей",
  "Платон",
  "Олег",
  "Глеб",
  "Ярослав",
  "Богдан",
  "Антон",
  "Павел",
  "Семён",
  "Роман",
  "Владислав",
  "Евгений",
  "Лев",
  "Матвей",
  "Марк",
  "Руслан",
  "Вадим",
  "Константин",
  "Денис",
  "Сергей",
  "Виктор",
  "Илья",
  "Василий",
  "Николай",
  "Григорий",
  "Алексей",
  "Валентин",
  "Станислав",
  "Давид",
  "Родион",
  "Захар",
  "Мирон",
  "Георгий",
  "Тихон",
  "Дамир",
  "Арсений",
  "Дарья",
  "Мария",
  "Ксения",
  "Полина",
  "Ева",
  "Алиса",
  "Виктория",
  "Софья",
  "Кристина",
  "Юлия",
  "Анна",
  "Елизавета",
  "Варвара",
  "Милана",
  "Вероника",
  "Арина",
  "Диана",
  "Карина",
  "Валерия",
  "Маргарита",
  "Наталья",
  "Оксана",
  "Светлана",
  "Ирина",
  "Татьяна",
  "Екатерина",
  "Нина",
  "Людмила",
  "Тома",
  "Дима",
  "Саша",
  "Женя",
  "Костя",
  "Вова",
  "Петя",
  "Коля",
  "Миша",
  "Лёша",
  "Рома",
  "Ваня",
  "Катя",
  "Настя",
  "Маша",
  "Даша",
  "Лера",
  "Вика",
  "Соня",
  "Лиза",
  "Женя",
  "NeoStorm",
  "FrostLine",
  "ShadowVortex",
  "IcePick",
  "ViperSeven",
  "SilentBlade",
  "ZeroKelvin",
  "ThunderKid",
  "PixelHunter",
  "NightForge",
  "DarkWave",
  "IronPulse",
  "SwiftArrow",
  "CosmicDrift",
  "RazorMind",
  "GhostStep",
  "NovaFlash",
  "SteelRain",
  "BlurFrame",
  "EchoDrift",
  "RedComet",
  "BlueShift",
  "WildCard",
  "TopLane",
  "MidOnly",
  "CarryMode",
  "NoScope",
  "LagFree",
  "PingZero",
  "Ржавый",
  "Сталкер",
  "Громила",
  "БыстраяСтрела",
  "ТихийПоток",
  "КрасноеПеро",
  "СеверныйШторм",
  "Молот",
  "Адреналин",
  "Штормовик",
  "Ледяной",
  "Огненный",
  "СерыйВолк",
  "БелыйМедведь",
  "Орёл",
  "Сокол",
  "Буревестник",
  "Тайга",
  "Урал",
  "Сибирь",
  "Камчатка",
  "Волга",
  "Дон",
  "Кавказ",
  "Полярник",
  "Шахматист",
  "Боксёр",
  "Капитан",
  "Сержант",
  "Майор",
  "Инженер",
  "Программер",
  "Хакер",
  "Стример",
  "Диджей",
  "Рэпер",
  "Арбитр",
  "Судья",
  "Комментатор",
  "Спортивный",
  "Любитель",
  "Профи",
  "Новичок",
  "Ветеран",
  "Рекордсмен",
];

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t) {
  return t * t * t;
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export class MatchCore {
  /**
   * @param {string | null} [playerSkinForMatchId] — id скина, с которым заходишь в матч (для случайного соперника не как твой).
   */
  constructor(playerSkinForMatchId = null, matchOptions = {}) {
    const isTournament = matchOptions.mode === "tournament";
    const isPenalty = matchOptions.mode === "penalty";
    this.isTournament = isTournament;
    this.isPenalty = isPenalty;
    this.tournamentRound = isTournament ? Math.max(0, Math.floor(Number(matchOptions.tournamentRound)) || 0) : -1;
    this.winScoreToWin = isPenalty ? PENALTY_WIN_GOALS : WIN_SCORE;

    const playerMmrSnapshot = EloSystem.getElo();
    const botMmrThisMatch = isTournament
      ? Math.max(0, playerMmrSnapshot)
      : isPenalty
        ? playerMmrSnapshot
        : EloSystem.pickBotMmrForMatch(playerMmrSnapshot);

    this.player = new Player({
      x: FIELD.x + FIELD.width * 0.25,
      y: FIELD.y + FIELD.height * 0.5,
      color: "#ffffff",
    });
    this.bot = new Player({
      x: FIELD.x + FIELD.width * 0.75,
      y: FIELD.y + FIELD.height * 0.5,
      color: "#ff6b6b",
    });
    this.ball = new Ball();
    const aiOpts = isTournament
      ? { skill: Number(matchOptions.botSkill) || 0.1 }
      : isPenalty
        ? { skill: 0.38 }
        : {
            mmrGap: botMmrThisMatch - playerMmrSnapshot,
            botMmr: botMmrThisMatch,
            playerMmr: playerMmrSnapshot,
          };
    this.ai = isPenalty
      ? new PenaltyGoalkeeperAI(this.bot, this.ball, aiOpts)
      : new AICore(this.bot, this.ball, aiOpts);
    this.botMmr = isTournament ? Math.round(80 + (Number(matchOptions.botSkill) || 0) * 920) : botMmrThisMatch;
    this._introPlayerMmr = playerMmrSnapshot;
    /** Скин соперника на экране подбора (игрок дорисовывается в main уже после этого). */
    const excludeSid =
      typeof playerSkinForMatchId === "string" && playerSkinForMatchId.length > 0
        ? playerSkinForMatchId
        : StorageSystem.getActiveSkin();
    this._matchBotSkinId =
      isTournament && typeof matchOptions.botSkinId === "string"
        ? matchOptions.botSkinId
        : SkinSystem.pickRandomBotSkinId(excludeSid);
    SkinSystem.applySkinToPlayer(this.bot, this._matchBotSkinId);
    this.introElapsed = 0;
    this.playerScore = 0;
    this.botScore = 0;
    this.goalPauseTimer = 0;
    this.isFinished = false;
    this.winnerText = "";
    this.hud = new HUDCore();
    this.playerName = AccountAuth.getDisplayName() || "Игрок";
    this.botName =
      isPenalty
        ? "Вратарь"
        : isTournament && typeof matchOptions.botName === "string"
          ? matchOptions.botName
          : BOT_RANDOM_NAMES[Math.floor(Math.random() * BOT_RANDOM_NAMES.length)];
    this.currentMmr = EloSystem.getElo();
    this.mmrDelta = 0;
    this.goldDelta = 0;
    this.winStreakCurrent = 0;
    this.streakBonusGold = 0;
    this.streakMilestoneHit = false;
    this.coinsDelta = 0;
    this.fortuneTokensDelta = 0;
    /** Победа: начисление кубка и анимация на экране результата. */
    this.cupAwarded = false;
    this.trophyTotalAfter = 0;
    this.trophyMilestoneGold = 0;
    this._goalScorer = "";
    this._goalAnimTime = 0;
    this._resultAnimTime = 0;
    this._goalParticles = [];
    this._shakeTime = 0;
    this._shakePower = 0;
    // На мобиле игрок едет только когда палец «схватил» его и тянет.
    // На ПК (мышь) этот флаг игнорируется — там игрок всегда следует за курсором.
    this.isGrabbingPlayer = false;
    this.replayRecorder = new MatchReplayRecorder();
    this._gameplayTime = 0;
    this.resetPositions();
  }

  /** Данные для экрана «Повтор» (null, если записи мало — например выход до игры). */
  getReplayPayload() {
    return this.replayRecorder?.exportPayload() ?? null;
  }

  hasReplayForEndScreen() {
    return !!this.replayRecorder && this.replayRecorder.getFrameCount() >= 2;
  }

  /**
   * Пытается «схватить» игрока пальцем. Возвращает true, если касание
   * попало по игроку (с небольшим запасом для удобства).
   */
  tryGrabPlayer(x, y) {
    if (this.isFinished || this.introElapsed < MATCH_FOUND_TOTAL) return false;
    // Запас 28 px — чтобы попасть пальцем было легче.
    // На APK кружок рисуется крупнее — зона захвата совпадает с видимым размером.
    const vis = getPlayerDrawScale();
    const grabRadius = this.player.radius * vis + 28;
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    if (dx * dx + dy * dy <= grabRadius * grabRadius) {
      this.isGrabbingPlayer = true;
      return true;
    }
    return false;
  }

  releasePlayer() {
    this.isGrabbingPlayer = false;
  }

  update(deltaTime, pointer, inputType = "mouse") {
    // Ограничиваем dt, чтобы избежать резких скачков физики при просадках FPS.
    const dt = Math.min(0.033, Math.max(0, deltaTime));
    this._lastDeltaTime = dt;

    this._updateGoalParticles(dt);
    this._updateShake(dt);

    if (this.introElapsed < MATCH_FOUND_TOTAL) {
      this.introElapsed = Math.min(this.introElapsed + dt, MATCH_FOUND_TOTAL);
      return;
    }

    if (this.isFinished) {
      this._resultAnimTime += dt;
      return;
    }

    if (this.goalPauseTimer > 0) {
      this.goalPauseTimer -= dt;
      if (this.goalPauseTimer <= 0) this.resetPositions();
      return;
    }

    // На тачскрине pointer работает только если игрок «схвачен» пальцем.
    // На ПК (мышь) — pointer всегда передаётся как есть, игрок едет за курсором.
    const effectivePointer =
      inputType === "touch" && !this.isGrabbingPlayer && pointer
        ? { x: pointer.x, y: pointer.y, isActive: false }
        : pointer;

    this._gameplayTime += dt;
    const inKickoff = this._gameplayTime < KICKOFF_GRACE_SECONDS;

    this.player.update(effectivePointer, dt);

    if (inKickoff) {
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.bot.vx = 0;
      this.bot.vy = 0;
      resolveCollision(this.player, this.ball);
      resolveCollision(this.player, this.ball);
      return;
    }

    this.ai.update(dt);
    resolveCollision(this.player, this.ball);
    resolveCollision(this.bot, this.ball, { strict: this.isPenalty });
    this._integrateBallWithCollisions(dt);
    this.ball.applyWallBounce();

    const goalSide = this.checkGoal();
    if (!goalSide) return;

    if (goalSide === "left") {
      if (this.isPenalty) {
        this._goalScorer = "МИМО";
        this.goalPauseTimer = GOAL_PAUSE_SECONDS * 0.65;
        this.ball.vx = 0;
        this.ball.vy = 0;
        return;
      }
      this.botScore += 1;
    } else {
      this.playerScore += 1;
      AudioManager.playGoalSound();
    }

    this._goalScorer = goalSide === "right" ? "ИГРОК" : "БОТ";
    this._goalAnimTime = GOAL_PAUSE_SECONDS;
    this._emitGoalConfetti(goalSide);
    this._startShake(0.26, 10);

    if (
      this.playerScore >= this.winScoreToWin ||
      (!this.isPenalty && this.botScore >= this.winScoreToWin)
    ) {
      this.isFinished = true;
      const playerWon = this.isPenalty
        ? this.playerScore >= this.winScoreToWin
        : this.playerScore > this.botScore;
      this.winnerText = playerWon ? "ПОБЕДА" : "ПОРАЖЕНИЕ";
      if (this.isTournament) {
        this.mmrDelta = 0;
        this.coinsDelta = 0;
        this.goldDelta = 0;
        this.cupAwarded = false;
        this.trophyTotalAfter = 0;
        this.trophyMilestoneGold = 0;
        this.currentMmr = EloSystem.getElo();
      } else if (this.isPenalty) {
        this.mmrDelta = 0;
        this.cupAwarded = false;
        this.trophyTotalAfter = 0;
        this.trophyMilestoneGold = 0;
        if (playerWon) {
          const r = grantPenaltyWinRewards();
          this.goldDelta = r.gold;
          this.coinsDelta = r.coins;
          this.fortuneTokensDelta = r.tokens;
        } else {
          this.goldDelta = 0;
          this.coinsDelta = 0;
          this.fortuneTokensDelta = 0;
        }
        this.currentMmr = EloSystem.getElo();
      } else {
        this.mmrDelta = playerWon ? EloSystem.applyWin() : EloSystem.applyLoss();
        this.coinsDelta = playerWon ? CurrencySystem.addMatchCoinsReward() : 0;
        this.goldDelta = playerWon ? CurrencySystem.addWinReward() : 0;
        this.cupAwarded = false;
        this.trophyTotalAfter = 0;
        this.trophyMilestoneGold = 0;
        if (playerWon) {
          const tr = awardTrophyAfterMatchWin();
          this.cupAwarded = true;
          this.trophyTotalAfter = tr.newTotal;
          this.trophyMilestoneGold = tr.milestoneBonusGold;
          this.goldDelta += tr.milestoneBonusGold;
        }
        this.currentMmr = EloSystem.getElo();
      }
      this._resultAnimTime = 0;
      return;
    }

    this.goalPauseTimer = GOAL_PAUSE_SECONDS;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  draw(ctx) {
    if (this.introElapsed < MATCH_FOUND_TOTAL) {
      this._drawMatchFoundScreen(ctx);
      return;
    }

    ctx.save();
    this._applyShake(ctx);
    drawField(ctx);
    this.ball.draw(ctx);
    this.player.draw(ctx);
    this.bot.draw(ctx);
    ctx.restore();
    this.hud.draw(ctx, {
      leftName: this.playerName,
      rightName: this.botName,
      leftScore: this.playerScore,
      rightScore: this.isPenalty ? this.winScoreToWin : this.botScore,
      mmr: this.currentMmr,
      opponentMmr: this.botMmr,
      penaltyMode: this.isPenalty,
    });

    if (this.goalPauseTimer > 0) {
      this._drawGoalOverlay(ctx);
    }

    if (this.isFinished) {
      this._drawResultOverlay(ctx);
    }

    this._drawGoalConfetti(ctx);
  }

  _drawMatchFoundScreen(ctx) {
    ctx.save();
    drawField(ctx);
    ctx.fillStyle = "rgba(8, 12, 24, 0.72)";
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);

    const g = ctx.createRadialGradient(
      FIELD.x + FIELD.width * 0.5,
      FIELD.y + FIELD.height * 0.45,
      40,
      FIELD.x + FIELD.width * 0.5,
      FIELD.y + FIELD.height * 0.5,
      FIELD.width * 0.72,
    );
    g.addColorStop(0, "rgba(30, 50, 90, 0.35)");
    g.addColorStop(1, "rgba(6, 8, 16, 0.88)");
    ctx.fillStyle = g;
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);

    const cxMid = FIELD.x + FIELD.width * 0.5;
    const cyMid = FIELD.y + FIELD.height * 0.5;
    const R = 68;
    const restL = cxMid - 246;
    const restR = cxMid + 246;
    const offL = FIELD.x - R * 3.2;
    const offR = FIELD.x + FIELD.width + R * 3.2;
    const outL = FIELD.x - R * 3.6;
    const outR = FIELD.x + FIELD.width + R * 3.6;

    const tAll = this.introElapsed;

    let xLeft = restL;
    let xRight = restR;
    let alphaHud = 1;

    if (tAll < MATCH_FOUND_SLIDE_IN) {
      const pin = clamp01(tAll / MATCH_FOUND_SLIDE_IN);
      const eIn = easeOutCubic(pin);
      xLeft = offL + (restL - offL) * eIn;
      xRight = offR + (restR - offR) * eIn;
    } else if (tAll >= MATCH_FOUND_HOLD) {
      const pOut = clamp01((tAll - MATCH_FOUND_HOLD) / MATCH_FOUND_SLIDE_OUT);
      const eOut = easeInCubic(pOut);
      xLeft = restL + (outL - restL) * eOut;
      xRight = restR + (outR - restR) * eOut;
      alphaHud = 1 - pOut;
    }

    const holdPulse = tAll >= MATCH_FOUND_SLIDE_IN && tAll < MATCH_FOUND_HOLD;
    const breath = holdPulse ? 1 + 0.038 * Math.sin(tAll * 5.8) : 1;
    const fadeExit = Math.max(0, 1 - alphaHud);
    const scaleHud = breath * (1 - fadeExit * 0.2);

    const playerSkinMeta = SkinSystem.getActiveSkin();
    const botSkinMeta = SkinSystem.getSkinById(this._matchBotSkinId);

    const drawHero = (x, skin, rimColor) => {
      ctx.save();
      ctx.translate(x, cyMid);
      ctx.scale(scaleHud, scaleHud);
      ctx.shadowColor = rimColor;
      ctx.shadowBlur = 22;

      SkinSystem.drawSkinInCircle(ctx, skin, 0, 0, R);
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.94)";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R + 2, 0, Math.PI * 2);
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9 * alphaHud;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    ctx.globalAlpha = alphaHud;

    drawHero(xLeft, playerSkinMeta, "rgba(79,195,247,0.95)");
    drawHero(xRight, botSkinMeta, "rgba(255,107,107,0.95)");

    const mmrY = cyMid - R * scaleHud - 36;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 22px Arial";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.62)";
    ctx.fillStyle = "#e8faff";
    if (this.isPenalty) {
      ctx.fillStyle = "#ffe0b2";
      ctx.strokeText("ПЕНАЛЬТИ", xLeft, mmrY);
      ctx.fillText("ПЕНАЛЬТИ", xLeft, mmrY);
      ctx.fillStyle = "#ffe8e8";
      ctx.strokeText("ВРАТАРЬ", xRight, mmrY);
      ctx.fillText("ВРАТАРЬ", xRight, mmrY);
    } else if (this.isTournament) {
      const roundLabel = `РАУНД ${this.tournamentRound + 1}/10`;
      ctx.fillStyle = "#e8faff";
      ctx.strokeText("ТУРНИР", xLeft, mmrY);
      ctx.fillText("ТУРНИР", xLeft, mmrY);
      ctx.fillStyle = "#ffe8e8";
      ctx.strokeText(roundLabel, xRight, mmrY);
      ctx.fillText(roundLabel, xRight, mmrY);
    } else {
      ctx.strokeText(`MMR ${Math.floor(this._introPlayerMmr)}`, xLeft, mmrY);
      ctx.fillText(`MMR ${Math.floor(this._introPlayerMmr)}`, xLeft, mmrY);
      ctx.fillStyle = "#ffe8e8";
      ctx.strokeStyle = "rgba(0,0,0,0.62)";
      ctx.strokeText(`MMR ${Math.floor(this.botMmr)}`, xRight, mmrY);
      ctx.fillText(`MMR ${Math.floor(this.botMmr)}`, xRight, mmrY);
    }

    ctx.font = "bold 26px Arial";
    const nickDY = R * scaleHud + 54;
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.lineWidth = 4;
    ctx.strokeText(this.playerName, xLeft, cyMid + nickDY);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(this.playerName, xLeft, cyMid + nickDY);
    ctx.strokeText(this.botName, xRight, cyMid + nickDY);
    ctx.fillStyle = "#ffdede";
    ctx.fillText(this.botName, xRight, cyMid + nickDY);

    const vsPulse = holdPulse ? 0.048 * Math.sin(tAll * 7.5) : 0;
    const vsScale = (1.12 + vsPulse) * (1 - fadeExit * 0.52);
    ctx.save();
    ctx.translate(cxMid, cyMid - 18);
    ctx.scale(vsScale, vsScale);
    ctx.shadowColor = "#ffd740";
    ctx.shadowBlur = 28 * alphaHud;
    ctx.shadowOffsetY = 0;
    ctx.font = "bold italic 92px Arial";
    ctx.lineWidth = 12;
    const vsGrad = ctx.createLinearGradient(-80, -50, 80, 60);
    vsGrad.addColorStop(0, "#fff59d");
    vsGrad.addColorStop(0.45, "#ffffff");
    vsGrad.addColorStop(1, "#ffb300");
    ctx.strokeStyle = "rgba(110,55,12,0.88)";
    ctx.globalAlpha = alphaHud;
    ctx.strokeText("VS", 0, 0);
    ctx.fillStyle = vsGrad;
    ctx.fillText("VS", 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /** Движение мяча мелкими шагами + столкновения (нет проскока сквозь вратаря). */
  _integrateBallWithCollisions(dt) {
    const ball = this.ball;
    const steps = this.isPenalty ? 6 : 3;
    const subDt = dt / steps;

    for (let i = 0; i < steps; i += 1) {
      ball.x += ball.vx * subDt;
      ball.y += ball.vy * subDt;

      const frameFactor = subDt * 60;
      const friction = Math.pow(ball.frictionPerFrame, frameFactor);
      ball.vx *= friction;
      ball.vy *= friction;

      const speed = Math.hypot(ball.vx, ball.vy);
      ball.rotation += (speed * subDt) / ball.radius;

      resolveCollision(this.player, this.ball);
      resolveCollision(this.bot, this.ball, { strict: this.isPenalty });
      separateBallFromBody(this.player, this.ball);
      separateBallFromBody(this.bot, this.ball);
    }

    if (Math.abs(ball.vx) < 0.5) ball.vx = 0;
    if (Math.abs(ball.vy) < 0.5) ball.vy = 0;
    ball.trail?.update(ball, dt, SkinSystem.getActiveBallPaintValue());
  }

  checkGoal() {
    const ballTop = this.ball.y - this.ball.radius;
    const ballBottom = this.ball.y + this.ball.radius;
    const inGoalWindow = ballBottom >= GOALS.left.y && ballTop <= GOALS.left.y + GOALS.left.height;

    if (!inGoalWindow) return null;
    if (this.ball.x + this.ball.radius < FIELD.x) return "left";
    if (this.ball.x - this.ball.radius > FIELD.x + FIELD.width) return "right";
    return null;
  }

  resetPositions() {
    if (this.isPenalty) {
      const spotY = FIELD.y + FIELD.height * 0.5;
      const spotX = FIELD.x + FIELD.width * 0.3;
      this.player.x = spotX;
      this.player.y = spotY;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.prevX = spotX;
      this.player.prevY = spotY;

      this.bot.x = FIELD.x + FIELD.width - this.bot.radius - 32;
      this.bot.y = spotY;
      this.bot.vx = 0;
      this.bot.vy = 0;
      this.bot.prevX = this.bot.x;
      this.bot.prevY = this.bot.y;

      this.ball.x = spotX + 58;
      this.ball.y = spotY;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.trail?.reset();
      return;
    }

    this.player.x = FIELD.x + FIELD.width * 0.25;
    this.player.y = FIELD.y + FIELD.height * 0.5;
    this.player.vx = 0;
    this.player.vy = 0;

    this.bot.x = FIELD.x + FIELD.width * 0.75;
    this.bot.y = FIELD.y + FIELD.height * 0.5;
    this.bot.vx = 0;
    this.bot.vy = 0;

    this.ball.x = FIELD.x + FIELD.width / 2;
    this.ball.y = FIELD.y + FIELD.height / 2;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.trail?.reset();
  }

  _drawGoalOverlay(ctx) {
    const progress = Math.min(1, (GOAL_PAUSE_SECONDS - this.goalPauseTimer) / 0.35);
    const eased = 1 - Math.pow(1 - progress, 3);
    const centerX = FIELD.x + FIELD.width / 2;
    const centerY = FIELD.y + 96 - (1 - eased) * 40;
    const scale = 0.6 + eased * 0.5;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.font = "bold 54px Arial";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.fillStyle = "#ffe54d";
    const isMiss = this._goalScorer === "МИМО";
    const mainLabel = isMiss ? "МИМО!" : "ГОЛ!";
    ctx.strokeText(mainLabel, 0, 0);
    ctx.fillText(mainLabel, 0, 0);

    ctx.font = "bold 30px Arial";
    ctx.fillStyle = "#ffffff";
    const sub = isMiss ? "Попробуй ещё" : `ЗАБИЛ ${this._goalScorer}`;
    ctx.strokeText(sub, 0, 54);
    ctx.fillText(sub, 0, 54);
    ctx.restore();
  }

  _drawResultOverlay(ctx) {
    const t = Math.min(1, this._resultAnimTime / RESULT_ANIM_DURATION);
    const eased = 1 - Math.pow(1 - t, 3);
    const cx = FIELD.x + FIELD.width / 2;
    const cy = FIELD.y + FIELD.height / 2;
    const panelW = 520;
    const panelH = this.cupAwarded ? 352 : 318;
    const panelX = cx - panelW / 2;
    const panelY = cy - panelH / 2;
    const isWin = this.winnerText === "ПОБЕДА";
    const titleColor = isWin ? "#4fc3f7" : "#ff5252";

    const titleY = panelY + (this.cupAwarded ? 76 : 92);
    const mmrY = panelY + (this.cupAwarded ? 204 : 178);
    const goldY = panelY + (this.cupAwarded ? 252 : 228);
    const coinsY = panelY + (this.cupAwarded ? 292 : 266);
    const cupY = panelY + 132;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);

    ctx.globalAlpha = 0.45 + eased * 0.55;
    ctx.fillStyle = "rgba(12,18,30,0.92)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 68px Arial";
    ctx.fillStyle = titleColor;
    ctx.fillText(this.winnerText, cx, titleY);

    if (this.cupAwarded) {
      const tCup = clamp01((this._resultAnimTime - CUP_POP_START) / CUP_POP_DURATION);
      const cupScale = tCup <= 0 ? 0 : easeOutBack(tCup);
      const wobble = 0.04 * Math.sin(this._resultAnimTime * 11);
      const glowPulse = 0.55 + 0.45 * Math.sin(this._resultAnimTime * 6.5);
      this._drawCupReward(ctx, cx, cupY, cupScale * (1 + wobble), glowPulse);

      ctx.font = "bold 26px Arial";
      ctx.fillStyle = "rgba(255, 243, 200, " + clamp01((tCup - 0.25) * 2) + ")";
      ctx.fillText("+1 кубок", cx, cupY + 56);
      ctx.font = "500 21px Arial";
      ctx.fillStyle = "rgba(200, 220, 255, " + clamp01((tCup - 0.35) * 2.2) + ")";
      ctx.fillText(`Всего: ${this.trophyTotalAfter}`, cx, cupY + 82);

      const sparkPhase = clamp01((tCup - 0.5) / 0.35);
      if (sparkPhase > 0) {
        this._drawCupSparkles(ctx, cx, cupY, sparkPhase, this._resultAnimTime);
      }
    }

    if (this.isPenalty) {
      ctx.font = "bold 26px Arial";
      ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
      ctx.fillText("Рейтинг не меняется", cx, mmrY);
    } else {
      const mmrLabel = this.mmrDelta >= 0 ? `MMR + ${this.mmrDelta}` : `MMR - ${Math.abs(this.mmrDelta)}`;
      const visibleChars = Math.max(1, Math.floor(mmrLabel.length * eased));
      const animatedLabel = mmrLabel.slice(0, visibleChars);
      ctx.font = "bold 50px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(animatedLabel, cx, mmrY);
    }

    if (isWin && this.winStreakCurrent >= 2) {
      const streakLabel = this.streakMilestoneHit
        ? `🔥 Серия ${this.winStreakCurrent}! Бонус серии`
        : `🔥 Серия побед: ${this.winStreakCurrent}`;
      const streakReveal = clamp01((eased - 0.15) / 0.35);
      if (streakReveal > 0.05) {
        ctx.font = "bold 22px Arial";
        ctx.fillStyle = `rgba(255, 183, 77, ${streakReveal})`;
        ctx.fillText(streakLabel, cx, titleY + 44);
      }
    }

    if (this.goldDelta > 0) {
      const goldLabel = `GOLD + ${this.goldDelta}`;
      const visibleGoldChars = Math.max(1, Math.floor(goldLabel.length * eased));
      ctx.font = "bold 34px Arial";
      ctx.fillStyle = "#ffe082";
      ctx.fillText(goldLabel.slice(0, visibleGoldChars), cx, goldY);
    }

    if (this.coinsDelta > 0) {
      const coinsLabel = `КОИНЫ + ${this.coinsDelta}`;
      const vn = Math.max(1, Math.floor(coinsLabel.length * eased));
      ctx.font = "bold 28px Arial";
      ctx.fillStyle = "#bdbdbd";
      ctx.fillText(coinsLabel.slice(0, vn), cx, coinsY);
    }

    if (this.fortuneTokensDelta > 0) {
      const tokenLabel = `ЖЕТОН + ${this.fortuneTokensDelta}`;
      const vt = Math.max(1, Math.floor(tokenLabel.length * eased));
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#81d4fa";
      ctx.fillText(tokenLabel.slice(0, vt), cx, coinsY + 36);
    }

    if (this.trophyMilestoneGold > 0) {
      const bonusLabel = `${MILESTONE_TROPHY_COUNT} кубков! Бонус +${this.trophyMilestoneGold} GOLD`;
      const reveal = clamp01((eased - 0.72) / 0.28);
      if (reveal > 0.05) {
        ctx.font = "bold 22px Arial";
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 4;
        const by = panelY + panelH - 34;
        ctx.strokeText(bonusLabel, cx, by);
        ctx.fillStyle =
          reveal >= 1
            ? "#69f0ae"
            : `rgba(105,240,174, ${0.4 + reveal * 0.6})`;
        ctx.fillText(bonusLabel, cx, by);
      }
    }
    ctx.restore();
  }

  /** Нарисовать стилизованный кубок (золото + подсветка). */
  _drawCupReward(ctx, x, y, scale, glowK) {
    if (scale <= 0.001) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(0.05 * Math.sin(this._resultAnimTime * 9));

    const g = ctx.createRadialGradient(-12, -18, 4, 0, -6, 48);
    g.addColorStop(0, "#fffde7");
    g.addColorStop(0.35, "#ffd54f");
    g.addColorStop(0.72, "#ff8f00");
    g.addColorStop(1, "#e65100");

    ctx.shadowColor = `rgba(255, 213, 79, ${0.55 * glowK})`;
    ctx.shadowBlur = 28 * glowK;

    ctx.beginPath();
    ctx.moveTo(-8, -32);
    ctx.lineTo(-22, -8);
    ctx.lineTo(-24, 12);
    ctx.quadraticCurveTo(-24, 22, -14, 26);
    ctx.lineTo(-18, 36);
    ctx.lineTo(-10, 40);
    ctx.lineTo(10, 40);
    ctx.lineTo(18, 36);
    ctx.lineTo(14, 26);
    ctx.quadraticCurveTo(24, 22, 24, 12);
    ctx.lineTo(22, -8);
    ctx.lineTo(8, -32);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(139,69,19,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 12, 20, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(183,106,43,0.65)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.lineTo(-6, -24);
    ctx.lineTo(6, -24);
    ctx.lineTo(18, -6);
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.restore();
  }

  _drawCupSparkles(ctx, cx, cy, phase, time) {
    const R = 58 + phase * 18;
    const n = 10;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + time * 2.2;
      const px = cx + Math.cos(a) * R * (0.85 + 0.15 * Math.sin(time * 3 + i));
      const py = cy + Math.sin(a) * R * 0.72;
      const s = phase * (4 + (i % 3));
      ctx.save();
      ctx.globalAlpha = 0.25 + phase * 0.65;
      ctx.translate(px, py);
      ctx.rotate(a + time);
      ctx.fillStyle = i % 2 === 0 ? "#fff59d" : "#ffffff";
      ctx.fillRect(-s, -s * 0.35, s * 2, s * 0.7);
      ctx.restore();
    }
  }

  _pushConfettiParticle(p) {
    if (this._goalParticles.length >= getConfettiMaxParticles()) return;
    this._goalParticles.push(p);
  }

  _spawnConfettiBurst(count, factory) {
    const scale = getConfettiSpawnScale();
    const n = scale >= 1 ? count : Math.max(1, Math.round(count * scale));
    for (let i = 0; i < n; i += 1) {
      if (this._goalParticles.length >= getConfettiMaxParticles()) break;
      this._pushConfettiParticle(factory());
    }
  }

  _makeConfettiParticle(spec, colors, lowFx) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    if (lowFx) {
      return {
        ...spec,
        color,
        kind: "rect",
        rot: 0,
        spin: 0,
        life: spec.life * 0.85,
        ttl: spec.ttl * 0.85,
      };
    }
    return {
      ...spec,
      color,
      kind: spec.kind ?? (Math.random() < 0.4 ? "streamer" : "rect"),
      rot: spec.rot ?? Math.random() * Math.PI * 2,
      spin: spec.spin ?? (Math.random() - 0.5) * 9,
    };
  }

  _emitGoalConfetti(goalSide) {
    const isPlayerGoal = goalSide === "right";
    const lowFx = useLowEffects();
    const colors = isPlayerGoal
      ? ["#4fc3f7", "#ffffff", "#ffe44d", "#ff80ab", "#69f0ae", "#ffd54f", "#b388ff", "#8be9fd"]
      : ["#ff6b6b", "#ffffff", "#ffd166", "#ff9f80"];

    if (isPlayerGoal) {
      const w = FIELD.width;
      const h = FIELD.height;
      const cx = FIELD.x + w * 0.5;
      const cy = FIELD.y + h * 0.42;

      this._spawnConfettiBurst(140, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 180 + Math.random() * 420;
        return this._makeConfettiParticle(
          {
            x: cx + (Math.random() - 0.5) * w * 0.35,
            y: cy + (Math.random() - 0.5) * h * 0.25,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 80,
            life: 1.4 + Math.random() * 1.1,
            ttl: 1.4 + Math.random() * 1.1,
            size: 5 + Math.random() * 7,
          },
          colors,
          lowFx,
        );
      });

      this._spawnConfettiBurst(90, () =>
        this._makeConfettiParticle(
          {
            x: FIELD.x + Math.random() * w,
            y: FIELD.y - 20 - Math.random() * 120,
            vx: (Math.random() - 0.5) * 320,
            vy: 120 + Math.random() * 280,
            life: 1.6 + Math.random() * 1.2,
            ttl: 1.6 + Math.random() * 1.2,
            size: 4 + Math.random() * 6,
          },
          colors,
          lowFx,
        ),
      );

      this._spawnConfettiBurst(50, () => {
        const fromLeft = Math.random() < 0.5;
        return this._makeConfettiParticle(
          {
            x: fromLeft ? FIELD.x - 16 : FIELD.x + w + 16,
            y: FIELD.y + Math.random() * h * 0.85,
            vx: (fromLeft ? 1 : -1) * (160 + Math.random() * 300),
            vy: (Math.random() - 0.5) * 220,
            life: 1.2 + Math.random() * 0.9,
            ttl: 1.2 + Math.random() * 0.9,
            size: 4 + Math.random() * 5,
          },
          colors,
          lowFx,
        );
      });
    }

    const spawnX = goalSide === "right" ? GOALS.right.x : GOALS.left.x + GOALS.left.width;
    const spawnY = GOALS.left.y + GOALS.left.height / 2;
    const dir = goalSide === "right" ? -1 : 1;
    const localCount = isPlayerGoal ? 45 : 65;

    this._spawnConfettiBurst(localCount, () => {
      const speed = 120 + Math.random() * 260;
      const spread = (Math.random() - 0.5) * 1.7;
      return this._makeConfettiParticle(
        {
          x: spawnX,
          y: spawnY + (Math.random() - 0.5) * 110,
          vx: dir * speed * (0.75 + Math.random() * 0.7),
          vy: Math.sin(spread) * speed * 0.55,
          life: 0.9 + Math.random() * 0.6,
          ttl: 0.9 + Math.random() * 0.6,
          size: 4 + Math.random() * 5,
          kind: "rect",
          rot: 0,
          spin: 0,
        },
        colors,
        lowFx,
      );
    });
  }

  _updateGoalParticles(dt) {
    const parts = this._goalParticles;
    let write = 0;
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) continue;

      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.988;
      if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
      parts[write] = p;
      write += 1;
    }
    parts.length = write;
  }

  _drawGoalConfetti(ctx) {
    const parts = this._goalParticles;
    if (parts.length === 0) return;

    if (useLowEffects()) {
      for (let i = 0; i < parts.length; i += 1) {
        const p = parts[i];
        const alpha = p.life / p.ttl;
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        const s = p.size;
        ctx.fillRect(p.x | 0, p.y | 0, s, (s * 0.65) | 0);
      }
      ctx.globalAlpha = 1;
      return;
    }

    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      const alpha = p.life / p.ttl;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.kind === "streamer") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size * 0.35, -p.size * 1.4, p.size * 0.7, p.size * 2.8);
      } else if (p.rot) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
      } else {
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
      }
      ctx.restore();
    }
  }

  _startShake(duration, power) {
    this._shakeTime = Math.max(this._shakeTime, duration);
    this._shakePower = Math.max(this._shakePower, power);
  }

  _updateShake(dt) {
    if (this._shakeTime <= 0) return;
    this._shakeTime -= dt;
    if (this._shakeTime <= 0) {
      this._shakeTime = 0;
      this._shakePower = 0;
    }
  }

  _applyShake(ctx) {
    if (this._shakeTime <= 0 || this._shakePower <= 0) return;
    const fade = Math.min(1, this._shakeTime / 0.26);
    const amount = this._shakePower * fade;
    const dx = (Math.random() * 2 - 1) * amount;
    const dy = (Math.random() * 2 - 1) * amount;
    ctx.translate(dx, dy);
  }

}
