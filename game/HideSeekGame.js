import SkinSystem from "../systems/SkinSystem.js";
import CurrencySystem from "../systems/CurrencySystem.js";
import { MEME_SKIN_DEFS } from "../systems/MemeSkinsData.js";
import {
  PARK,
  clampToPark,
  findNearestSpot,
  generateRandomSpots,
  hitTestSpot,
  spotCenter,
} from "./HideSeekAssets.js";

export const HIDING_DURATION = 45;
export const SEEK_DURATION = 30;
export const FLASH_DURATION = 1.5;
export const ANNOUNCE_DURATION = 1.8;
export const ENTER_FADE_DURATION = 0.85;
export const NEAR_SPOT_DIST = 72;
export const PLAYER_SPEED = 280;
export const BOT_SEEKER_SPEED = 210;
export const SPOT_CHECK_PAUSE = 0.95;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomMemeSkinId() {
  const pool = MEME_SKIN_DEFS.map((d) => d.id);
  return pool[Math.floor(Math.random() * pool.length)] ?? "cust_pepe";
}

function pickRandomSpotId(spots, excludeId = null) {
  const pool = spots.filter((s) => s.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)]?.id ?? spots[0]?.id ?? null;
}

export class HideSeekGame {
  constructor() {
    this.resetSession();
  }

  resetSession() {
    this.phase = "enter_fade";
    this.phaseTime = 0;
    this.playerRole = null;
    this.spots = [];
    this.selectedSpotId = null;
    this.playerSpotId = null;
    this.botSpotId = null;
    this.playerHidden = false;
    this.botHidden = false;
    this.botMemeSkinId = pickRandomMemeSkinId();
    this.playerX = 600;
    this.playerY = 520;
    this.botX = PARK.x + PARK.w / 2;
    this.botY = PARK.y + PARK.h / 2;
    this.botSearchQueue = [];
    this.botSearchIndex = 0;
    this.botSearchTimer = 0;
    this.botSearchState = "travel";
    this.botHideTimer = 2 + Math.random() * 6;
    this.checkedSpots = new Set();
    this.dwellSpotId = null;
    this.dwellTime = 0;
    this.result = null;
    this.resultMessage = "";
    this.rewardSkinId = null;
    this.rewardGold = 0;
    this.hideTimer = HIDING_DURATION;
    this.seekTimer = SEEK_DURATION;
    this.confirmSpotId = null;
    this.confirmMode = null;
    this.messagePulse = 0;
  }

  /** @param {"hider" | "seeker"} role */
  startWithRole(role) {
    this.playerRole = role;
    this.phase = "flash";
    this.phaseTime = 0;
    this.spots = [];
    this.selectedSpotId = null;
    this.playerSpotId = null;
    this.botSpotId = null;
    this.playerHidden = false;
    this.botHidden = false;
    this.checkedSpots = new Set();
    this.hideTimer = HIDING_DURATION;
    this.seekTimer = SEEK_DURATION;
    this.confirmSpotId = null;
    this.confirmMode = null;
    this.botMemeSkinId = pickRandomMemeSkinId();
    this.playerX = 600;
    this.playerY = 520;
    this.botHideTimer = 2 + Math.random() * 8;
    this.result = null;
    this.rewardSkinId = null;
    this.rewardGold = 0;
  }

  getFlashOverlay() {
    if (this.phase === "enter_fade") {
      return Math.min(1, this.phaseTime / ENTER_FADE_DURATION) * 0.92;
    }
    if (this.phase === "flash") {
      const t = this.phaseTime / FLASH_DURATION;
      if (t < 0.35) return 0.92;
      if (t < 1) return 0.92 * (1 - (t - 0.35) / 0.65);
      return 0;
    }
    return 0;
  }

  isOnMap() {
    return ["hiding", "announce", "seeking", "result"].includes(this.phase);
  }

  canMovePlayer() {
    if (this.phase === "hiding" && this.playerRole === "hider" && !this.playerHidden) return true;
    if (this.phase === "seeking" && this.playerRole === "seeker") return true;
    return false;
  }

  applyJoystick(dx, dy, dt) {
    if (!this.canMovePlayer() || !Number.isFinite(dt)) return;
    const speed = PLAYER_SPEED * dt;
    const len = Math.hypot(dx, dy);
    if (len < 0.08) return;
    const nx = dx / len;
    const ny = dy / len;
    const step = Math.min(speed, len * speed);
    const p = clampToPark(this.playerX + nx * step, this.playerY + ny * step);
    this.playerX = p.x;
    this.playerY = p.y;
    this._updateNearSpotPrompt();
  }

  _updateNearSpotPrompt() {
    if (this.confirmSpotId) return;
    if (this.phase === "hiding" && this.playerRole === "hider" && !this.playerHidden) {
      const near = findNearestSpot(this.playerX, this.playerY, this.spots, NEAR_SPOT_DIST);
      if (near) {
        this.selectedSpotId = near.id;
      }
    }
    if (this.phase === "seeking" && this.playerRole === "seeker") {
      const near = findNearestSpot(this.playerX, this.playerY, this.spots, NEAR_SPOT_DIST);
      if (near && !this.checkedSpots.has(near.id)) {
        this.selectedSpotId = near.id;
      }
    }
  }

  /** Показать диалог «спрятаться?» / «осмотреть?» */
  tryOpenConfirmAt(x, y) {
    if (this.confirmSpotId) return false;
    let spot = hitTestSpot(x, y, this.spots);
    if (!spot) spot = findNearestSpot(x, y, this.spots, NEAR_SPOT_DIST + 16);
    if (!spot) return false;

    if (this.phase === "hiding" && this.playerRole === "hider" && !this.playerHidden) {
      const c = spotCenter(spot);
      if (Math.hypot(this.playerX - c.x, this.playerY - c.y) > NEAR_SPOT_DIST + 20) return false;
      this.confirmSpotId = spot.id;
      this.confirmMode = "hide";
      this.selectedSpotId = spot.id;
      return true;
    }

    if (this.phase === "seeking" && this.playerRole === "seeker") {
      const c = spotCenter(spot);
      if (Math.hypot(this.playerX - c.x, this.playerY - c.y) > NEAR_SPOT_DIST + 24) return false;
      if (this.checkedSpots.has(spot.id)) return false;
      this.confirmSpotId = spot.id;
      this.confirmMode = "search";
      this.selectedSpotId = spot.id;
      return true;
    }
    return false;
  }

  confirmYes() {
    if (!this.confirmSpotId) return;
    const id = this.confirmSpotId;
    this.confirmSpotId = null;

    if (this.confirmMode === "hide") {
      this.confirmMode = null;
      this.playerSpotId = id;
      this.playerHidden = true;
      this.selectedSpotId = id;
      this._tryStartSearch();
      return;
    }

    if (this.confirmMode === "search") {
      this.confirmMode = null;
      this.checkedSpots.add(id);
      if (id === this.botSpotId) {
        this._finishWinSeeker();
      }
      return;
    }
    this.confirmMode = null;
  }

  confirmNo() {
    this.confirmSpotId = null;
    this.confirmMode = null;
  }

  _tryStartSearch() {
    const needBotHide = this.playerRole === "seeker";
    const needPlayerHide = this.playerRole === "hider";
    if (needPlayerHide && !this.playerHidden) return;
    if (needBotHide && !this.botHidden) return;

    this.botSearchQueue = shuffle(this.spots.map((s) => s.id));
    this.botSearchIndex = 0;
    this.botSearchState = "travel";
    this.botSearchTimer = 0;
    this.checkedSpots = new Set();
    this.seekTimer = SEEK_DURATION;
    this.phase = "announce";
    this.phaseTime = 0;
  }

  _startSeeking() {
    this.phase = "seeking";
    this.phaseTime = 0;
    this.seekTimer = SEEK_DURATION;
    if (this.playerRole === "seeker") {
      const p = clampToPark(this.playerX, this.playerY);
      this.playerX = p.x;
      this.playerY = p.y;
    }
    if (this.playerRole === "hider") {
      this.botX = PARK.x + 60;
      this.botY = PARK.y + PARK.h / 2;
    }
  }

  _finishLose(message) {
    this.result = "lose";
    this.resultMessage = message;
    this.phase = "result";
    this.phaseTime = 0;
    this.confirmSpotId = null;
  }

  _finishWinSeeker() {
    this.result = "win";
    const alreadyOwned = SkinSystem.hasSkin(this.botMemeSkinId);
    const skin = SkinSystem.unlockSkin(this.botMemeSkinId);
    this.rewardSkinId = skin?.id ?? this.botMemeSkinId;
    this.rewardGold = CurrencySystem.addGold(100);
    const dup = alreadyOwned ? " (уже был в инвентаре)" : "";
    this.resultMessage = `Поймал мема! +100 gold${dup}`;
    this.phase = "result";
    this.phaseTime = 0;
    this.confirmSpotId = null;
  }

  _finishWinHider() {
    this.result = "win";
    this.resultMessage = `Тебя не нашли за ${SEEK_DURATION} сек! Мем сдался.`;
    this.phase = "result";
    this.phaseTime = 0;
    this.confirmSpotId = null;
  }

  _updateBotHider(dt) {
    this.botHideTimer -= dt;
    if (this.botHideTimer > 0) return;
    if (this.botHidden) return;
    this.botSpotId = pickRandomSpotId(this.spots, this.playerSpotId);
    this.botHidden = true;
    this._tryStartSearch();
  }

  _updateBotSeeker(dt) {
    if (this.botSearchIndex >= this.botSearchQueue.length) {
      this._finishWinHider();
      return;
    }

    const spotId = this.botSearchQueue[this.botSearchIndex];
    const spot = this.spots.find((s) => s.id === spotId);
    if (!spot) {
      this.botSearchIndex += 1;
      return;
    }
    const c = spotCenter(spot);

    if (this.botSearchState === "travel") {
      const dx = c.x - this.botX;
      const dy = c.y - this.botY;
      const d = Math.hypot(dx, dy);
      const step = BOT_SEEKER_SPEED * dt;
      if (d <= step + 10) {
        this.botX = c.x;
        this.botY = c.y;
        this.botSearchState = "check";
        this.botSearchTimer = SPOT_CHECK_PAUSE;
        this.checkedSpots.add(spotId);
        if (spotId === this.playerSpotId) {
          this._finishLose("Вода нашла тебя! Награды нет.");
        }
      } else {
        this.botX += (dx / d) * step;
        this.botY += (dy / d) * step;
      }
    } else {
      this.botSearchTimer -= dt;
      if (this.botSearchTimer <= 0) {
        this.botSearchIndex += 1;
        this.botSearchState = "travel";
      }
    }
  }

  _updateSeekingTimer(dt) {
    this.seekTimer -= dt;
    if (this.seekTimer <= 0) {
      if (this.playerRole === "hider") {
        this._finishWinHider();
      } else {
        this._finishLose(`Не успел найти мема за ${SEEK_DURATION} сек.`);
      }
    }
  }

  update(dt, joystick) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.phaseTime += dt;
    this.messagePulse += dt;

    if (this.phase === "enter_fade" && this.phaseTime >= ENTER_FADE_DURATION) {
      this.phase = "role_select";
      this.phaseTime = 0;
      return;
    }

    if (this.phase === "flash" && this.phaseTime >= FLASH_DURATION) {
      this.spots = generateRandomSpots();
      this.phase = "hiding";
      this.phaseTime = 0;
      this.hideTimer = HIDING_DURATION;
      this.playerX = 600;
      this.playerY = 520;
      return;
    }

    if (this.phase === "hiding") {
      if (this.canMovePlayer() && joystick) {
        this.applyJoystick(joystick.dx, joystick.dy, dt);
      }

      if (this.playerRole === "seeker") {
        this._updateBotHider(dt);
      }

      this.hideTimer -= dt;
      if (this.hideTimer <= 0) {
        if (this.playerRole === "hider" && !this.playerHidden) {
          this.playerSpotId = pickRandomSpotId(this.spots);
          this.playerHidden = true;
        }
        if (this.playerRole === "seeker" && !this.botHidden) {
          this.botSpotId = pickRandomSpotId(this.spots);
          this.botHidden = true;
        }
        this._tryStartSearch();
      }
      return;
    }

    if (this.phase === "announce" && this.phaseTime >= ANNOUNCE_DURATION) {
      this._startSeeking();
      return;
    }

    if (this.phase === "seeking") {
      this._updateSeekingTimer(dt);
      if (this.result) return;

      if (this.canMovePlayer() && joystick) {
        this.applyJoystick(joystick.dx, joystick.dy, dt);
      }

      if (this.playerRole === "hider") {
        this._updateBotSeeker(dt);
      }
    }
  }

  getConfirmLabel() {
    if (!this.confirmSpotId) return "";
    const spot = this.spots.find((s) => s.id === this.confirmSpotId);
    const name = spot?.label ?? "здесь";
    if (this.confirmMode === "hide") return `Спрятаться в «${name}»?`;
    if (this.confirmMode === "search") return `Осмотреть «${name}»?`;
    return "";
  }

  getStatusLine() {
    if (this.phase === "role_select") return "Кто ты в этой игре?";
    if (this.phase === "hiding") {
      if (this.playerRole === "hider") {
        if (this.playerHidden) return "Ждём начала поисков...";
        return `Найди укрытие · ${Math.ceil(this.hideTimer)} сек · тап по объекту`;
      }
      if (this.botHidden) return "Мем спрятался! Готовься искать...";
      return `Мем прячется... ${Math.ceil(this.hideTimer)} сек`;
    }
    if (this.phase === "announce") {
      return this.playerRole === "hider" ? "Вода начала поиски!" : `Ищи мема! ${SEEK_DURATION} сек`;
    }
    if (this.phase === "seeking") {
      const s = Math.ceil(this.seekTimer);
      if (this.playerRole === "hider") return `Не шевелись! Вода ищет · ${s} сек`;
      return `Ищи мема · ${s} сек · подойди и тапни объект`;
    }
    return "";
  }

  getHiddenSpotIdForDraw() {
    if (this.phase === "hiding") return null;
    if (this.playerRole === "hider" && (this.phase === "seeking" || this.phase === "result")) {
      return this.playerSpotId;
    }
    if (this.playerRole === "seeker" && this.phase === "result" && this.result === "win") {
      return this.botSpotId;
    }
    return null;
  }

  shouldDrawBotSeeker() {
    return this.phase === "seeking" && this.playerRole === "hider";
  }

  isPlayerSeeker() {
    return this.playerRole === "seeker" && this.phase === "seeking";
  }

  shouldDrawPlayerAvatar() {
    if (this.phase === "hiding" && this.playerRole === "hider" && !this.playerHidden) return true;
    if (this.phase === "seeking" && this.playerRole === "seeker") return true;
    return false;
  }
}
