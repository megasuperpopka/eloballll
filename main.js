import { createCanvas } from "./core/Canvas.js";
import { setOrientationLandscape, setOrientationPortrait } from "./core/AppOrientation.js";
import { Engine } from "./core/Engine.js";
import { InputManagerV2 } from "./core/InputManagerV2.js";
import { MatchCore } from "./game/MatchCore.js";
import { MatchReplayPlayer } from "./game/MatchReplayRecorder.js";
import { MainMenu } from "./ui/MainMenu.js";
import CaseSystem from "./systems/CaseSystem.js";
import GarageSystem from "./systems/GarageSystem.js";
import FortuneWheelSystem from "./systems/FortuneWheelSystem.js";
import CurrencySystem, { EXTRA_PAINT_SLOT_GOLD_PRICE } from "./systems/CurrencySystem.js";
import DailyQuestSystem from "./systems/DailyQuestSystem.js";
import AchievementSystem from "./systems/AchievementSystem.js";
import WinStreakSystem from "./systems/WinStreakSystem.js";
import DailyLoginBonusSystem from "./systems/DailyLoginBonusSystem.js";
import WeeklyQuestSystem from "./systems/WeeklyQuestSystem.js";
import RewardCalendarSystem from "./systems/RewardCalendarSystem.js";
import SkinSystem from "./systems/SkinSystem.js";
import SkinSellSystem from "./systems/SkinSellSystem.js";
import MmrRank from "./systems/MmrRank.js";
import EloSystem from "./systems/EloSystem.js";
import StorageSystem, { hydrateProfileEconomyOnce, MAX_PAINT_SLOTS } from "./systems/StorageSystem.js";
import { createPaintSkinBuffer } from "./systems/PaintSkinBuffer.js";
import {
  SAVE_PAINT_COINS_COST,
  drawPaintSkinStudio,
  interpretStudioHit,
  PALETTE_COLORS,
  screenToTexture,
  STUDIO_LAYOUT,
} from "./ui/PaintedSkinStudio.js";
import TrophySystem from "./systems/TrophySystem.js";
import { applyDevMegaCoinsBonusOnce, applyOwnerAccountIfEnabled } from "./systems/OwnerAccount.js";
import { AccountAuth, ensureBuiltInTestAccounts } from "./systems/AccountAuth.js";
import { setupAuthOverlay } from "./ui/AuthOverlay.js";
import TournamentSystem from "./systems/TournamentSystem.js";
import {
  modeSelectUi,
  tournamentUi,
  drawModeSelectScreen,
  getModeSelectActionAt,
  beginTournamentIntro,
  updateTournamentFlow,
  drawTournamentScreen,
  getTournamentActionAt,
  startTournamentFightAnim,
  setTournamentToast,
} from "./ui/TournamentUi.js";
import {
  getUiButtonScale,
  isNativeMobileApp,
  useLowEffects,
  scaleUiRectAnchorTopRight,
  scaleUiRectAroundCenter,
} from "./core/MobileLayout.js";
import { createFallingLeavesFx } from "./ui/FallingLeavesFx.js";
import { drawFortuneWheelScreen, layoutFortuneWheelControls } from "./ui/FortuneWheelUi.js";
import { HideSeekGame } from "./game/HideSeekGame.js";
import { preloadHideSeekAssets } from "./game/HideSeekAssets.js";
import {
  drawHideSeekPlay,
  drawHideSeekRoleSelect,
  getHideSeekConfirmActionAt,
  getHideSeekResultActionAt,
  getHideSeekRoleActionAt,
  hideSeekConfirmUi,
  hideSeekResultUi,
  hideSeekRoleUi,
} from "./ui/HideSeekUi.js";
import {
  createHideSeekJoystick,
  joystickPointerDown,
  joystickPointerMove,
  joystickPointerUp,
} from "./ui/HideSeekJoystick.js";
import { createSkylineKickIntro, drawSkylineKickIntro } from "./ui/SkylineKickIntro.js";
import AudioManager from "./core/AudioManager.js";
import {
  settingsUi,
  drawSettingsScreen,
  getSettingsSliderAt,
  applySettingsSliderPointer,
} from "./ui/SettingsUi.js";
import {
  createPenaltyLaunch,
  updatePenaltyLaunch,
  drawPenaltyLaunchOverlay,
} from "./ui/PenaltyLaunchFx.js";

AudioManager.load("menu", "assets/sounds/menu/menu.mp3", { loop: true });
AudioManager.load("hide_seek_intro", "assets/sounds/game/pryatki.mp3", { loop: false });
AudioManager.load("hide_seek_loop", "assets/sounds/game/pryatki1.mp3", { loop: true });
AudioManager.load("goal_cheer", "assets/sounds/game/GOAAAL.mp3", { loop: false, playbackRate: 2 });
AudioManager.load("ui_click", "assets/sounds/menu/realistic_game_click.mp3");
AudioManager.bootstrap();

const REFERENCE_WIDTH = 1200;
const REFERENCE_HEIGHT = 700;

const appElement = document.getElementById("app");

if (!appElement) {
  throw new Error("Не найден контейнер #app для инициализации игры.");
}

await ensureBuiltInTestAccounts();

if (AccountAuth.isLoggedIn()) {
  await setOrientationLandscape();
} else {
  await setOrientationPortrait();
}

const { canvas, ctx, clear } = createCanvas(appElement, REFERENCE_WIDTH, REFERENCE_HEIGHT);
const fallingLeavesFx = createFallingLeavesFx(REFERENCE_WIDTH, REFERENCE_HEIGHT, 32);

function shouldShowFallingLeaves() {
  return (
    appUnlocked &&
    state !== STATES.MATCH &&
    state !== STATES.MATCH_REPLAY &&
    state !== STATES.HIDE_SEEK &&
    state !== STATES.TOURNAMENT &&
    state !== STATES.SETTINGS
  );
}
SkinSystem.preloadImageSkins();
GarageSystem.preloadGarageImages();
preloadHideSeekAssets();
MmrRank.preloadRankImages();
const inputManager = new InputManagerV2(canvas);
const mainMenu = new MainMenu();

/** Тост на главном меню (ежедневный бонус и т.п.). */
const menuToast = { text: "", timer: 0 };

function runPostLoginEconomy() {
  hydrateProfileEconomyOnce();
  applyOwnerAccountIfEnabled();
  const daily = DailyLoginBonusSystem.tryGrant();
  if (daily.granted) {
    menuToast.text = `Ежедневный бонус: +${daily.gold} gold, +${daily.coins} коин`;
    menuToast.timer = 4.5;
  }
  // После ежедневного бонуса: для dev-акков выставляем фиксированную голду (не «+100», а ровно 1M).
  applyDevMegaCoinsBonusOnce();
}

function hasUnclaimedQuestOrAchievementRewards() {
  const snap = DailyQuestSystem.getSnapshot();
  if (snap.rows.some((r) => r.canClaim)) return true;
  if (snap.chainRow?.canClaim) return true;
  if (AchievementSystem.getClaimableRows().length > 0) return true;
  if (WeeklyQuestSystem.getSnapshot().row.canClaim) return true;
  if (RewardCalendarSystem.getSnapshot().canClaimToday) return true;
  return false;
}

/** Пока false — доступ к игру идёт только через HTML-форму входа поверх канваса. */
let appUnlocked = AccountAuth.isLoggedIn();
const skylineKickIntro = createSkylineKickIntro();
let skylineIntroFinished = false;

const authUi = setupAuthOverlay({
  onSuccess: () => {
    appUnlocked = true;
    runPostLoginEconomy();
    detectAndMaybeShowAchievementPopup();
    detectAndMaybeShowQuestCompletePopup();
  },
});

/** Заставка идёт первой — форму входа покажем после неё. */
authUi.hide();

if (AccountAuth.isLoggedIn()) {
  runPostLoginEconomy();
}

function finishSkylineIntroIfNeeded() {
  if (skylineIntroFinished) return;
  skylineIntroFinished = true;
  if (!AccountAuth.isLoggedIn()) {
    authUi.show();
  }
}

const STATES = {
  MAIN_MENU: "MAIN_MENU",
  MODE_SELECT: "MODE_SELECT",
  TOURNAMENT: "TOURNAMENT",
  MATCH: "MATCH",
  MATCH_REPLAY: "MATCH_REPLAY",
  HIDE_SEEK: "HIDE_SEEK",
  SHOP: "SHOP",
  INVENTORY: "INVENTORY",
  QUESTS: "QUESTS",
  PAINT_SKIN: "PAINT_SKIN",
  SETTINGS: "SETTINGS",
};

/** Куда вернуться с экрана магазина (кнопка «Назад»). */
let shopReturnState = STATES.MAIN_MENU;

/** Радиус кисти в пикселях текстуры 256×256. */
const PAINT_BRUSH_RADIUS_TEX = 10;

/** @type {ReturnType<typeof createPaintSkinBuffer> | null} */
let paintSkinBuffer = null;

const paintStudio = {
  brushColor: PALETTE_COLORS[0],
  eraser: false,
  message: "",
  messageTimer: 0,
  painting: false,
  lastTexX: /** @type {number | null} */ (null),
  lastTexY: /** @type {number | null} */ (null),
  selectedSlot: 0,
};

function ensurePaintSkinBuffer() {
  if (!paintSkinBuffer) paintSkinBuffer = createPaintSkinBuffer();
  return paintSkinBuffer;
}

function clampPaintStudioSlot() {
  const t = Math.max(1, StorageSystem.getPaintSlotTotal());
  if (paintStudio.selectedSlot >= t) paintStudio.selectedSlot = t - 1;
  if (paintStudio.selectedSlot < 0) paintStudio.selectedSlot = 0;
}

function loadPaintBufferForSlot(slotIndex) {
  const buf = ensurePaintSkinBuffer();
  const saved = StorageSystem.getPaintSlotDataUrl(slotIndex);
  void (saved ? buf.loadFromDataUrl(saved) : Promise.resolve()).then(() => {
    if (!saved) buf.resetTemplate();
  });
}

function enterPaintSkinState() {
  StorageSystem.syncPaintSlotsIntoInventory();
  refreshOwnedSkins();
  state = STATES.PAINT_SKIN;
  paintStudio.brushColor = PALETTE_COLORS[0];
  paintStudio.eraser = false;
  paintStudio.message = "";
  paintStudio.messageTimer = 0;
  clampPaintStudioSlot();
  loadPaintBufferForSlot(paintStudio.selectedSlot);
}

function setPaintStudioMessage(text) {
  paintStudio.message = text;
  paintStudio.messageTimer = 4;
}

let state = STATES.MAIN_MENU;
let match = null;
/** @type {import("./game/MatchReplayRecorder.js").MatchReplayPlayer | null} */
let matchReplayPlayer = null;
/** @type {HideSeekGame | null} */
let hideSeekGame = null;
const hideSeekJoystick = createHideSeekJoystick();
let ownedSkins = SkinSystem.getOwnedSkins();
let uiTime = 0;
let tournamentResultMsg = "";

const shopUi = {
  mode: "hub",
  casesTabButton: { x: 48, y: 248, w: 352, h: 220 },
  wheelTabButton: { x: 424, y: 248, w: 352, h: 220 },
  garageTabButton: { x: 800, y: 248, w: 352, h: 220 },
  garageOpenZoneNormal: { x: 48, y: 188, w: 536, h: 400 },
  garageOpenZoneMega: { x: 616, y: 188, w: 536, h: 400 },
  garageKind: "normal",
  garageOpenAgainButton: { x: 360, y: 590, w: 220, h: 50 },
  garageToHubButton: { x: 620, y: 590, w: 220, h: 50 },
  basicButton: { x: 24, y: 168, w: 368, h: 300 },
  premiumButton: { x: 416, y: 168, w: 368, h: 300 },
  vipButton: { x: 808, y: 168, w: 368, h: 300 },
  backButton: { x: 20, y: 18, w: 120, h: 48 },
  skipButton: { x: 510, y: 462, w: 180, h: 46 },
  openMoreButton: { x: 420, y: 600, w: 170, h: 52 },
  menuButton: { x: 610, y: 600, w: 170, h: 52 },
  resultText: "",
  resultTimer: 0,
  isSpinning: false,
  spinDuration: 7,
  spinElapsed: 0,
  strip: [],
  targetIndex: 0,
  targetOffset: 0,
  result: null,
  lastCaseType: null,
  showResultPanel: false,
  revealTime: 0,
  garagePhase: "idle",
  garageDarkenElapsed: 0,
  garageDarkenDuration: 2,
  garageRevealElapsed: 0,
  garageRevealDuration: 1.1,
  garageDrops: [],
  garageShowResult: false,
  wheelSpinButton: { x: 420, y: 612, w: 280, h: 52 },
  wheelRefreshButton: { x: 720, y: 612, w: 280, h: 52 },
  wheelResultOkButton: { x: 470, y: 580, w: 260, h: 50 },
  wheelSpinning: false,
  wheelSpinElapsed: 0,
  wheelSpinDuration: 4.8,
  wheelRotation: 0,
  wheelSpinStartRot: 0,
  wheelSpinEndRot: 0,
  wheelShowResult: false,
  wheelResult: null,
};

function layoutShopHubCards() {
  const y = 248;
  const h = 220;
  const w = 352;
  const gap = 24;
  const totalW = w * 3 + gap * 2;
  let x = Math.round((1200 - totalW) / 2);
  shopUi.casesTabButton = { x, y, w, h };
  x += w + gap;
  shopUi.wheelTabButton = { x, y, w, h };
  x += w + gap;
  shopUi.garageTabButton = { x, y, w, h };
}

layoutShopHubCards();
layoutFortuneWheelControls(shopUi);

const inventoryUi = {
  backButton: { x: 20, y: 18, w: 120, h: 48 },
  shopButton: { x: 1040, y: 18, w: 140, h: 48 },
  equipButton: { x: 300, y: 612, w: 220, h: 46 },
  sellButton: { x: 540, y: 612, w: 360, h: 46 },
  slots: [],
  page: 0,
  pageSize: 8,
  selectedSkinId: null,
};

const inventorySwipe = {
  active: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
};

const inventoryPageAnim = {
  phase: "idle",
  dragX: 0,
  elapsed: 0,
  duration: 0.34,
  fromPage: 0,
  toPage: 0,
  startOffset: 0,
  endOffset: 0,
};

const inventoryToast = { text: "", timer: 0 };

const questsUi = {
  backButton: { x: 20, y: 18, w: 120, h: 48 },
  tabDaily: { x: 0, y: 56, w: 268, h: 42 },
  tabAchievements: { x: 0, y: 56, w: 268, h: 42 },
  tabWeekly: { x: 0, y: 56, w: 268, h: 42 },
  tabCalendar: { x: 0, y: 56, w: 268, h: 42 },
  activeTab: "daily",
  /** @type {{ id?: string; kind: string; x: number; y: number; w: number; h: number }[]} */
  claimHits: [],
};

function layoutQuestsTabs() {
  const tabW = 268;
  const tabH = 42;
  const tabY = 56;
  const tabGap = 12;
  const totalW = 4 * tabW + 3 * tabGap;
  let x = Math.round((REFERENCE_WIDTH - totalW) / 2);
  questsUi.tabDaily = { x, y: tabY, w: tabW, h: tabH };
  x += tabW + tabGap;
  questsUi.tabAchievements = { x, y: tabY, w: tabW, h: tabH };
  x += tabW + tabGap;
  questsUi.tabWeekly = { x, y: tabY, w: tabW, h: tabH };
  x += tabW + tabGap;
  questsUi.tabCalendar = { x, y: tabY, w: tabW, h: tabH };
}

layoutQuestsTabs();

/** Короткое сообщение после «Забрать» награду в квестах. */
const questsToast = { text: "", timer: 0 };

/**
 * Глобальное уведомление при выполнении квеста:
 * появляется поверх любого экрана и предлагает сразу забрать награду.
 */
const questCompletePopup = {
  active: false,
  timer: 0,
  questId: null,
  title: "",
  rewardCoins: 0,
  rewardGold: 0,
  animT: 0,
};

const questCompleteUi = {
  panel: { x: 180, y: 140, w: 840, h: 240 },
  claimButton: { x: 430, y: 300, w: 340, h: 56 },
};

// Анимации начисления коинов и голды.
const coinFx = { tokens: [], labels: [] };
const goldFx = { tokens: [], labels: [] };

let questNotifyDayKey = null;
/** @type {Set<string>} */
let notifiedQuestCanClaimIds = new Set();

/** @type {Set<string>} */
let notifiedAchievementCanClaimIds = new Set();

const achievementCompletePopup = {
  active: false,
  timer: 0,
  achievementId: null,
  title: "",
  rewardCoins: 0,
  rewardGold: 0,
  animT: 0,
};

const achievementCompleteUi = {
  panel: { x: 180, y: 140, w: 840, h: 240 },
  claimButton: { x: 430, y: 300, w: 340, h: 56 },
};

const matchEndUi = {
  replayButton: { x: -500, y: -500, w: 1, h: 1 },
  newGameButton: { x: 420, y: 590, w: 170, h: 52 },
  menuButton: { x: 610, y: 590, w: 170, h: 52 },
};

const matchReplayUi = {
  backButton: { x: 20, y: 18, w: 52, h: 52 },
};

function refreshMatchEndControlsLayout() {
  const barX = 330;
  const barW = 540;
  const yBtn = isNativeMobileApp() ? Math.round(574) : 576;
  const s = isNativeMobileApp() ? getUiButtonScale() : 1;
  const canReplay = match && match.isFinished && match.hasReplayForEndScreen();
  if (canReplay) {
    const mw = isNativeMobileApp() ? Math.round(142 * s) : 156;
    const g = isNativeMobileApp() ? 10 : 12;
    const row = mw * 3 + g * 2;
    const sx = barX + (barW - row) / 2;
    matchEndUi.replayButton = { x: sx, y: yBtn, w: mw, h: Math.round(52 * (isNativeMobileApp() ? s : 1)) };
    matchEndUi.newGameButton = { x: sx + mw + g, y: yBtn, w: mw, h: matchEndUi.replayButton.h };
    matchEndUi.menuButton = { x: sx + (mw + g) * 2, y: yBtn, w: mw, h: matchEndUi.replayButton.h };
  } else {
    const mw = isNativeMobileApp() ? Math.round(170 * s) : 170;
    const gap = isNativeMobileApp() ? Math.round(30 * s) : 30;
    const row = mw * 2 + gap;
    const sx = barX + (barW - row) / 2;
    matchEndUi.newGameButton = { x: sx, y: yBtn, w: mw, h: Math.round(52 * (isNativeMobileApp() ? s : 1)) };
    matchEndUi.menuButton = { x: sx + mw + gap, y: yBtn, w: mw, h: matchEndUi.newGameButton.h };
    matchEndUi.replayButton = { x: -500, y: -500, w: 1, h: 1 };
  }
}

/** Штраф MMR за досрочный выход из матча (кнопка «домик»). */
const MATCH_FORFEIT_MMR_PENALTY = 40;

const matchLiveUi = {
  homeButton: { x: 20, y: 18, w: 52, h: 52 },
  forfeit: {
    active: false,
    exitButton: { x: 340, y: 348, w: 200, h: 50 },
    stayButton: { x: 660, y: 348, w: 200, h: 50 },
  },
};

/**
 * На APK: крупнее кнопки (без налезания друг на друга) и палитра в мастере скина.
 */
function applyNativeMobileUiLayout() {
  if (!isNativeMobileApp()) return;
  const s = getUiButtonScale();

  for (const key of Object.keys(mainMenu.buttons)) {
    if (key === "logout") scaleUiRectAnchorTopRight(mainMenu.buttons.logout, s);
    else scaleUiRectAroundCenter(mainMenu.buttons[key], s);
  }

  scaleUiRectAroundCenter(shopUi.backButton, s);
  layoutShopHubCards();
  const hubScale = 1.12;
  scaleUiRectAroundCenter(shopUi.casesTabButton, hubScale);
  scaleUiRectAroundCenter(shopUi.wheelTabButton, hubScale);
  scaleUiRectAroundCenter(shopUi.garageTabButton, hubScale);
  scaleUiRectAroundCenter(shopUi.garageOpenZoneNormal, s);
  scaleUiRectAroundCenter(shopUi.garageOpenZoneMega, s);
  scaleUiRectAroundCenter(shopUi.garageOpenAgainButton, s);
  scaleUiRectAroundCenter(shopUi.garageToHubButton, s);

  const skipW = Math.round(shopUi.skipButton.w * s);
  const skipH = Math.round(shopUi.skipButton.h * s);
  shopUi.skipButton.x = 600 - skipW / 2;
  shopUi.skipButton.y = Math.round(462 - (skipH - shopUi.skipButton.h) / 2);
  shopUi.skipButton.w = skipW;
  shopUi.skipButton.h = skipH;

  const openW = Math.round(170 * s);
  const openH = Math.round(52 * s);
  const menuW = Math.round(170 * s);
  const menuH = Math.round(52 * s);
  const pairGap = 30;
  const pairTotal = openW + pairGap + menuW;
  const pairStart = 600 - pairTotal / 2;
  shopUi.openMoreButton = { x: pairStart, y: Math.round(600 - (openH - 52) / 2), w: openW, h: openH };
  shopUi.menuButton = { x: pairStart + openW + pairGap, y: shopUi.openMoreButton.y, w: menuW, h: menuH };

  const caseScale = 1.18;
  scaleUiRectAroundCenter(shopUi.basicButton, caseScale);
  scaleUiRectAroundCenter(shopUi.premiumButton, caseScale);
  scaleUiRectAroundCenter(shopUi.vipButton, caseScale);
  layoutFortuneWheelControls(shopUi);
  scaleUiRectAroundCenter(shopUi.wheelSpinButton, s);
  scaleUiRectAroundCenter(shopUi.wheelRefreshButton, s);
  scaleUiRectAroundCenter(shopUi.wheelResultOkButton, s);

  scaleUiRectAroundCenter(inventoryUi.backButton, s);
  scaleUiRectAnchorTopRight(inventoryUi.shopButton, s);
  scaleUiRectAroundCenter(inventoryUi.equipButton, s);
  scaleUiRectAroundCenter(inventoryUi.sellButton, s);
  scaleUiRectAroundCenter(modeSelectUi.ratingButton, s);
  scaleUiRectAroundCenter(modeSelectUi.tournamentButton, s);
  scaleUiRectAroundCenter(modeSelectUi.hideSeekButton, s);
  scaleUiRectAroundCenter(modeSelectUi.backButton, s);
  scaleUiRectAroundCenter(hideSeekRoleUi.hideButton, s);
  scaleUiRectAroundCenter(hideSeekRoleUi.seekButton, s);
  scaleUiRectAroundCenter(hideSeekRoleUi.backButton, s);
  scaleUiRectAroundCenter(hideSeekResultUi.menuButton, s);
  scaleUiRectAroundCenter(hideSeekConfirmUi.yesButton, s);
  scaleUiRectAroundCenter(hideSeekConfirmUi.noButton, s);
  scaleUiRectAroundCenter(tournamentUi.fightButton, s);
  scaleUiRectAroundCenter(tournamentUi.backButton, s);
  scaleUiRectAroundCenter(questsUi.backButton, s);
  layoutQuestsTabs();
  scaleUiRectAroundCenter(questsUi.tabDaily, s);
  scaleUiRectAroundCenter(questsUi.tabAchievements, s);
  scaleUiRectAroundCenter(questsUi.tabWeekly, s);
  scaleUiRectAroundCenter(questsUi.tabCalendar, s);
  scaleUiRectAroundCenter(achievementCompleteUi.panel, s);
  scaleUiRectAroundCenter(achievementCompleteUi.claimButton, s);
  scaleUiRectAroundCenter(questCompleteUi.panel, s);
  scaleUiRectAroundCenter(questCompleteUi.claimButton, s);

  refreshMatchEndControlsLayout();

  scaleUiRectAroundCenter(matchLiveUi.homeButton, s);
  scaleUiRectAroundCenter(matchReplayUi.backButton, s);
  const fw = Math.round(200 * s);
  const fh = Math.round(50 * s);
  const fgap = Math.round(120 * s);
  const fstart = 600 - (fw * 2 + fgap) / 2;
  matchLiveUi.forfeit.exitButton = { x: fstart, y: Math.round(348), w: fw, h: fh };
  matchLiveUi.forfeit.stayButton = { x: fstart + fw + fgap, y: matchLiveUi.forfeit.exitButton.y, w: fw, h: fh };

  STUDIO_LAYOUT.paletteSwatchScale = s;
  for (const k of ["slotPrevButton", "slotNextButton", "buyExtraSlotButton"]) {
    scaleUiRectAroundCenter(STUDIO_LAYOUT[k], s);
  }
  scaleUiRectAroundCenter(STUDIO_LAYOUT.backButton, s);

  const gap = 20;
  const pw = Math.round(150 * s);
  const sw = Math.round(280 * s);
  const ew = Math.round(120 * s);
  const bh = Math.round(44 * s);
  const by = Math.round(546 - (bh - 44) / 2);
  const rowTotal = pw + sw + ew + 2 * gap;
  let bx = Math.round((1200 - rowTotal) / 2);
  STUDIO_LAYOUT.clearButton = { x: bx, y: by, w: pw, h: bh };
  bx += pw + gap;
  STUDIO_LAYOUT.saveButton = { x: bx, y: by, w: sw, h: bh };
  bx += sw + gap;
  STUDIO_LAYOUT.eraseButton = { x: bx, y: by, w: ew, h: bh };
}

applyNativeMobileUiLayout();
refreshMatchEndControlsLayout();

function showCaseResult(text) {
  shopUi.resultText = text;
  shopUi.resultTimer = 4;
}

function resetGarageUi() {
  shopUi.garagePhase = "idle";
  shopUi.garageDarkenElapsed = 0;
  shopUi.garageRevealElapsed = 0;
  shopUi.garageDrops = [];
  shopUi.garageShowResult = false;
  shopUi.garageKind = "normal";
}

function resetWheelUi() {
  shopUi.wheelSpinning = false;
  shopUi.wheelSpinElapsed = 0;
  shopUi.wheelRotation = 0;
  shopUi.wheelSpinStartRot = 0;
  shopUi.wheelSpinEndRot = 0;
  shopUi.wheelShowResult = false;
  shopUi.wheelResult = null;
}

function resetShopCasesUi() {
  shopUi.isSpinning = false;
  shopUi.spinElapsed = 0;
  shopUi.strip = [];
  shopUi.result = null;
  shopUi.showResultPanel = false;
  shopUi.revealTime = 0;
  resetWheelUi();
}

function enterShopState() {
  shopUi.mode = "hub";
  resetGarageUi();
  resetShopCasesUi();
}

function startGarageOpen(kind = "normal") {
  if (shopUi.garagePhase === "darken" || shopUi.garagePhase === "reveal") return;

  const cfg = GarageSystem.getConfig(kind);
  const result = GarageSystem.open(kind);
  if (!result.ok) {
    if (result.reason === "NOT_ENOUGH_GOLD") {
      showCaseResult(`Недостаточно gold — нужно ${cfg.price}`);
    } else {
      showCaseResult("Не удалось открыть гараж");
    }
    return;
  }

  shopUi.garageKind = kind;
  shopUi.garageDrops = result.drops;
  shopUi.garagePhase = "darken";
  shopUi.garageDarkenElapsed = 0;
  shopUi.garageRevealElapsed = 0;
  shopUi.garageShowResult = false;
  shopUi.resultText = "";
  shopUi.resultTimer = 0;
}

function randomSkinFromAll() {
  const skins = SkinSystem.getAllSkins().filter((s) => s.id !== "default");
  return skins[Math.floor(Math.random() * skins.length)] || SkinSystem.getSkinById("default");
}

function startCaseRoulette(caseType) {
  if (shopUi.isSpinning) return;

  const result = CaseSystem.openCase(caseType);
  if (!result.ok) {
    if (result.reason === "NOT_ENOUGH_GOLD") {
      showCaseResult("Недостаточно gold для открытия кейса");
    } else {
      showCaseResult("Не удалось открыть кейс");
    }
    return;
  }

  const itemCount = 52;
  const targetIndex = 44;
  const strip = [];
  for (let i = 0; i < itemCount; i += 1) {
    const pool = SkinSystem.getSkinsForCase(caseType);
    strip.push(pool[Math.floor(Math.random() * pool.length)] || randomSkinFromAll());
  }
  strip[targetIndex] = result.skin;

  shopUi.isSpinning = true;
  shopUi.spinElapsed = 0;
  shopUi.strip = strip;
  shopUi.targetIndex = targetIndex;
  shopUi.targetOffset = targetIndex * 142;
  shopUi.result = result;
  shopUi.lastCaseType = caseType;
  AchievementSystem.onCaseOpened();
  detectAndMaybeShowAchievementPopup();
  shopUi.showResultPanel = false;
  shopUi.revealTime = 0;
  shopUi.resultText = "";
  shopUi.resultTimer = 0;
}

function finishCaseRoulette() {
  const result = shopUi.result;
  if (!result) return;

  if (!result.isDuplicate) {
    refreshOwnedSkins();
  }
  shopUi.showResultPanel = true;
  shopUi.revealTime = 0;
  const duplicateText = result.isDuplicate ? " (дубликат)" : "";
  showCaseResult(`Выпало: ${result.skin.name} [${result.rarity}]${duplicateText}`);
}

function skipCaseRoulette() {
  if (!shopUi.isSpinning) return;
  shopUi.spinElapsed = shopUi.spinDuration;
  shopUi.isSpinning = false;
  finishCaseRoulette();
}

function startFortuneWheelSpin() {
  if (shopUi.wheelSpinning || shopUi.wheelShowResult) return;
  const result = FortuneWheelSystem.spin();
  if (!result.ok) {
    if (result.reason === "NOT_ENOUGH_TOKENS") {
      const freeHint = FortuneWheelSystem.canUseFreeSpin()
        ? ""
        : ` (или дождись бесплатного спина завтра)`;
      showCaseResult(
        `Нужно ${FortuneWheelSystem.WHEEL_SPIN_TOKEN_COST} жетонов — выигрывай матчи${freeHint}`,
      );
    } else {
      showCaseResult("Не удалось крутить колесо");
    }
    return;
  }
  const slice = (Math.PI * 2) / FortuneWheelSystem.WHEEL_SLOT_COUNT;
  const fullSpins = (4 + Math.floor(Math.random() * 2)) * Math.PI * 2;
  shopUi.wheelResult = result;
  shopUi.wheelSpinning = true;
  shopUi.wheelSpinElapsed = 0;
  shopUi.wheelSpinStartRot = shopUi.wheelRotation || 0;
  shopUi.wheelSpinEndRot = shopUi.wheelSpinStartRot + fullSpins - (result.index * slice + slice / 2);
  shopUi.wheelShowResult = false;
}

function finishFortuneWheelSpin() {
  if (!shopUi.wheelResult?.ok) return;
  shopUi.wheelSpinning = false;
  shopUi.wheelShowResult = true;
  if (!shopUi.wheelResult.isDuplicate) refreshOwnedSkins();
  const dup = shopUi.wheelResult.isDuplicate ? " (дубликат)" : "";
  const freeTag = shopUi.wheelResult.usedFreeSpin ? " · бесплатный спин" : "";
  showCaseResult(`Выпало: ${shopUi.wheelResult.skin.name}${dup}${freeTag}`);
}

function refreshFortuneWheelForGold() {
  if (shopUi.wheelSpinning) return;
  const r = FortuneWheelSystem.refreshForGold();
  if (!r.ok) {
    showCaseResult(`Нужно ${FortuneWheelSystem.WHEEL_REFRESH_GOLD_COST} gold для обновления`);
    return;
  }
  resetWheelUi();
  showCaseResult("Колесо обновлено!");
}

function refreshOwnedSkins() {
  if (AccountAuth.isLoggedIn()) {
    StorageSystem.syncPaintSlotsIntoInventory();
  }
  if (!StorageSystem.getInventory().includes("default")) {
    StorageSystem.addToInventory("default");
  }
  ownedSkins = SkinSystem.getOwnedSkins();
  if (ownedSkins.length === 0) {
    ownedSkins = [SkinSystem.getSkinById("default")];
  }
}

function getActiveSkinSafe() {
  refreshOwnedSkins();
  const activeSkin = SkinSystem.getActiveSkin();
  if (activeSkin) return activeSkin;
  return ownedSkins[0] || SkinSystem.getSkinById("default");
}

function startRatingMatch() {
  const selectedSkin = getActiveSkinSafe();
  match = new MatchCore(selectedSkin.id);
  SkinSystem.applySkinToPlayer(match.player, selectedSkin.id);
  matchLiveUi.forfeit.active = false;
  state = STATES.MATCH;
}

/** @type {ReturnType<typeof createPenaltyLaunch> | null} */
let penaltyLaunch = null;

function beginPenaltyLaunch() {
  penaltyLaunch = createPenaltyLaunch();
}

function startPenaltyMatch() {
  penaltyLaunch = null;
  const selectedSkin = getActiveSkinSafe();
  match = new MatchCore(selectedSkin.id, { mode: "penalty" });
  SkinSystem.applySkinToPlayer(match.player, selectedSkin.id);
  matchLiveUi.forfeit.active = false;
  state = STATES.MATCH;
}

function startTournamentMatch() {
  const selectedSkin = getActiveSkinSafe();
  const opts = TournamentSystem.getMatchOptions();
  match = new MatchCore(selectedSkin.id, opts);
  SkinSystem.applySkinToPlayer(match.player, selectedSkin.id);
  matchLiveUi.forfeit.active = false;
  state = STATES.MATCH;
}

/** @deprecated используй startRatingMatch */
function startMatch() {
  startRatingMatch();
}

function openModeSelect() {
  state = STATES.MODE_SELECT;
}

function startHideSeekMode() {
  hideSeekGame = new HideSeekGame();
  hideSeekJoystick.active = false;
  hideSeekJoystick.pointerId = null;
  hideSeekJoystick.dx = 0;
  hideSeekJoystick.dy = 0;
  state = STATES.HIDE_SEEK;
  syncBackgroundMusic();
}

function exitHideSeekToMenu() {
  hideSeekGame = null;
  state = STATES.MAIN_MENU;
  syncBackgroundMusic();
}

function openTournamentScreen() {
  const r = TournamentSystem.enterTournament();
  if (!r.ok) return;
  beginTournamentIntro(Boolean(r.resumed));
  state = STATES.TOURNAMENT;
}

function returnToTournamentLadderAfterMatch(won) {
  match = null;
  if (won) {
    setTournamentToast(tournamentResultMsg || "Победа!");
    beginTournamentIntro(true);
    state = STATES.TOURNAMENT;
  } else {
    setTournamentToast("Поражение. Турнир через 30 мин");
    state = STATES.MODE_SELECT;
  }
}

function confirmMatchForfeit() {
  if (!match || match.isFinished) return;
  const wasTournament = match.isTournament;
  const wasPenalty = match.isPenalty;
  if (wasTournament) {
    TournamentSystem.onDefeat();
  } else if (!wasPenalty) {
    EloSystem.applyForfeit(MATCH_FORFEIT_MMR_PENALTY);
    WinStreakSystem.onMatchEnd(false);
  }
  matchLiveUi.forfeit.active = false;
  match = null;
  if (wasTournament) state = STATES.MODE_SELECT;
  else if (wasPenalty) state = STATES.MODE_SELECT;
  else state = STATES.MAIN_MENU;
}

function handleMatchLiveUiTap(pointer) {
  if (!match || match.isFinished) return false;

  const f = matchLiveUi.forfeit;
  if (f.active) {
    if (hitUiButton(pointer.x, pointer.y, f.exitButton)) {
      confirmMatchForfeit();
      return true;
    }
    if (hitUiButton(pointer.x, pointer.y, f.stayButton)) {
      f.active = false;
      return true;
    }
    return true;
  }

  if (hitUiButton(pointer.x, pointer.y, matchLiveUi.homeButton)) {
    f.active = true;
    return true;
  }
  return false;
}

function isPointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function playUiClick() {
  AudioManager.play("ui_click");
}

/** Попадание по UI-кнопке: сначала звук клика. */
function hitUiButton(px, py, rect) {
  if (!isPointInRect(px, py, rect)) return false;
  playUiClick();
  return true;
}

/** Меню-музыка во время матча: рейтинг, турнир, пенальти (все режимы Play). */
function matchKeepsMenuMusic() {
  return Boolean(match && !match.isFinished);
}

function shouldPlayMenuMusic() {
  if (AudioManager.isGoalSoundPlaying()) return false;
  if (state === STATES.HIDE_SEEK) return false;
  if (state === STATES.MATCH_REPLAY) return false;
  if (state === STATES.MATCH && match && !match.isFinished) {
    return matchKeepsMenuMusic();
  }
  return true;
}

function shouldPlayHideSeekMusic() {
  return state === STATES.HIDE_SEEK && hideSeekGame?.phase !== "result";
}

function syncBackgroundMusic() {
  if (shouldPlayHideSeekMusic()) {
    AudioManager.syncHideSeekMusic(true);
    return;
  }
  AudioManager.syncHideSeekMusic(false);
  AudioManager.syncMenuMusic(shouldPlayMenuMusic());
}

function handleInventoryUiTap(pointer) {
  if (inventoryPageAnim.phase === "animate") return;

  if (hitUiButton(pointer.x, pointer.y, inventoryUi.backButton)) {
    inventoryUi.selectedSkinId = null;
    state = STATES.MAIN_MENU;
    return;
  }
  if (hitUiButton(pointer.x, pointer.y, inventoryUi.shopButton)) {
    DailyQuestSystem.markShopVisited();
    detectAndMaybeShowQuestCompletePopup();
    shopReturnState = STATES.INVENTORY;
    enterShopState();
    state = STATES.SHOP;
    return;
  }
  if (inventoryUi.selectedSkinId && hitUiButton(pointer.x, pointer.y, inventoryUi.equipButton)) {
    const sid = inventoryUi.selectedSkinId;
    const slot = SkinSystem.getEquipSlot(sid);
    let ok = false;
    if (slot === "ball") ok = SkinSystem.setActiveBallPaint(sid);
    else if (slot === "goal") ok = SkinSystem.setActiveGoalPaint(sid);
    else ok = SkinSystem.setActiveSkin(sid);
    refreshOwnedSkins();
    inventoryToast.text = ok
      ? slot === "ball"
        ? "Раскраска на мяч применена"
        : slot === "goal"
          ? "Раскраска на ворота применена"
          : "Скин надет"
      : "Не удалось применить";
    inventoryToast.timer = 2;
    return;
  }
  if (inventoryUi.selectedSkinId && hitUiButton(pointer.x, pointer.y, inventoryUi.sellButton)) {
    const sid = inventoryUi.selectedSkinId;
    if (!SkinSellSystem.canSell(sid)) {
      inventoryToast.text = "Этот скин нельзя продать";
      inventoryToast.timer = 2;
      return;
    }
    const r = SkinSellSystem.sell(sid);
    if (r.ok) {
      refreshOwnedSkins();
      inventoryUi.selectedSkinId = null;
      const totalPages = Math.max(1, Math.ceil(ownedSkins.length / inventoryUi.pageSize));
      inventoryUi.page = Math.min(inventoryUi.page, totalPages - 1);
      inventoryToast.text = `Продано! +${r.gold} gold`;
      inventoryToast.timer = 2.4;
    } else if (r.reason === "LAST_SKIN") {
      inventoryToast.text = "Нельзя продать последний скин";
      inventoryToast.timer = 2;
    } else {
      inventoryToast.text = "Этот скин нельзя продать";
      inventoryToast.timer = 2;
    }
    return;
  }
  for (const slot of inventoryUi.slots) {
    if (hitUiButton(pointer.x, pointer.y, slot.rect)) {
      inventoryUi.selectedSkinId =
        inventoryUi.selectedSkinId === slot.skin.id ? null : slot.skin.id;
    }
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getInventoryTotalPages() {
  return Math.max(1, Math.ceil(ownedSkins.length / inventoryUi.pageSize));
}

function beginInventoryPageSlide(direction) {
  const totalPages = getInventoryTotalPages();
  const toPage = (inventoryUi.page + direction + totalPages) % totalPages;
  if (toPage === inventoryUi.page) return;
  inventoryPageAnim.phase = "animate";
  inventoryPageAnim.elapsed = 0;
  inventoryPageAnim.fromPage = inventoryUi.page;
  inventoryPageAnim.toPage = toPage;
  inventoryPageAnim.startOffset = inventoryPageAnim.dragX;
  inventoryPageAnim.endOffset = direction > 0 ? -1200 : 1200;
  inventoryPageAnim.dragX = inventoryPageAnim.startOffset;
}

function updateInventoryPageAnim(deltaTime) {
  if (inventoryPageAnim.phase !== "animate") return;
  inventoryPageAnim.elapsed += deltaTime;
  const t = Math.min(1, inventoryPageAnim.elapsed / inventoryPageAnim.duration);
  const eased = easeOutCubic(t);
  inventoryPageAnim.dragX =
    inventoryPageAnim.startOffset + (inventoryPageAnim.endOffset - inventoryPageAnim.startOffset) * eased;
  if (t >= 1) {
    inventoryUi.page = inventoryPageAnim.toPage;
    inventoryPageAnim.phase = "idle";
    inventoryPageAnim.dragX = 0;
  }
}

function getInventorySlideOffset() {
  if (inventoryPageAnim.phase === "animate" || inventoryPageAnim.phase === "drag") {
    return inventoryPageAnim.dragX;
  }
  return 0;
}

function tryInventorySwipePage(endX, endY) {
  const dx = endX - inventorySwipe.startX;
  const dy = endY - inventorySwipe.startY;
  const threshold = 72;
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.1) {
    if (Math.abs(inventoryPageAnim.dragX) > 12) {
      inventoryPageAnim.phase = "animate";
      inventoryPageAnim.elapsed = 0;
      inventoryPageAnim.startOffset = inventoryPageAnim.dragX;
      inventoryPageAnim.endOffset = 0;
      inventoryPageAnim.fromPage = inventoryUi.page;
      inventoryPageAnim.toPage = inventoryUi.page;
      return true;
    }
    inventoryPageAnim.phase = "idle";
    inventoryPageAnim.dragX = 0;
    return false;
  }
  refreshOwnedSkins();
  beginInventoryPageSlide(dx < 0 ? 1 : -1);
  return true;
}

function normalizePointerFromClientXY(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  return { x, y };
}

function normalizePointerFromEvent(event) {
  return normalizePointerFromClientXY(event.clientX, event.clientY);
}

/** Меню, магазин, инвентарь, кнопки после матча — раньше только через `click`, на телефоне не срабатывало. */
function handleCanvasUiTap(clientX, clientY) {
  const pointer = normalizePointerFromClientXY(clientX, clientY);

  if (!appUnlocked) return;

  if (tryClaimGlobalRewardPopup(pointer)) return;

  if (state === STATES.MATCH_REPLAY && matchReplayPlayer) {
    if (hitUiButton(pointer.x, pointer.y, matchReplayUi.backButton)) {
      matchReplayPlayer = null;
      state = STATES.MATCH;
    }
    return;
  }

  if (state === STATES.MAIN_MENU) {
    const action = mainMenu.getActionAt(pointer.x, pointer.y);
    if (!action) return;
    playUiClick();
    if (action === "LOGOUT") {
      AccountAuth.logout();
      appUnlocked = false;
      authUi.show();
      state = STATES.MAIN_MENU;
      return;
    }
    if (action === "PLAY") openModeSelect();
    else if (action === "SHOP") {
      DailyQuestSystem.markShopVisited();
      detectAndMaybeShowQuestCompletePopup();
      shopReturnState = STATES.MAIN_MENU;
      enterShopState();
      state = STATES.SHOP;
    } else if (action === "INVENTORY") {
      DailyQuestSystem.markInventoryVisited();
      detectAndMaybeShowQuestCompletePopup();
      inventoryUi.selectedSkinId = null;
      state = STATES.INVENTORY;
    } else if (action === "QUESTS") {
      questsUi.activeTab = "daily";
      state = STATES.QUESTS;
    }
    else if (action === "PAINT_SKIN") enterPaintSkinState();
    else if (action === "SETTINGS") state = STATES.SETTINGS;
    return;
  }

  if (state === STATES.SETTINGS) {
    if (hitUiButton(pointer.x, pointer.y, settingsUi.backButton)) {
      state = STATES.MAIN_MENU;
    }
    return;
  }

  if (state === STATES.MODE_SELECT) {
    const pick = getModeSelectActionAt(pointer.x, pointer.y);
    if (!pick) return;
    playUiClick();
    if (pick === "BACK") {
      state = STATES.MAIN_MENU;
      return;
    }
    if (pick === "RATING") {
      startRatingMatch();
      return;
    }
    if (pick === "TOURNAMENT") {
      openTournamentScreen();
      return;
    }
    if (pick === "PENALTY") {
      beginPenaltyLaunch();
      return;
    }
    if (pick === "HIDE_SEEK") {
      startHideSeekMode();
    }
    return;
  }

  if (state === STATES.HIDE_SEEK && hideSeekGame) {
    if (hideSeekGame.phase === "role_select" || hideSeekGame.phase === "enter_fade") {
      const act = getHideSeekRoleActionAt(pointer.x, pointer.y);
      if (act === "BACK") {
        playUiClick();
        hideSeekGame = null;
        state = STATES.MODE_SELECT;
        return;
      }
      if (hideSeekGame.phase === "role_select") {
        if (act === "HIDE") {
          playUiClick();
          hideSeekGame.startWithRole("hider");
        } else if (act === "SEEK") {
          playUiClick();
          hideSeekGame.startWithRole("seeker");
        }
      }
      return;
    }
    if (hideSeekGame.phase === "result") {
      if (getHideSeekResultActionAt(pointer.x, pointer.y) === "MENU") {
        playUiClick();
        exitHideSeekToMenu();
      }
      return;
    }
    if (hideSeekGame.confirmSpotId) {
      const cAct = getHideSeekConfirmActionAt(pointer.x, pointer.y);
      if (cAct === "YES") {
        playUiClick();
        hideSeekGame.confirmYes();
      } else if (cAct === "NO") {
        playUiClick();
        hideSeekGame.confirmNo();
      }
      return;
    }
    if (hideSeekGame.isOnMap() && !hideSeekGame.confirmSpotId) {
      hideSeekGame.tryOpenConfirmAt(pointer.x, pointer.y);
    }
    return;
  }

  if (state === STATES.TOURNAMENT) {
    if (tournamentUi.phase !== "ladder") return;
    const act = getTournamentActionAt(pointer.x, pointer.y);
    if (!act) return;
    playUiClick();
    if (act === "BACK") {
      state = STATES.MODE_SELECT;
      return;
    }
    if (act === "FIGHT") {
      const snap = TournamentSystem.getSnapshot();
      if (!snap.canFight) {
        if (snap.onCooldown) setTournamentToast(`Кулдаун ${snap.cooldownText}`);
        return;
      }
      startTournamentFightAnim();
    }
    return;
  }

  if (state === STATES.QUESTS) {
    if (hitUiButton(pointer.x, pointer.y, questsUi.backButton)) {
      state = STATES.MAIN_MENU;
      return;
    }
    if (hitUiButton(pointer.x, pointer.y, questsUi.tabDaily)) {
      questsUi.activeTab = "daily";
      return;
    }
    if (hitUiButton(pointer.x, pointer.y, questsUi.tabAchievements)) {
      questsUi.activeTab = "achievements";
      return;
    }
    if (hitUiButton(pointer.x, pointer.y, questsUi.tabWeekly)) {
      questsUi.activeTab = "weekly";
      return;
    }
    if (hitUiButton(pointer.x, pointer.y, questsUi.tabCalendar)) {
      questsUi.activeTab = "calendar";
      return;
    }
    for (const h of questsUi.claimHits) {
      if (hitUiButton(pointer.x, pointer.y, h)) {
        let r;
        if (h.kind === "achievement") r = AchievementSystem.claim(h.id);
        else if (h.kind === "weekly") r = WeeklyQuestSystem.claim();
        else if (h.kind === "calendar") r = RewardCalendarSystem.claimToday();
        else {
          r = DailyQuestSystem.claim(h.id);
          if (r.ok) AchievementSystem.onQuestRewardClaimed();
        }
        if (r.ok) {
          const bits = [];
          if (r.coins > 0) bits.push(`+${r.coins} коин`);
          if (r.gold > 0) bits.push(`+${r.gold} gold`);
          questsToast.text = bits.length ? bits.join(" · ") : "Награда получена";
          questsToast.timer = 2.4;
          if (questCompletePopup.active && questCompletePopup.questId === h.id) {
            questCompletePopup.active = false;
            questCompletePopup.questId = null;
          }
          if (achievementCompletePopup.active && achievementCompletePopup.achievementId === h.id) {
            achievementCompletePopup.active = false;
            achievementCompletePopup.achievementId = null;
          }
          detectAndMaybeShowQuestCompletePopup();
          detectAndMaybeShowAchievementPopup();
        } else if (r.reason === "NOT_DONE") {
          questsToast.text = "Сначала выполни задание";
          questsToast.timer = 1.6;
        } else if (r.reason === "ALREADY") {
          questsToast.text = "Награда уже забрана";
          questsToast.timer = 1.6;
        }
        return;
      }
    }
    return;
  }

  if (state === STATES.PAINT_SKIN) {
    clampPaintStudioSlot();
    const slotTotal = StorageSystem.getPaintSlotTotal();
    const canBuy = slotTotal < MAX_PAINT_SLOTS;
    const hit = interpretStudioHit(pointer.x, pointer.y, paintStudio.selectedSlot, slotTotal, canBuy);
    if (!hit || hit.action === "PAINT_SURFACE") return;
    playUiClick();

    if (hit.action === "BACK") {
      state = STATES.MAIN_MENU;
      return;
    }
    if (hit.action === "SLOT_PREV") {
      if (slotTotal <= 1) return;
      paintStudio.selectedSlot = (paintStudio.selectedSlot - 1 + slotTotal) % slotTotal;
      loadPaintBufferForSlot(paintStudio.selectedSlot);
      return;
    }
    if (hit.action === "SLOT_NEXT") {
      if (slotTotal <= 1) return;
      paintStudio.selectedSlot = (paintStudio.selectedSlot + 1) % slotTotal;
      loadPaintBufferForSlot(paintStudio.selectedSlot);
      return;
    }
    if (hit.action === "BUY_SLOT") {
      const result = CurrencySystem.buyExtraPaintSlotWithGold();
      if (!result.ok && result.reason === "GOLD") {
        setPaintStudioMessage(`Нужно ещё ${EXTRA_PAINT_SLOT_GOLD_PRICE} gold`);
      } else if (!result.ok && result.reason === "MAX") {
        setPaintStudioMessage("Достигнут лимит мест");
      } else {
        refreshOwnedSkins();
        setPaintStudioMessage(`+1 место! −${EXTRA_PAINT_SLOT_GOLD_PRICE} gold`);
      }
      return;
    }
    if (hit.action === "COLOR" && hit.color) {
      paintStudio.brushColor = hit.color;
      paintStudio.eraser = false;
      return;
    }
    if (hit.action === "ERASER_TOGGLE") {
      paintStudio.eraser = !paintStudio.eraser;
      return;
    }
    if (hit.action === "CLEAR") {
      ensurePaintSkinBuffer().resetTemplate();
      setPaintStudioMessage("Холст этого места очищен (сохрани, если нужно)");
      return;
    }
    if (hit.action === "SAVE") {
      if (!CurrencySystem.spendCoins(SAVE_PAINT_COINS_COST)) {
        setPaintStudioMessage(`Нужно ${SAVE_PAINT_COINS_COST} коин для сохранения`);
        return;
      }
      const url = ensurePaintSkinBuffer().toDataUrlPng();
      StorageSystem.setPaintSlotDataUrl(paintStudio.selectedSlot, url);
      SkinSystem.invalidatePaintSlotTexture(paintStudio.selectedSlot);
      SkinSystem.setActiveSkin(`paint_slot_${paintStudio.selectedSlot}`);
      refreshOwnedSkins();
      setPaintStudioMessage(`Сохранено в месте ${paintStudio.selectedSlot + 1} и включено! −${SAVE_PAINT_COINS_COST} коин`);
    }
    return;
  }

  if (state === STATES.SHOP) {
    if (shopUi.mode === "garage" && (shopUi.garagePhase === "darken" || shopUi.garagePhase === "reveal")) {
      return;
    }

    if (shopUi.mode === "garage" && shopUi.garageShowResult) {
      if (hitUiButton(pointer.x, pointer.y, shopUi.garageOpenAgainButton)) {
        startGarageOpen(shopUi.garageKind);
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, shopUi.garageToHubButton)) {
        shopUi.mode = "hub";
        resetGarageUi();
        return;
      }
    }

    if (shopUi.mode === "wheel" && shopUi.wheelSpinning) {
      return;
    }

    if (shopUi.mode === "wheel" && shopUi.wheelShowResult) {
      if (hitUiButton(pointer.x, pointer.y, shopUi.wheelResultOkButton)) {
        resetWheelUi();
        return;
      }
      return;
    }

    if (shopUi.mode === "cases" && shopUi.isSpinning) {
      playUiClick();
      skipCaseRoulette();
      return;
    }

    if (shopUi.mode === "cases" && shopUi.showResultPanel) {
      if (hitUiButton(pointer.x, pointer.y, shopUi.openMoreButton)) {
        startCaseRoulette(shopUi.lastCaseType || "basic");
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, shopUi.menuButton)) {
        state = shopReturnState;
        shopReturnState = STATES.MAIN_MENU;
        enterShopState();
      }
      return;
    }

    if (hitUiButton(pointer.x, pointer.y, shopUi.backButton)) {
      if (shopUi.mode === "hub") {
        state = shopReturnState;
        shopReturnState = STATES.MAIN_MENU;
        enterShopState();
      } else {
        shopUi.mode = "hub";
        resetGarageUi();
        resetShopCasesUi();
        resetWheelUi();
      }
      return;
    }

    if (shopUi.mode === "hub") {
      if (hitUiButton(pointer.x, pointer.y, shopUi.casesTabButton)) {
        shopUi.mode = "cases";
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, shopUi.wheelTabButton)) {
        shopUi.mode = "wheel";
        FortuneWheelSystem.ensureDailyWheel();
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, shopUi.garageTabButton)) {
        shopUi.mode = "garage";
        resetGarageUi();
        return;
      }
      return;
    }

    if (shopUi.mode === "wheel") {
      if (hitUiButton(pointer.x, pointer.y, shopUi.wheelSpinButton)) {
        startFortuneWheelSpin();
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, shopUi.wheelRefreshButton)) {
        refreshFortuneWheelForGold();
        return;
      }
      return;
    }

    if (shopUi.mode === "garage" && shopUi.garagePhase === "idle" && !shopUi.garageShowResult) {
      if (hitUiButton(pointer.x, pointer.y, shopUi.garageOpenZoneNormal)) {
        startGarageOpen("normal");
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, shopUi.garageOpenZoneMega)) {
        startGarageOpen("mega");
        return;
      }
      return;
    }

    if (shopUi.mode === "cases") {
      if (hitUiButton(pointer.x, pointer.y, shopUi.basicButton)) {
        startCaseRoulette("basic");
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, shopUi.premiumButton)) {
        startCaseRoulette("premium");
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, shopUi.vipButton)) {
        startCaseRoulette("vip");
      }
    }
    return;
  }

  if (state === STATES.INVENTORY) {
    handleInventoryUiTap(pointer);
    return;
  }

  if (state === STATES.MATCH) {
    if (handleMatchLiveUiTap(pointer)) return;
    if (match && match.isFinished) {
      if (match.hasReplayForEndScreen() && hitUiButton(pointer.x, pointer.y, matchEndUi.replayButton)) {
        const payload = match.getReplayPayload();
        if (payload) {
          matchReplayPlayer = new MatchReplayPlayer(payload);
          state = STATES.MATCH_REPLAY;
        }
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, matchEndUi.newGameButton)) {
        const won = match.isPenalty
          ? match.playerScore >= match.winScoreToWin
          : match.playerScore > match.botScore;
        if (match.isTournament) {
          returnToTournamentLadderAfterMatch(won);
        } else if (match.isPenalty) {
          beginPenaltyLaunch();
        } else {
          startRatingMatch();
        }
        return;
      }
      if (hitUiButton(pointer.x, pointer.y, matchEndUi.menuButton)) {
        match = null;
        state = STATES.MAIN_MENU;
      }
    }
  }
}

canvas.addEventListener("pointerdown", (event) => {
  AudioManager.unlock();
  if (!appUnlocked) return;
  const pointer = normalizePointerFromEvent(event);

  if (tryClaimGlobalRewardPopup(pointer)) return;

  if (state === STATES.HIDE_SEEK && hideSeekGame?.isOnMap() && !hideSeekGame.confirmSpotId) {
    if (hideSeekGame.canMovePlayer() && joystickPointerDown(hideSeekJoystick, event.pointerId, pointer.x, pointer.y)) {
      event.preventDefault();
      return;
    }
  }

  if (state === STATES.MATCH && match && !match.isFinished) {
    if (handleMatchLiveUiTap(pointer)) return;
    match.tryGrabPlayer(pointer.x, pointer.y);
    return;
  }

  if (state === STATES.PAINT_SKIN) {
    clampPaintStudioSlot();
    const slotTotal = StorageSystem.getPaintSlotTotal();
    const canBuy = slotTotal < MAX_PAINT_SLOTS;
    const hit = interpretStudioHit(pointer.x, pointer.y, paintStudio.selectedSlot, slotTotal, canBuy);
    if (hit?.action === "PAINT_SURFACE") {
      paintStudio.painting = true;
      paintStudio.lastTexX = null;
      paintStudio.lastTexY = null;
      const buf = ensurePaintSkinBuffer();
      const t = screenToTexture(pointer.x, pointer.y, buf.size);
      if (!t) return;
      buf.stampLine(t.tx, t.ty, t.tx, t.ty, PAINT_BRUSH_RADIUS_TEX, paintStudio.brushColor, paintStudio.eraser);
      paintStudio.lastTexX = t.tx;
      paintStudio.lastTexY = t.ty;
      event.preventDefault();
      return;
    }
  }

  if (state === STATES.SETTINGS) {
    const slider = getSettingsSliderAt(pointer.x, pointer.y);
    if (slider) {
      settingsUi.dragging = slider;
      settingsUi.dragPointerId = event.pointerId;
      applySettingsSliderPointer(slider, pointer.x);
      AudioManager.updateVolumes();
      return;
    }
    handleCanvasUiTap(event.clientX, event.clientY);
    return;
  }

  if (state === STATES.INVENTORY) {
    if (inventoryPageAnim.phase === "animate") return;
    inventorySwipe.active = true;
    inventorySwipe.pointerId = event.pointerId;
    inventorySwipe.startX = pointer.x;
    inventorySwipe.startY = pointer.y;
    inventoryPageAnim.phase = "drag";
    inventoryPageAnim.dragX = 0;
    return;
  }

  handleCanvasUiTap(event.clientX, event.clientY);
});

window.addEventListener("pointermove", (event) => {
  if (state === STATES.HIDE_SEEK && hideSeekGame?.isOnMap()) {
    const pointer = normalizePointerFromEvent(event);
    joystickPointerMove(hideSeekJoystick, event.pointerId, pointer.x, pointer.y);
  }

  if (state === STATES.SETTINGS && settingsUi.dragging && event.pointerId === settingsUi.dragPointerId) {
    const pointer = normalizePointerFromEvent(event);
    applySettingsSliderPointer(settingsUi.dragging, pointer.x);
    AudioManager.updateVolumes();
    return;
  }

  if (state === STATES.INVENTORY && inventorySwipe.active && event.pointerId === inventorySwipe.pointerId) {
    if (inventoryPageAnim.phase === "drag") {
      const pointer = normalizePointerFromEvent(event);
      let dx = pointer.x - inventorySwipe.startX;
      const maxDrag = 420;
      dx = Math.max(-maxDrag, Math.min(maxDrag, dx));
      inventoryPageAnim.dragX = dx;
    }
    return;
  }

  if (!appUnlocked || state !== STATES.PAINT_SKIN || !paintStudio.painting) return;
  const pointer = normalizePointerFromEvent(event);
  const buf = ensurePaintSkinBuffer();
  const t = screenToTexture(pointer.x, pointer.y, buf.size);
  if (!t) {
    paintStudio.lastTexX = null;
    paintStudio.lastTexY = null;
    return;
  }
  if (paintStudio.lastTexX == null || paintStudio.lastTexY == null) {
    paintStudio.lastTexX = t.tx;
    paintStudio.lastTexY = t.ty;
    return;
  }
  buf.stampLine(paintStudio.lastTexX, paintStudio.lastTexY, t.tx, t.ty, PAINT_BRUSH_RADIUS_TEX, paintStudio.brushColor, paintStudio.eraser);
  paintStudio.lastTexX = t.tx;
  paintStudio.lastTexY = t.ty;
});

function endPointerPaintingAndMatchDrag() {
  paintStudio.painting = false;
  paintStudio.lastTexX = null;
  paintStudio.lastTexY = null;
  if (match) match.releasePlayer();
}

function endPointerUi(event) {
  if (state === STATES.SETTINGS && settingsUi.dragging && event.pointerId === settingsUi.dragPointerId) {
    settingsUi.dragging = null;
    settingsUi.dragPointerId = null;
    return;
  }

  if (state === STATES.HIDE_SEEK) {
    joystickPointerUp(hideSeekJoystick, event.pointerId);
  }

  if (state === STATES.INVENTORY && inventorySwipe.active && event.pointerId === inventorySwipe.pointerId) {
    inventorySwipe.active = false;
    const pointer = normalizePointerFromEvent(event);
    if (!tryInventorySwipePage(pointer.x, pointer.y)) {
      handleInventoryUiTap(pointer);
    }
    return;
  }
  endPointerPaintingAndMatchDrag(event);
}

window.addEventListener("pointerup", endPointerUi);
window.addEventListener("pointercancel", endPointerUi);

function drawButton(rect, text, color) {
  ctx.fillStyle = color;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = isNativeMobileApp() ? Math.round(18 * Math.min(getUiButtonScale(), 1.35)) : 18;
  ctx.font = `bold ${fs}px Arial`;
  ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function getRarityVisual(rarity) {
  const r = String(rarity || "").toLowerCase();
  const pulseSlow = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(uiTime * 3.2));
  const pulseFast = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(uiTime * 7.5));

  if (r === "rare") return { color: "#4fc3f7", glow: "rgba(79,195,247,0.55)" };
  if (r === "epic") return { color: "#b388ff", glow: "rgba(179,136,255,0.58)" };
  if (r === "mythic") return { color: `rgba(255,82,82,${0.55 + 0.45 * pulseFast})`, glow: "rgba(255,82,82,0.78)" };
  if (r === "legendary") return { color: `rgba(255,215,64,${0.5 + 0.5 * pulseSlow})`, glow: "rgba(255,215,64,0.82)" };
  if (r === "top") {
    return {
      color: `rgba(0,230,118,${0.65 + 0.35 * pulseFast})`,
      glow: "rgba(105,240,174,0.95)",
    };
  }
  if (r === "unique") return { color: "#9575cd", glow: "rgba(149,117,205,0.55)" };
  if (r === "админ" || r === "admin") {
    return {
      color: `rgba(255,61,0,${0.75 + 0.25 * pulseFast})`,
      glow: "rgba(255,152,0,0.95)",
    };
  }
  return { color: "#cfd8dc", glow: "rgba(207,216,220,0.4)" };
}

function formatDropPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (n >= 10) return `${n.toFixed(0)}%`;
  if (n >= 1) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}

function buildCaseDropLine(group, maxWidth) {
  const head = `${group.rarity} ${formatDropPercent(group.rarityChance)}: `;
  const parts = group.items.map((item) => `${item.skin.name} ${formatDropPercent(item.percent)}`);
  if (parts.length === 0) return `${head}—`;
  let line = head;
  let used = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const chunk = (used === 0 ? "" : ", ") + parts[i];
    if (ctx.measureText(line + chunk).width > maxWidth) {
      const rest = parts.length - used;
      if (rest > 0) line += ` …+${rest}`;
      return line;
    }
    line += chunk;
    used += 1;
  }
  return line;
}

/** Панель «что может выпасть» снизу экрана магазина. */
function drawCaseDropOddsPanel(caseType, rect) {
  const cfg = CaseSystem.getCaseConfig(caseType);
  const groups = CaseSystem.getDropGroups(caseType);
  if (!cfg || groups.length === 0) return;

  ctx.save();
  ctx.fillStyle = "rgba(4,10,22,0.88)";
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(rect.x + 6, rect.y + 26, rect.w - 12, rect.h - 32);
  ctx.clip();

  const padX = rect.x + 12;
  const titleY = rect.y + 18;
  const lineH = 14;
  let y = rect.y + 36;
  const maxTextW = rect.w - 24;

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe082";
  ctx.font = "bold 13px Arial";
  const caseLabels = { basic: "BASIC", premium: "PREMIUM", vip: "VIP" };
  const caseLabel = caseLabels[caseType] || String(caseType || "CASE").toUpperCase();
  ctx.fillText(`Выпадения · ${caseLabel} · ${cfg.price} gold`, padX, titleY);

  ctx.font = "11px Arial";
  const maxLines = Math.max(2, Math.floor((rect.h - 40) / lineH));

  for (let g = 0; g < groups.length; g += 1) {
    if (y > rect.y + rect.h - 8) break;
    const group = groups[g];
    const style = getRarityVisual(group.rarity);
    ctx.fillStyle = style.color;
    const line = buildCaseDropLine(group, maxTextW);
    const linesUsed = Math.max(1, Math.ceil(ctx.measureText(line).width / maxTextW));
    if (g >= maxLines && g < groups.length - 1) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText("…", padX, y);
      break;
    }
    ctx.fillText(line, padX, y, maxTextW);
    y += lineH * Math.min(linesUsed, 2);
  }

  ctx.restore();
}

function drawRarityBadge(x, y, w, h, rarity) {
  const style = getRarityVisual(rarity);
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(7,12,22,0.9)";
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = style.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 12px Arial";
  ctx.fillText(String(rarity || "Default").toUpperCase(), x + w / 2, y + h / 2);
}

function drawShopChrome(title, extra = null) {
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 44px Arial";
  ctx.fillText(title, 600, 96);

  drawButton(shopUi.backButton, "Назад", "#455a64");

  ctx.fillStyle = "#ffe082";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "bold 20px Arial";
  ctx.fillText(`Gold: ${CurrencySystem.getGold()}`, 16, 44);
  if (extra?.fortuneTokens !== undefined) {
    ctx.fillStyle = "#81d4fa";
    ctx.fillText(`Жетоны: ${extra.fortuneTokens}`, 200, 44);
    if (extra.fortuneRefreshLabel) {
      ctx.font = "13px Arial";
      ctx.fillStyle = "rgba(207,216,220,0.85)";
      ctx.fillText(`Колесо: ${extra.fortuneRefreshLabel}`, 200, 64);
    }
  }
}

function drawShopHeader(title, chromeExtra = null) {
  const bg = ctx.createLinearGradient(0, 0, 0, 700);
  bg.addColorStop(0, "#0b1324");
  bg.addColorStop(1, "#111b33");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 700);
  drawShopChrome(title, chromeExtra);
}

function drawShopHubCard(rect, data) {
  const pulse = 0.5 + 0.5 * Math.sin(uiTime * 2.4);
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, data.colorA);
  grad.addColorStop(1, data.colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = `rgba(255,255,255,${0.28 + pulse * 0.18})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px Arial";
  ctx.fillText(data.title, rect.x + rect.w / 2, rect.y + 72);
  ctx.font = "18px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(data.subtitle, rect.x + rect.w / 2, rect.y + 118);
  ctx.font = "bold 22px Arial";
  ctx.fillStyle = data.accent;
  ctx.fillText(data.hint, rect.x + rect.w / 2, rect.y + rect.h - 42);
}

function drawShopHub() {
  const tokens = FortuneWheelSystem.getTokens();
  drawShopHeader("Магазин", { fortuneTokens: tokens });
  drawShopHubCard(shopUi.casesTabButton, {
    title: "Кейсы",
    subtitle: "Basic, Premium, VIP",
    hint: "от 100 gold",
    colorA: "#1f7a42",
    colorB: "#0d3d24",
    accent: "#a5d6a7",
  });
  drawShopHubCard(shopUi.wheelTabButton, {
    title: "Колесо фортуны",
    subtitle: "Весенние призы",
    hint: `5 жетонов · у тебя ${tokens}`,
    colorA: "#66bb6a",
    colorB: "#2e7d32",
    accent: "#fff59d",
  });
  drawShopHubCard(shopUi.garageTabButton, {
    title: "Гаражи скинов",
    subtitle: "5 или 10 скинов за заход",
    hint: "1500 / 3000 Gold",
    colorA: "#e65100",
    colorB: "#4a148c",
    accent: "#ffcc80",
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "17px Arial";
  ctx.fillText("Выбери раздел магазина", 600, 520);
}

function drawGaragePriceBadge(cx, y, price) {
  const w = 220;
  const h = 44;
  const x = cx - w / 2;
  ctx.fillStyle = "rgba(8,12,24,0.88)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#ffd54f";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe082";
  ctx.font = "bold 24px Arial";
  ctx.fillText(`${price} Gold`, cx, y + h / 2);
}

function drawGaragePanel(kind, zone) {
  const cfg = GarageSystem.getConfig(kind);
  const cx = zone.x + zone.w / 2;
  const imgTop = zone.y + 8;

  drawGaragePriceBadge(cx, zone.y - 44, cfg.price);

  const glow = ctx.createRadialGradient(cx, zone.y + zone.h * 0.55, 20, cx, zone.y + zone.h * 0.55, zone.w * 0.62);
  glow.addColorStop(0, "rgba(255,152,0,0.22)");
  glow.addColorStop(0.5, "rgba(156,39,176,0.12)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(zone.x - 24, zone.y - 16, zone.w + 48, zone.h + 48);

  const garageImg = GarageSystem.getGarageImage(kind);
  const maxW = zone.w - 20;
  const maxH = zone.h - 20;
  let drawW = maxW;
  let drawH = maxH;
  if (garageImg.naturalWidth > 0 && garageImg.naturalHeight > 0) {
    const scale = Math.min(maxW / garageImg.naturalWidth, maxH / garageImg.naturalHeight);
    drawW = garageImg.naturalWidth * scale;
    drawH = garageImg.naturalHeight * scale;
  }
  const imgX = cx - drawW / 2;
  const imgY = imgTop + (maxH - drawH) / 2;
  const fileHint = cfg.imagePath.split("/").pop();

  ctx.save();
  ctx.shadowColor = "rgba(255,193,7,0.35)";
  ctx.shadowBlur = 22;
  if (garageImg.complete && garageImg.naturalWidth > 0) {
    ctx.drawImage(garageImg, imgX, imgY, drawW, drawH);
  } else {
    ctx.fillStyle = "#37474f";
    ctx.fillRect(imgX, imgY, drawW, drawH);
    ctx.fillStyle = "#90a4ae";
    ctx.font = "15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(fileHint, cx, imgY + drawH / 2);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,213,79,0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
  ctx.setLineDash([]);

  drawGaragePulsingLabel(cx, imgY + drawH * 0.58);

  if (shopUi.garagePhase === "idle" && !shopUi.garageShowResult) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "bold 16px Arial";
    ctx.fillText(cfg.title, cx, zone.y - 12);
    ctx.font = "15px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(`${cfg.dropCount} скинов · нажми`, cx, zone.y + zone.h + 22);
  }
}

function drawGaragePulsingLabel(cx, cy) {
  const pulse = 0.55 + 0.45 * Math.sin(uiTime * 4.2);
  const scale = 0.92 + pulse * 0.1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.shadowColor = `rgba(255,193,7,${0.35 + pulse * 0.45})`;
  ctx.shadowBlur = 18 + pulse * 14;
  ctx.fillStyle = `rgba(255,248,225,${0.88 + pulse * 0.12})`;
  ctx.strokeStyle = `rgba(255,111,0,${0.5 + pulse * 0.35})`;
  ctx.lineWidth = 3;
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = "ПОВЕЗЁТ, ИЛИ НЕТ?";
  const tw = ctx.measureText(label).width + 36;
  const th = 44;
  ctx.fillStyle = "rgba(18,10,32,0.72)";
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.strokeRect(-tw / 2, -th / 2, tw, th);
  ctx.fillStyle = `rgba(255,236,179,${0.92 + pulse * 0.08})`;
  ctx.fillText(label, 0, 2);
  ctx.restore();
}

function drawShopGarage() {
  const garageBg = ctx.createLinearGradient(0, 0, 1200, 700);
  garageBg.addColorStop(0, "#120a1e");
  garageBg.addColorStop(0.45, "#1a0f2e");
  garageBg.addColorStop(1, "#0f172a");
  ctx.fillStyle = garageBg;
  ctx.fillRect(0, 0, 1200, 700);

  for (let i = 0; i < 24; i += 1) {
    const px = (i * 97 + uiTime * 22) % 1240 - 20;
    const py = 80 + (i % 5) * 110;
    ctx.fillStyle = `rgba(255,152,0,${0.04 + (i % 3) * 0.02})`;
    ctx.beginPath();
    ctx.arc(px, py, 3 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  drawShopChrome("Гаражи скинов");

  if (shopUi.garagePhase === "idle" && !shopUi.garageShowResult) {
    drawGaragePanel("normal", shopUi.garageOpenZoneNormal);
    drawGaragePanel("mega", shopUi.garageOpenZoneMega);
  }

  if (shopUi.garagePhase === "darken" || shopUi.garagePhase === "reveal" || shopUi.garageShowResult) {
    const darkenT =
      shopUi.garagePhase === "darken"
        ? Math.min(1, shopUi.garageDarkenElapsed / shopUi.garageDarkenDuration)
        : 1;
    ctx.fillStyle = `rgba(0,0,0,${0.82 * darkenT})`;
    ctx.fillRect(0, 0, 1200, 700);
  }

  if (shopUi.garagePhase === "reveal" || shopUi.garageShowResult) {
    drawGarageDropRow();
  }

  if (shopUi.garageShowResult) {
    const gCfg = GarageSystem.getConfig(shopUi.garageKind);
    drawButton(shopUi.garageOpenAgainButton, `Ещё (${gCfg.price}g)`, "#e65100");
    drawButton(shopUi.garageToHubButton, "В магазин", "#455a64");
  }
}

function drawGarageDropRow() {
  const drops = shopUi.garageDrops;
  if (!drops.length) return;

  const twoRows = drops.length > 5;
  const cols = twoRows ? 5 : drops.length;
  const cardW = twoRows ? 108 : 168;
  const gap = twoRows ? 14 : 22;
  const cardH = twoRows ? 168 : 220;
  const rowGap = twoRows ? 16 : 0;
  const rowW = cols * cardW + (cols - 1) * gap;
  const startX = (1200 - rowW) / 2;
  const baseY = twoRows ? 210 : 248;
  const revealT =
    shopUi.garageShowResult
      ? 1
      : Math.min(1, shopUi.garageRevealElapsed / shopUi.garageRevealDuration);
  const previewR = twoRows ? 30 : 46;
  const nameFs = twoRows ? 10 : 13;

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px Arial";
  ctx.fillText("Твои скины из гаража", 600, twoRows ? 148 : 168);

  for (let i = 0; i < drops.length; i += 1) {
    const entry = drops[i];
    const skin = entry.skin;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const stagger = Math.min(1, Math.max(0, revealT * 1.35 - i * (twoRows ? 0.07 : 0.12)));
    const eased = 1 - Math.pow(1 - stagger, 3);
    const x = startX + col * (cardW + gap);
    const y = baseY + row * (cardH + rowGap) + (1 - eased) * 48;
    const alpha = 0.2 + eased * 0.8;

    ctx.save();
    ctx.globalAlpha = alpha;
    const style = getRarityVisual(skin.rarity);
    ctx.fillStyle = "rgba(12,18,32,0.94)";
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, cardW, cardH);

    const cy = y + (twoRows ? 52 : 72);
    SkinSystem.drawSkinInCircle(ctx, skin, x + cardW / 2, cy, previewR);
    ctx.beginPath();
    ctx.arc(x + cardW / 2, cy, previewR, 0, Math.PI * 2);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${nameFs}px Arial`;
    ctx.fillText(skin.name, x + cardW / 2, y + (twoRows ? 98 : 138), cardW - 8);
    drawRarityBadge(
      x + (twoRows ? 8 : 14),
      y + (twoRows ? 108 : 152),
      cardW - (twoRows ? 16 : 28),
      twoRows ? 20 : 24,
      skin.rarity,
    );
    if (entry.isDuplicate) {
      ctx.fillStyle = "rgba(255,213,79,0.9)";
      ctx.font = twoRows ? "9px Arial" : "11px Arial";
      ctx.fillText("дубликат", x + cardW / 2, y + cardH - 14);
    }
    ctx.restore();
  }
}

function drawShopCases() {
  drawShopHeader("Кейсы");

  if (!shopUi.isSpinning && !shopUi.showResultPanel) {
    drawCaseCard(shopUi.basicButton, {
      title: "BASIC CASE",
      subtitle: "Обычные одноцветные скины",
      price: "100 Gold",
      color: shopUi.isSpinning ? "#4a6353" : "#1f7a42",
    });
    drawCaseCard(shopUi.premiumButton, {
      title: "PREMIUM CASE",
      subtitle: "Только красивые разноцветные скины",
      price: "500 Gold",
      color: shopUi.isSpinning ? "#5a4f70" : "#8a5cff",
    });
    drawCaseCard(shopUi.vipButton, {
      title: "VIP CASE",
      subtitle: "Раскраски мяча и ворот",
      price: "300 Gold",
      color: shopUi.isSpinning ? "#6d5a20" : "#c9a227",
    });
  }

  if (shopUi.isSpinning) {
    drawCaseRoulette();
    drawButton(shopUi.skipButton, "Пропустить", "#455a64");
  } else if (shopUi.showResultPanel) {
    drawCaseDropResult();
  } else if (!useLowEffects()) {
    drawCaseDropOddsPanel("basic", { x: 12, y: 488, w: 384, h: 200 });
    drawCaseDropOddsPanel("premium", { x: 408, y: 488, w: 384, h: 200 });
    drawCaseDropOddsPanel("vip", { x: 804, y: 488, w: 384, h: 200 });
  }
}

function drawShopWheel() {
  const snapshot = FortuneWheelSystem.getSnapshot();
  drawShopHeader("Колесо фортуны", {
    fortuneTokens: snapshot.tokens,
    fortuneRefreshLabel: snapshot.refreshLabel,
  });
  drawFortuneWheelScreen(ctx, {
    shopUi,
    snapshot,
    uiTime,
    drawButton,
    drawRarityBadge,
    getRarityVisual,
    panelTop: 128,
  });
}

function drawShopUi() {
  if (shopUi.mode === "hub") {
    drawShopHub();
  } else if (shopUi.mode === "garage") {
    drawShopGarage();
  } else if (shopUi.mode === "wheel") {
    drawShopWheel();
  } else {
    drawShopCases();
  }

  if (shopUi.resultTimer > 0 && shopUi.resultText) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(180, 640, 840, 42);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 22px Arial";
    ctx.fillText(shopUi.resultText, 600, 661);
  }
}

function drawTopDropSuperEffect(cx, cy, revealT) {
  const pulse = 0.5 + 0.5 * Math.sin(uiTime * 5);
  const burst = Math.min(1, revealT * 4);

  const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
  flash.addColorStop(0, `rgba(0,230,118,${0.45 * burst * (0.6 + 0.4 * pulse)})`);
  flash.addColorStop(0.35, `rgba(0,200,83,${0.22 * burst})`);
  flash.addColorStop(1, "rgba(0,230,118,0)");
  ctx.fillStyle = flash;
  ctx.fillRect(0, 0, 1200, 700);

  for (let ring = 0; ring < 4; ring += 1) {
    const phase = (revealT * 1.2 + ring * 0.18 + uiTime * 0.35) % 1;
    const radius = 95 + ring * 55 + phase * 90;
    const alpha = (1 - phase) * 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(105,240,174,${alpha})`;
    ctx.lineWidth = 3 + ring;
    ctx.stroke();
  }

  const rayCount = 20;
  for (let i = 0; i < rayCount; i += 1) {
    const angle = (i / rayCount) * Math.PI * 2 + uiTime * 1.2;
    const len = 120 + 180 * burst + 40 * Math.sin(uiTime * 6 + i);
    ctx.strokeStyle = `rgba(178,255,218,${0.15 + 0.25 * burst})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 96, cy + Math.sin(angle) * 96);
    ctx.lineTo(cx + Math.cos(angle) * (96 + len), cy + Math.sin(angle) * (96 + len));
    ctx.stroke();
  }

  for (let s = 0; s < 48; s += 1) {
    const a = (s * 2.17 + uiTime * 3) % (Math.PI * 2);
    const dist = 140 + (s % 7) * 38 + 30 * Math.sin(uiTime * 4 + s);
    const sx = cx + Math.cos(a) * dist;
    const sy = cy + Math.sin(a) * dist;
    const sz = 2 + (s % 4);
    ctx.fillStyle = `rgba(200,255,220,${0.25 + 0.5 * pulse})`;
    ctx.fillRect(sx, sy, sz, sz);
  }
}

function drawCaseDropResult() {
  if (!shopUi.result) return;
  const result = shopUi.result;
  const rarityStyle = getRarityVisual(result.skin.rarity);
  const isTop = String(result.skin.rarity || "").toLowerCase() === "top";
  const t = Math.min(1, shopUi.revealTime / 0.7);
  const eased = 1 - Math.pow(1 - t, 3);

  ctx.fillStyle = "rgba(6,10,20,0.72)";
  ctx.fillRect(0, 0, 1200, 700);

  if (isTop) {
    drawTopDropSuperEffect(600, 336, shopUi.revealTime);
  }

  const panelX = 320;
  const panelY = 170;
  const panelW = 560;
  const panelH = 460;
  ctx.save();
  ctx.globalAlpha = 0.25 + eased * 0.75;
  ctx.fillStyle = isTop ? "rgba(8,28,18,0.92)" : "rgba(16,25,40,0.94)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = isTop ? `rgba(0,230,118,${0.45 + 0.35 * Math.sin(uiTime * 4)})` : "rgba(255,255,255,0.24)";
  ctx.lineWidth = isTop ? 3 : 2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  ctx.restore();

  const scale = 0.74 + 0.26 * eased;
  ctx.save();
  ctx.translate(600, 336);
  ctx.scale(scale, scale);
  if (isTop) {
    const halo = ctx.createRadialGradient(0, 0, 40, 0, 0, 120);
    halo.addColorStop(0, "rgba(105,240,174,0.45)");
    halo.addColorStop(0.5, "rgba(0,200,83,0.15)");
    halo.addColorStop(1, "rgba(0,230,118,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.fill();
  }
  SkinSystem.drawSkinInCircle(ctx, result.skin, 0, 0, 86);
  ctx.beginPath();
  ctx.arc(0, 0, 86, 0, Math.PI * 2);
  ctx.strokeStyle = rarityStyle.color;
  ctx.lineWidth = isTop ? 5 : 4;
  ctx.stroke();
  if (isTop) {
    ctx.strokeStyle = `rgba(178,255,218,${0.35 + 0.4 * Math.sin(uiTime * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 96 + 4 * Math.sin(uiTime * 5), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Arial";
  if (isTop) {
    ctx.shadowColor = "rgba(105,240,174,0.9)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#e8fff0";
    ctx.fillText("TOP ВЫПАДЕНИЕ!", 600, 218);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(200,255,220,0.95)";
    ctx.font = "bold 26px Arial";
    ctx.fillText("Ты выбил редчайший скин!", 600, 258);
    ctx.font = "bold 30px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(result.skin.name, 600, 455);
  } else {
    ctx.fillText("Выпал скин!", 600, 225);
    ctx.font = "bold 30px Arial";
    ctx.fillText(result.skin.name, 600, 455);
  }

  drawRarityBadge(530, 475, 140, 28, result.skin.rarity);

  drawButton(
    shopUi.openMoreButton,
    `Открыть ещё (${(shopUi.lastCaseType || "basic").toUpperCase()})`,
    "#2e7d32"
  );
  drawButton(shopUi.menuButton, "В меню", "#455a64");
}

function drawCaseCard(rect, data) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grad.addColorStop(0, data.color);
  grad.addColorStop(1, "#1e293b");
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Arial";
  ctx.fillText(data.title, rect.x + rect.w / 2, rect.y + 96);
  ctx.font = "22px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(data.subtitle, rect.x + rect.w / 2, rect.y + 170);
  ctx.font = "bold 36px Arial";
  ctx.fillStyle = "#ffe082";
  ctx.fillText(data.price, rect.x + rect.w / 2, rect.y + 292);
}

function drawCaseRoulette() {
  const frameX = 160;
  const frameY = 230;
  const frameW = 880;
  const frameH = 170;
  const itemW = 130;
  const gap = 12;
  const step = itemW + gap;
  const centerX = frameX + frameW / 2;

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(frameX, frameY, frameW, frameH);
  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.lineWidth = 2;
  ctx.strokeRect(frameX, frameY, frameW, frameH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(frameX, frameY, frameW, frameH);
  ctx.clip();

  let currentOffset = 0;
  if (shopUi.isSpinning) {
    const t = Math.min(1, shopUi.spinElapsed / shopUi.spinDuration);
    const eased = 1 - Math.pow(1 - t, 3);
    currentOffset = eased * shopUi.targetOffset;
  } else if (shopUi.result) {
    currentOffset = shopUi.targetOffset;
  }

  const startX = centerX - itemW / 2 - currentOffset;
  const renderStrip = shopUi.strip.length > 0 ? shopUi.strip : SkinSystem.getAllSkins();

  for (let i = 0; i < renderStrip.length; i += 1) {
    const skin = renderStrip[i];
    const x = startX + i * step;
    const y = frameY + 20;
    if (x + itemW < frameX || x > frameX + frameW) continue;

    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fillRect(x, y, itemW, 130);
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, itemW, 130);

    SkinSystem.drawSkinInCircle(ctx, skin, x + itemW / 2, y + 46, 20);
    ctx.beginPath();
    ctx.arc(x + itemW / 2, y + 46, 20, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.fillText(skin.name, x + itemW / 2, y + 88);
    drawRarityBadge(x + 14, y + 98, itemW - 28, 24, skin.rarity);
  }

  ctx.restore();

  ctx.fillStyle = "#ffe082";
  ctx.beginPath();
  ctx.moveTo(centerX, frameY - 8);
  ctx.lineTo(centerX - 12, frameY + 14);
  ctx.lineTo(centerX + 12, frameY + 14);
  ctx.closePath();
  ctx.fill();

  if (shopUi.isSpinning) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Открытие кейса...", 600, 432);
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "18px Arial";
    ctx.fillText("Нажми Basic или Premium для открытия", 600, 432);
  }
}

function drawPaintSkinUi() {
  ensurePaintSkinBuffer();
  clampPaintStudioSlot();
  const msg = paintStudio.messageTimer > 0 ? paintStudio.message : "";
  const slotTotal = StorageSystem.getPaintSlotTotal();
  drawPaintSkinStudio(ctx, {
    coins: CurrencySystem.getCoins(),
    gold: CurrencySystem.getGold(),
    slotIndex: paintStudio.selectedSlot,
    slotTotal,
    canBuyMoreSlots: slotTotal < MAX_PAINT_SLOTS,
    extraSlotGoldPrice: EXTRA_PAINT_SLOT_GOLD_PRICE,
    brushColor: paintStudio.brushColor,
    eraserMode: paintStudio.eraser,
    message: msg,
    painterCanvas: paintSkinBuffer.canvas,
  });
}

function drawInventoryPageGrid(pageIndex, offsetX, activeSkin) {
  const totalPages = getInventoryTotalPages();
  const page = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const cols = 4;
  const invCardS = isNativeMobileApp() ? Math.min(1.22, 1 + (getUiButtonScale() - 1) * 0.45) : 1;
  const cardW = Math.round(250 * invCardS);
  const cardH = Math.round(110 * invCardS);
  const gapX = Math.round(30 * invCardS);
  const gapY = Math.round(24 * invCardS);
  const gridW = cols * cardW + (cols - 1) * gapX;
  const startX = Math.round((1200 - gridW) / 2);
  const startY = 190;
  const pageStart = page * inventoryUi.pageSize;
  const pageSkins = ownedSkins.slice(pageStart, pageStart + inventoryUi.pageSize);
  const slideFade = Math.min(1, Math.abs(offsetX) / 380);

  ctx.save();
  ctx.translate(offsetX, 0);
  ctx.globalAlpha = 1 - slideFade * 0.22;

  pageSkins.forEach((skin, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const isEquipped = SkinSystem.isEquipped(skin);
    const isSelected = inventoryUi.selectedSkinId === skin.id;
    const sellPrice = SkinSellSystem.getSellPrice(skin);
    const equipSlot = SkinSystem.getEquipSlot(skin);

    const rarityStyle = getRarityVisual(skin.rarity);
    ctx.fillStyle = isSelected
      ? "rgba(255,213,79,0.22)"
      : isEquipped
        ? "rgba(79,195,247,0.25)"
        : "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = isSelected ? "#ffd54f" : isEquipped ? "#4fc3f7" : rarityStyle.color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.strokeRect(x, y, cardW, cardH);

    const previewR = Math.round(18 * invCardS);
    SkinSystem.drawSkinInCircle(ctx, skin, x + Math.round(32 * invCardS), y + cardH / 2, previewR);
    ctx.beginPath();
    ctx.arc(x + Math.round(32 * invCardS), y + cardH / 2, previewR, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    if (equipSlot === "ball" || equipSlot === "goal") {
      ctx.font = `bold ${Math.round(11 * invCardS)}px Arial`;
      ctx.textAlign = "left";
      ctx.fillStyle = equipSlot === "ball" ? "#80deea" : "#ce93d8";
      ctx.fillText(equipSlot === "ball" ? "Мяч" : "Ворота", x + Math.round(8 * invCardS), y + Math.round(14 * invCardS));
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    const nameFs = Math.round(20 * invCardS);
    ctx.font = `bold ${nameFs}px Arial`;
    ctx.fillText(skin.name, x + Math.round(60 * invCardS), y + Math.round(44 * invCardS));
    drawRarityBadge(x + Math.round(60 * invCardS), y + Math.round(58 * invCardS), Math.round(130 * invCardS), Math.round(24 * invCardS), skin.rarity);
    if (sellPrice !== null) {
      ctx.font = `${Math.round(14 * invCardS)}px Arial`;
      ctx.fillStyle = "#ffe082";
      ctx.fillText(`Продажа: ${sellPrice}g`, x + Math.round(60 * invCardS), y + Math.round(88 * invCardS));
    }

    const isCurrentPage = pageIndex === inventoryUi.page;
    const allowHits =
      (inventoryPageAnim.phase === "idle" && isCurrentPage) ||
      (inventoryPageAnim.phase === "drag" && isCurrentPage);
    if (allowHits) {
      inventoryUi.slots.push({ rect: { x: x + offsetX, y, w: cardW, h: cardH }, skin });
    }
  });

  ctx.restore();
}

function drawInventoryUi() {
  refreshOwnedSkins();

  const bg = ctx.createLinearGradient(0, 0, 0, 700);
  bg.addColorStop(0, "#0e1a2a");
  bg.addColorStop(1, "#102027");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 44px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Инвентарь", 600, 90);
  drawButton(inventoryUi.backButton, "Назад", "#455a64");
  drawButton(inventoryUi.shopButton, "Магазин", "#7e57c2");
  ctx.textAlign = "left";
  ctx.font = "600 17px Arial";
  ctx.fillStyle = "#cfd8dc";
  ctx.fillText(`Коины: ${CurrencySystem.getCoins()}`, 160, 38);
  ctx.fillStyle = "#ffe082";
  ctx.fillText(`Gold: ${CurrencySystem.getGold()}`, 160, 62);

  const activeSkin = SkinSystem.getActiveSkin();
  const ballCos = SkinSystem.getActiveBallCosmetic();
  const goalCos = SkinSystem.getActiveGoalCosmetic();
  ctx.textAlign = "center";
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = "#cfd8dc";
  ctx.fillText(`Игрок: ${activeSkin.name}`, 600, 128);
  ctx.font = "15px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  const ballLabel = ballCos ? ballCos.name : "стандарт";
  const goalLabel = goalCos ? goalCos.name : "стандарт";
  ctx.fillText(`Мяч: ${ballLabel}  ·  Ворота: ${goalLabel}`, 600, 152);

  const totalPages = getInventoryTotalPages();
  inventoryUi.page = Math.max(0, Math.min(inventoryUi.page, totalPages - 1));
  inventoryUi.slots = [];

  const slideOffset = getInventorySlideOffset();
  const curPage = inventoryUi.page;
  const nextPage = (curPage + 1) % totalPages;
  const prevPage = (curPage - 1 + totalPages) % totalPages;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 175, 1200, 290);
  ctx.clip();

  if (inventoryPageAnim.phase === "animate") {
    const fromP = inventoryPageAnim.fromPage;
    const toP = inventoryPageAnim.toPage;
    drawInventoryPageGrid(fromP, slideOffset, activeSkin);
    drawInventoryPageGrid(toP, slideOffset + (inventoryPageAnim.endOffset < 0 ? 1200 : -1200), activeSkin);
  } else if (inventoryPageAnim.phase === "drag" && Math.abs(slideOffset) > 0.5) {
    drawInventoryPageGrid(curPage, slideOffset, activeSkin);
    if (slideOffset < 0) drawInventoryPageGrid(nextPage, slideOffset + 1200, activeSkin);
    if (slideOffset > 0) drawInventoryPageGrid(prevPage, slideOffset - 1200, activeSkin);
  } else {
    drawInventoryPageGrid(curPage, 0, activeSkin);
  }
  ctx.restore();

  if (inventoryUi.selectedSkinId) {
    const sel = SkinSystem.getSkinById(inventoryUi.selectedSkinId);
    const sellPrice = SkinSellSystem.getSellPrice(sel);
    const slot = SkinSystem.getEquipSlot(sel);
    const equipLabel = slot === "ball" ? "На мяч" : slot === "goal" ? "На ворота" : "Надеть";
    drawButton(inventoryUi.equipButton, equipLabel, "#1565c0");
    if (sellPrice !== null) {
      drawButton(inventoryUi.sellButton, `Продать за ${sellPrice} gold`, "#c62828");
    } else {
      drawButton(inventoryUi.sellButton, "Нельзя продать", "#546e7a");
    }
    ctx.textAlign = "center";
    ctx.font = "17px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(`Выбран: ${sel.name}`, 600, 598);
  } else {
    ctx.textAlign = "center";
    ctx.font = "17px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("Нажми на предмет, чтобы выбрать", 600, 632);
  }

  if (inventoryToast.timer > 0 && inventoryToast.text) {
    ctx.textAlign = "center";
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#a5d6a7";
    ctx.fillText(inventoryToast.text, 600, 688);
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 20px Arial";
  ctx.fillText(`Страница ${inventoryUi.page + 1} / ${totalPages}`, 600, 652);
  if (totalPages > 1) {
    const dotsY = 672;
    const dotGap = 18;
    const dotsW = (totalPages - 1) * dotGap;
    for (let i = 0; i < totalPages; i += 1) {
      const dx = 600 - dotsW / 2 + i * dotGap;
      ctx.beginPath();
      ctx.arc(dx, dotsY, i === inventoryUi.page ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = i === inventoryUi.page ? "#ffd54f" : "rgba(255,255,255,0.35)";
      ctx.fill();
    }
    ctx.font = "15px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Свайп — листать страницы", 600, 694);
  }
}

function drawAchievementsTabContent(achSnap) {
  const colGap = 16;
  const leftX = 56;
  const colW = (REFERENCE_WIDTH - leftX * 2 - colGap) / 2;
  const rightX = leftX + colW + colGap;
  const rowH = 46;
  const rowGap = 7;
  const gridTop = 128;

  const drawAchRow = (row, x, y, w, h) => {
    ctx.fillStyle = "rgba(30,20,55,0.78)";
    ctx.strokeStyle = "rgba(167,139,250,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();

    const innerPad = 10;
    const btnW = 108;
    const btnH = 30;
    const btnX = x + w - innerPad - btnW;
    const btnY = y + (h - btnH) / 2;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 13px Arial";
    let title = row.title;
    const titleMax = w - btnW - 95;
    while (ctx.measureText(title).width > titleMax && title.length > 3) title = `${title.slice(0, -2)}…`;
    ctx.fillText(title, x + innerPad, y + h * 0.38);

    ctx.font = "11px Arial";
    ctx.fillStyle = "rgba(186,198,216,0.92)";
    let desc = row.description;
    const descMax = w - btnW - 28;
    while (ctx.measureText(desc).width > descMax && desc.length > 6) desc = `${desc.slice(0, -2)}…`;
    ctx.fillText(desc, x + innerPad, y + h * 0.68);

    const barX = x + innerPad;
    const barY = y + h - 7;
    const barW = w - innerPad * 2 - btnW - 8;
    const frac = row.target > 0 ? Math.min(1, row.current / row.target) : 0;
    ctx.fillStyle = "rgba(30,41,59,0.95)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 5, 3);
    ctx.fill();
    const fillGrd = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fillGrd.addColorStop(0, "#7c3aed");
    fillGrd.addColorStop(1, "#a78bfa");
    ctx.fillStyle = fillGrd;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(4, barW * frac), 5, 3);
    ctx.fill();

    ctx.textAlign = "center";
    ctx.font = "600 11px Arial";
    ctx.fillStyle = "rgba(224,231,255,0.95)";
    ctx.fillText(`${row.current}/${row.target}`, barX + barW * 0.5, barY - 8);

    const rx = btnX - 72;
    ctx.textAlign = "left";
    ctx.font = "600 10px Arial";
    let ry = y + h * 0.3;
    if (row.rewardCoins > 0) {
      ctx.fillStyle = "#fde047";
      ctx.fillText(`+${row.rewardCoins} коин`, rx, ry);
      ry += 12;
    }
    if (row.rewardGold > 0) {
      ctx.fillStyle = "#fcd34d";
      ctx.fillText(`+${row.rewardGold} gold`, rx, ry);
    }

    let btnColor = "#37474f";
    let btnLabel = "В пути";
    if (row.claimed) {
      btnLabel = "Готово";
      btnColor = "#1b5e20";
    } else if (row.canClaim) {
      btnLabel = "Забрать";
      btnColor = "#7c3aed";
    }
    drawButton({ x: btnX, y: btnY, w: btnW, h: btnH }, btnLabel, btnColor);
    if (row.canClaim) {
      questsUi.claimHits.push({ id: row.id, kind: "achievement", x: btnX, y: btnY, w: btnW, h: btnH });
    }
  };

  const leftRows = achSnap.rows.filter((_, i) => i % 2 === 0);
  const rightRows = achSnap.rows.filter((_, i) => i % 2 === 1);
  let yL = gridTop;
  for (const row of leftRows) {
    drawAchRow(row, leftX, yL, colW, rowH);
    yL += rowH + rowGap;
  }
  let yR = gridTop;
  for (const row of rightRows) {
    drawAchRow(row, rightX, yR, colW, rowH);
    yR += rowH + rowGap;
  }
}

function drawQuestsToastBar() {
  if (questsToast.timer <= 0) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.beginPath();
  ctx.roundRect(300, 648, 600, 44, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(34,211,238,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "600 16px Arial";
  ctx.fillText(questsToast.text, 600, 670);
}

function drawWeeklyTabContent(weeklySnap) {
  const row = weeklySnap.row;
  const x = 72;
  const y = 150;
  const w = REFERENCE_WIDTH - 144;
  const h = 120;
  ctx.fillStyle = "rgba(20,35,55,0.85)";
  ctx.strokeStyle = "rgba(56,189,248,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 22px Arial";
  ctx.fillText(row.title, x + 20, y + 32);
  ctx.font = "15px Arial";
  ctx.fillStyle = "rgba(203,213,225,0.92)";
  ctx.fillText(row.description, x + 20, y + 58);
  ctx.font = "600 14px Arial";
  ctx.fillStyle = "rgba(148,163,184,0.9)";
  ctx.fillText(`Неделя с ${weeklySnap.weekKey}  ·  сброс в понедельник`, x + 20, y + 82);

  const barX = x + 20;
  const barY = y + h - 28;
  const barW = w - 200;
  const frac = row.target > 0 ? Math.min(1, row.current / row.target) : 0;
  ctx.fillStyle = "rgba(30,41,59,0.95)";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, 8, 4);
  ctx.fill();
  const wg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  wg.addColorStop(0, "#0284c7");
  wg.addColorStop(1, "#38bdf8");
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.roundRect(barX, barY, Math.max(6, barW * frac), 8, 4);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "600 14px Arial";
  ctx.fillText(`${row.current} / ${row.target}`, barX + barW / 2, barY - 10);

  ctx.textAlign = "left";
  ctx.font = "600 13px Arial";
  ctx.fillStyle = "#fde047";
  ctx.fillText(`+${row.rewardCoins} коин`, x + w - 170, y + 36);
  ctx.fillStyle = "#fcd34d";
  ctx.fillText(`+${row.rewardGold} gold`, x + w - 170, y + 54);

  const btnW = 140;
  const btnH = 40;
  const btnX = x + w - btnW - 18;
  const btnY = y + h - btnH - 18;
  let btnLabel = "В процессе";
  let btnColor = "#455a64";
  if (row.claimed) {
    btnLabel = "Готово";
    btnColor = "#1b5e20";
  } else if (row.canClaim) {
    btnLabel = "Забрать";
    btnColor = "#0284c7";
  }
  drawButton({ x: btnX, y: btnY, w: btnW, h: btnH }, btnLabel, btnColor);
  if (row.canClaim) {
    questsUi.claimHits.push({ kind: "weekly", x: btnX, y: btnY, w: btnW, h: btnH });
  }
}

function drawCalendarTabContent(calSnap) {
  const startX = 64;
  const cellW = 148;
  const cellH = 200;
  const gap = 10;
  const topY = 138;

  ctx.textAlign = "center";
  ctx.font = "600 14px Arial";
  ctx.fillStyle = "rgba(148,163,184,0.9)";
  ctx.fillText("Заходи каждый день подряд. Пропустил день — серия с начала.", 600, 118);

  calSnap.days.forEach((day, i) => {
    const x = startX + i * (cellW + gap);
    const y = topY;
    const active = day.status === "active";
    const done = day.status === "done";

    ctx.fillStyle = active
      ? "rgba(34,197,94,0.18)"
      : done
        ? "rgba(30,41,59,0.75)"
        : "rgba(15,23,42,0.65)";
    ctx.strokeStyle = active
      ? "rgba(74,222,128,0.7)"
      : done
        ? "rgba(100,116,139,0.35)"
        : "rgba(71,85,105,0.3)";
    ctx.lineWidth = active ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = active ? "#bbf7d0" : done ? "#94a3b8" : "#64748b";
    ctx.font = "bold 18px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(`День ${day.day}`, x + cellW / 2, y + 28);

    if (day.day === 7) {
      ctx.font = "bold 13px Arial";
      ctx.fillStyle = "#fde047";
      ctx.fillText("ГЛАВНЫЙ", x + cellW / 2, y + 48);
      ctx.fillText("ПРИЗ", x + cellW / 2, y + 64);
    }

    ctx.font = "600 13px Arial";
    ctx.fillStyle = "#fcd34d";
    ctx.fillText(`+${day.gold} g`, x + cellW / 2, y + 100);
    ctx.fillStyle = "#fde047";
    ctx.fillText(`+${day.coins} коин`, x + cellW / 2, y + 120);

    if (done) {
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 28px Arial";
      ctx.fillText("✓", x + cellW / 2, y + 158);
    } else if (active && calSnap.canClaimToday) {
      ctx.fillStyle = "#86efac";
      ctx.font = "bold 14px Arial";
      ctx.fillText("Сегодня!", x + cellW / 2, y + 158);
    }
  });

  if (calSnap.canClaimToday) {
    const bx = 420;
    const by = 360;
    const bw = 360;
    const bh = 52;
    drawButton({ x: bx, y: by, w: bw, h: bh }, `Забрать день ${calSnap.streakDay}`, "#16a34a");
    questsUi.claimHits.push({ kind: "calendar", x: bx, y: by, w: bw, h: bh });
  } else if (calSnap.claimedToday) {
    ctx.fillStyle = "rgba(148,163,184,0.85)";
    ctx.font = "600 16px Arial";
    ctx.fillText("Награда за сегодня уже получена. Заходи завтра!", 600, 386);
  }
}

function drawQuestsUi() {
  const vignette = ctx.createRadialGradient(600, 120, 40, 600, 350, 620);
  vignette.addColorStop(0, "rgba(56,189,248,0.14)");
  vignette.addColorStop(0.45, "rgba(15,23,42,0)");
  vignette.addColorStop(1, "rgba(7,11,20,0.92)");
  ctx.fillStyle = "#070b14";
  ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);

  drawButton(questsUi.backButton, "← Меню", "#263238");

  ctx.save();
  ctx.strokeStyle = "rgba(251,191,36,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(44, 62, REFERENCE_WIDTH - 88, 598, 22);
  ctx.stroke();
  ctx.restore();

  const tab = questsUi.activeTab;
  const snap = DailyQuestSystem.getSnapshot();
  const achSnap = AchievementSystem.getSnapshot();
  const weeklySnap = WeeklyQuestSystem.getSnapshot();
  const calSnap = RewardCalendarSystem.getSnapshot();

  const titles = {
    daily: "Квесты",
    achievements: "Ачивки",
    weekly: "Неделя",
    calendar: "Календарь",
  };

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 36px Arial";
  ctx.fillText(titles[tab] || "Квесты", 600, 42);
  ctx.font = "600 13px Arial";
  ctx.fillStyle = "rgba(148,163,184,0.95)";
  if (tab === "daily") {
    ctx.fillText(`Сегодня: ${snap.dateKey}  ·  обновление в полночь`, 600, 72);
  } else if (tab === "achievements") {
    ctx.fillText(`Выполнено: ${achSnap.unlocked}/${achSnap.total}  ·  забрано: ${achSnap.claimed}`, 600, 72);
  } else if (tab === "weekly") {
    ctx.fillText(`Задание недели  ·  сброс в понедельник`, 600, 72);
  } else {
    ctx.fillText(`Серия: день ${calSnap.streakDay} из 7  ·  не пропускай дни`, 600, 72);
  }

  const drawTab = (rect, label, active, accent) => {
    ctx.fillStyle = active ? accent.fill : "rgba(30,41,59,0.88)";
    ctx.strokeStyle = active ? accent.stroke : "rgba(100,116,139,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = active ? accent.text : "rgba(148,163,184,0.9)";
    ctx.font = active ? "bold 14px Arial" : "600 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  };
  drawTab(questsUi.tabDaily, "Ежедневные", tab === "daily", {
    fill: "rgba(249,115,22,0.22)",
    stroke: "rgba(251,146,60,0.85)",
    text: "#ffedd5",
  });
  drawTab(questsUi.tabAchievements, "Ачивки", tab === "achievements", {
    fill: "rgba(124,58,237,0.28)",
    stroke: "rgba(167,139,250,0.85)",
    text: "#ede9fe",
  });
  drawTab(questsUi.tabWeekly, "Неделя", tab === "weekly", {
    fill: "rgba(2,132,199,0.22)",
    stroke: "rgba(56,189,248,0.85)",
    text: "#e0f2fe",
  });
  drawTab(questsUi.tabCalendar, "Календарь", tab === "calendar", {
    fill: "rgba(22,163,74,0.22)",
    stroke: "rgba(74,222,128,0.85)",
    text: "#dcfce7",
  });

  questsUi.claimHits = [];

  if (tab === "achievements") {
    drawAchievementsTabContent(achSnap);
    drawQuestsToastBar();
    return;
  }
  if (tab === "weekly") {
    drawWeeklyTabContent(weeklySnap);
    drawQuestsToastBar();
    return;
  }
  if (tab === "calendar") {
    drawCalendarTabContent(calSnap);
    drawQuestsToastBar();
    return;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(226,232,240,0.9)";
  ctx.font = "bold 14px Arial";
  ctx.fillText("Ежедневные задания", 64, 118);

  const colGap = 16;
  const leftX = 56;
  const colW = (REFERENCE_WIDTH - leftX * 2 - colGap) / 2;
  const rightX = leftX + colW + colGap;
  const rowH = 46;
  const rowGap = 7;
  const gridTop = 128;

  const drawOneRow = (row, x, y, w, h, opts) => {
    const chain = Boolean(opts?.chain);
    ctx.fillStyle = chain ? "rgba(49,32,72,0.78)" : "rgba(15,23,42,0.78)";
    ctx.strokeStyle = chain ? "rgba(251,191,36,0.5)" : "rgba(71,85,105,0.35)";
    ctx.lineWidth = chain ? 2 : 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();

    const innerPad = 10;
    const btnW = 108;
    const btnH = 30;
    const btnX = x + w - innerPad - btnW;
    const btnY = y + (h - btnH) / 2;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 13px Arial";
    const titleMax = chain ? w - btnW - 100 : w - btnW - 95;
    let title = row.title;
    ctx.font = "bold 13px Arial";
    while (ctx.measureText(title).width > titleMax && title.length > 3) title = `${title.slice(0, -2)}…`;
    ctx.fillText(title, x + innerPad, y + h * 0.38);

    ctx.font = "11px Arial";
    ctx.fillStyle = "rgba(186,198,216,0.92)";
    let desc = row.description;
    const descMax = w - btnW - 28;
    while (ctx.measureText(desc).width > descMax && desc.length > 6) desc = `${desc.slice(0, -2)}…`;
    ctx.fillText(desc, x + innerPad, y + h * 0.68);

    const barX = x + innerPad;
    const barY = y + h - 7;
    const barW = w - innerPad * 2 - btnW - 8;
    const frac = row.target > 0 ? Math.min(1, row.current / row.target) : 0;
    ctx.fillStyle = "rgba(30,41,59,0.95)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 5, 3);
    ctx.fill();
    const fillGrd = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    if (chain) {
      fillGrd.addColorStop(0, "#f59e0b");
      fillGrd.addColorStop(1, "#fbbf24");
    } else {
      fillGrd.addColorStop(0, "#0ea5e9");
      fillGrd.addColorStop(1, "#38bdf8");
    }
    ctx.fillStyle = fillGrd;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(4, barW * frac), 5, 3);
    ctx.fill();

    ctx.textAlign = "center";
    ctx.font = "600 11px Arial";
    ctx.fillStyle = "rgba(224,231,255,0.95)";
    ctx.fillText(`${row.current}/${row.target}`, barX + barW * 0.5, barY - 8);

    const rx = btnX - 72;
    ctx.textAlign = "left";
    ctx.font = "600 10px Arial";
    let ry = y + h * 0.3;
    if (row.rewardCoins > 0) {
      ctx.fillStyle = "#fde047";
      ctx.fillText(`+${row.rewardCoins} коин`, rx, ry);
      ry += 12;
    }
    if (row.rewardGold > 0) {
      ctx.fillStyle = "#fcd34d";
      ctx.fillText(`+${row.rewardGold} gold`, rx, ry);
    }

    let btnColor = "#37474f";
    let btnLabel = "Ждём";
    if (row.claimed) {
      btnLabel = "Готово";
      btnColor = "#1b5e20";
    } else if (row.canClaim) {
      btnLabel = "Забрать";
      btnColor = "#e65100";
    } else if (!row.done) {
      btnLabel = "Играй";
    }
    drawButton({ x: btnX, y: btnY, w: btnW, h: btnH }, btnLabel, btnColor);
    if (row.canClaim) {
      questsUi.claimHits.push({ id: row.id, kind: "quest", x: btnX, y: btnY, w: btnW, h: btnH });
    }
  };

  const leftRows = snap.rows.filter((_, i) => i % 2 === 0);
  const rightRows = snap.rows.filter((_, i) => i % 2 === 1);
  let yL = gridTop;
  for (const row of leftRows) {
    drawOneRow(row, leftX, yL, colW, rowH, {});
    yL += rowH + rowGap;
  }
  let yR = gridTop;
  for (const row of rightRows) {
    drawOneRow(row, rightX, yR, colW, rowH, {});
    yR += rowH + rowGap;
  }

  let belowY = Math.max(yL, yR) + 10;
  if (snap.chainRow) {
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(254,243,199,0.95)";
    ctx.font = "bold 14px Arial";
    ctx.fillText("Цепочка наград", 64, belowY - 2);
    ctx.font = "11px Arial";
    ctx.fillStyle = "rgba(209,213,219,0.85)";
    ctx.fillText(
      `Шаг ${snap.chainRow.chainStep} из ${snap.chainRow.chainTotal} · открывается после первого «Забрать», дальше — сложнее`,
      220,
      belowY - 2,
    );
    const chY = belowY + 10;
    const chH = 56;
    drawOneRow(snap.chainRow, leftX, chY, REFERENCE_WIDTH - leftX * 2, chH, { chain: true });
    belowY = chY + chH + 8;
  } else if (snap.chainDone) {
    ctx.textAlign = "center";
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgba(148,163,184,0.75)";
    ctx.fillText("Все шаги цепочки на сегодня забраны. Завтра будет новая серия.", 600, belowY + 16);
  } else if (!snap.chainStarted) {
    ctx.textAlign = "center";
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgba(148,163,184,0.75)";
    ctx.fillText("Забери любую ежедневную награду — появится особый бонус-квест.", 600, belowY + 16);
  }

  drawQuestsToastBar();
}

function drawMatchLiveUi() {
  if (!match || match.isFinished) return;

  const hb = matchLiveUi.homeButton;
  ctx.fillStyle = "rgba(15,23,42,0.88)";
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(hb.x, hb.y, hb.w, hb.h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⌂", hb.x + hb.w / 2, hb.y + hb.h / 2 + 1);

  const f = matchLiveUi.forfeit;
  if (!f.active) return;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);

  const px = 280;
  const py = 210;
  const pw = 640;
  const ph = 200;
  ctx.fillStyle = "rgba(12,18,30,0.96)";
  ctx.strokeStyle = "rgba(255,82,82,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial";
  ctx.fillText("Выйти из матча?", 600, py + 48);
  ctx.font = "600 18px Arial";
  ctx.fillStyle = "rgba(226,232,240,0.92)";
  if (match?.isTournament) {
    ctx.fillText("Вы вылетите из турнира.", 600, py + 88);
    ctx.fillText("Кулдаун 30 минут до нового захода.", 600, py + 118);
  } else {
    ctx.fillText(`За выход вы потеряете ${MATCH_FORFEIT_MMR_PENALTY} MMR.`, 600, py + 88);
    ctx.fillText("Прогресс этого матча не сохранится.", 600, py + 118);
  }

  drawButton(f.exitButton, "Выйти", "#c62828");
  drawButton(f.stayButton, "Остаться", "#455a64");
}

function drawMatchReplayUi() {
  if (!matchReplayPlayer) return;
  const hb = matchReplayUi.backButton;
  ctx.fillStyle = "rgba(15,23,42,0.88)";
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(hb.x, hb.y, hb.w, hb.h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("←", hb.x + hb.w / 2, hb.y + hb.h / 2 + 1);

  if (matchReplayPlayer.ended) {
    ctx.textAlign = "center";
    ctx.font = "600 18px Arial";
    ctx.fillStyle = "rgba(226,232,240,0.95)";
    ctx.fillText("Конец повтора · нажми «Назад»", 600, 658);
  }
}

function drawMatchEndControls() {
  if (!match || !match.isFinished) return;

  refreshMatchEndControlsLayout();

  ctx.fillStyle = "rgba(9,14,25,0.84)";
  ctx.fillRect(330, 568, 540, 90);
  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.lineWidth = 2;
  ctx.strokeRect(330, 568, 540, 90);

  const againLabel = match.isTournament
    ? "К лестнице"
    : match.isPenalty
      ? "Ещё пенальти"
      : "Новая игра";
  if (match.hasReplayForEndScreen()) {
    drawButton(matchEndUi.replayButton, "Повтор", "#1565c0");
  }
  drawButton(matchEndUi.newGameButton, againLabel, "#2e7d32");
  drawButton(matchEndUi.menuButton, "В меню", "#455a64");
}

const QUEST_COMPLETE_DURATION = 5;
const ACHIEVEMENT_COMPLETE_DURATION = 5;

function tryClaimGlobalRewardPopup(pointer) {
  if (questCompletePopup.active && hitUiButton(pointer.x, pointer.y, questCompleteUi.claimButton)) {
    const r = DailyQuestSystem.claim(questCompletePopup.questId);
    if (r.ok) {
      AchievementSystem.onQuestRewardClaimed();
      questCompletePopup.active = false;
      questCompletePopup.questId = null;
      detectAndMaybeShowQuestCompletePopup();
      detectAndMaybeShowAchievementPopup();
    }
    return true;
  }
  if (achievementCompletePopup.active && hitUiButton(pointer.x, pointer.y, achievementCompleteUi.claimButton)) {
    const r = AchievementSystem.claim(achievementCompletePopup.achievementId);
    if (r.ok) {
      achievementCompletePopup.active = false;
      achievementCompletePopup.achievementId = null;
      detectAndMaybeShowAchievementPopup();
    }
    return true;
  }
  return false;
}

function showQuestCompletePopupFromRow(row) {
  questCompletePopup.active = true;
  questCompletePopup.timer = QUEST_COMPLETE_DURATION;
  questCompletePopup.animT = 0;
  questCompletePopup.questId = row.id;
  questCompletePopup.title = row.title || "Квест";
  questCompletePopup.rewardCoins = row.rewardCoins || 0;
  questCompletePopup.rewardGold = row.rewardGold || 0;
}

function getCanClaimQuestCandidates() {
  const snap = DailyQuestSystem.getSnapshot();
  const out = [];
  for (const r of snap.rows) if (r.canClaim) out.push(r);
  if (snap.chainRow && snap.chainRow.canClaim) out.push(snap.chainRow);
  return { dateKey: snap.dateKey, candidates: out };
}

function detectAndMaybeShowQuestCompletePopup() {
  if (questCompletePopup.active || achievementCompletePopup.active) return;
  const { dateKey, candidates } = getCanClaimQuestCandidates();
  if (questNotifyDayKey !== dateKey) {
    questNotifyDayKey = dateKey;
    notifiedQuestCanClaimIds = new Set();
  }

  // Список новых квестов, по которым ещё не было уведомления.
  const newOnes = candidates.filter((c) => !notifiedQuestCanClaimIds.has(c.id));
  if (newOnes.length === 0) return;

  // Берём «самый вкусный» (монеты + золото с небольшим весом).
  newOnes.sort((a, b) => (b.rewardCoins + b.rewardGold * 2) - (a.rewardCoins + a.rewardGold * 2));
  const best = newOnes[0];
  notifiedQuestCanClaimIds.add(best.id);
  showQuestCompletePopupFromRow(best);
}

function showAchievementCompletePopupFromRow(row) {
  achievementCompletePopup.active = true;
  achievementCompletePopup.timer = ACHIEVEMENT_COMPLETE_DURATION;
  achievementCompletePopup.animT = 0;
  achievementCompletePopup.achievementId = row.id;
  achievementCompletePopup.title = row.title || "Ачивка";
  achievementCompletePopup.rewardCoins = row.rewardCoins || 0;
  achievementCompletePopup.rewardGold = row.rewardGold || 0;
}

function detectAndMaybeShowAchievementPopup() {
  if (achievementCompletePopup.active || questCompletePopup.active) return;
  const claimable = AchievementSystem.getClaimableRows();
  const newOnes = claimable.filter((c) => !notifiedAchievementCanClaimIds.has(c.id));
  if (newOnes.length === 0) return;
  newOnes.sort((a, b) => (b.rewardCoins + b.rewardGold * 2) - (a.rewardCoins + a.rewardGold * 2));
  const best = newOnes[0];
  notifiedAchievementCanClaimIds.add(best.id);
  showAchievementCompletePopupFromRow(best);
}

function spawnCoinFx(amount) {
  if (!amount || amount <= 0) return;
  const startX = 1008;
  const startY = 208;
  const n = Math.min(18, Math.max(6, Math.floor(amount / 6)));
  const life = 1.05;

  for (let i = 0; i < n; i += 1) {
    const jitterX = (Math.random() - 0.5) * 22;
    const jitterY = (Math.random() - 0.5) * 12;
    coinFx.tokens.push({
      x: startX + jitterX,
      y: startY + jitterY,
      vx: (Math.random() - 0.5) * 220,
      vy: - (80 + Math.random() * 120),
      size: 6 + Math.random() * 6,
      age: 0,
      life,
      alpha: 1,
    });
  }

  coinFx.labels.push({
    x: startX + 10,
    y: startY - 10,
    text: `+${Math.floor(amount)} коин`,
    age: 0,
    life: 1.2,
  });
}

function updateCoinFx(dt) {
  const gravity = 260;
  for (const t of coinFx.tokens) {
    t.age += dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.vy += gravity * dt;
    t.alpha = Math.max(0, 1 - t.age / t.life);
  }
  coinFx.tokens = coinFx.tokens.filter((t) => t.age < t.life);

  for (const l of coinFx.labels) {
    l.age += dt;
    l.y -= 18 * dt;
    l.alpha = Math.max(0, 1 - l.age / l.life);
  }
  coinFx.labels = coinFx.labels.filter((l) => l.age < l.life);
}

function spawnGoldFx(amount) {
  if (!amount || amount <= 0) return;
  const startX = 1007;
  const startY = 62;
  const n = Math.min(16, Math.max(5, Math.floor(amount / 12)));
  const life = 1.05;

  for (let i = 0; i < n; i += 1) {
    const jitterX = (Math.random() - 0.5) * 20;
    const jitterY = (Math.random() - 0.5) * 10;
    goldFx.tokens.push({
      x: startX + jitterX,
      y: startY + jitterY,
      vx: (Math.random() - 0.5) * 200,
      vy: -(70 + Math.random() * 110),
      size: 7 + Math.random() * 5,
      age: 0,
      life,
      alpha: 1,
    });
  }

  goldFx.labels.push({
    x: startX + 8,
    y: startY - 12,
    text: `+${Math.floor(amount)} gold`,
    age: 0,
    life: 1.2,
  });
}

function updateGoldFx(dt) {
  const gravity = 260;
  for (const t of goldFx.tokens) {
    t.age += dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.vy += gravity * dt;
    t.alpha = Math.max(0, 1 - t.age / t.life);
  }
  goldFx.tokens = goldFx.tokens.filter((t) => t.age < t.life);

  for (const l of goldFx.labels) {
    l.age += dt;
    l.y -= 18 * dt;
    l.alpha = Math.max(0, 1 - l.age / l.life);
  }
  goldFx.labels = goldFx.labels.filter((l) => l.age < l.life);
}

function drawGoldFx() {
  for (const t of goldFx.tokens) {
    if (t.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = t.alpha;
    const r = t.size / 2;
    const grd = ctx.createRadialGradient(t.x - 1, t.y - 1, 1, t.x, t.y, r);
    grd.addColorStop(0, "#fff59d");
    grd.addColorStop(0.55, "#ffd54f");
    grd.addColorStop(1, "#f9a825");
    ctx.fillStyle = grd;
    ctx.strokeStyle = "rgba(180,120,0,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (const l of goldFx.labels) {
    if (!l.alpha) continue;
    ctx.save();
    ctx.globalAlpha = l.alpha;
    ctx.fillStyle = "#fff8e1";
    ctx.strokeStyle = "rgba(255,193,7,0.5)";
    ctx.lineWidth = 3;
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillText(l.text, l.x, l.y);
    ctx.restore();
  }
}

function drawCoinFx() {
  for (const t of coinFx.tokens) {
    if (t.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = t.alpha;
    ctx.fillStyle = "#fde047";
    ctx.strokeStyle = "rgba(245,158,11,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.arc(t.x + 1, t.y - 1, t.size / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Текст.
  for (const l of coinFx.labels) {
    if (l.alpha === 0 || l.alpha == null) continue;
    ctx.save();
    ctx.globalAlpha = l.alpha ?? 1;
    ctx.fillStyle = "#e0f2fe";
    ctx.strokeStyle = "rgba(56,189,248,0.45)";
    ctx.lineWidth = 3;
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillText(l.text, l.x, l.y);
    ctx.restore();
  }
}

function drawQuestCompletePopup() {
  if (!questCompletePopup.active) return;

  const { panel, claimButton } = questCompleteUi;
  const t = Math.min(1, questCompletePopup.animT / 0.25); // нарастание
  const fadeOut = Math.min(1, questCompletePopup.timer / 0.45);
  const alpha = t * fadeOut;

  const scale = 0.94 + 0.06 * t;
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // Фон и рамка.
  ctx.fillStyle = "rgba(7,11,20,0.92)";
  ctx.strokeStyle = "rgba(34,211,238,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 18);
  ctx.fill();
  ctx.stroke();

  // Заголовок.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Arial";
  ctx.fillText("ВЫ ВЫПОЛНИЛИ!", panel.x + panel.w / 2, panel.y + 66);

  ctx.fillStyle = "rgba(251,191,36,0.95)";
  ctx.font = "bold 30px Arial";
  ctx.fillText(String(questCompletePopup.title).toUpperCase(), panel.x + panel.w / 2, panel.y + 132);

  // Кнопка.
  const btn = claimButton;
  ctx.fillStyle = "rgba(245,124,0,0.95)";
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 14);
  ctx.fill();
  ctx.stroke();

  const rewardBits = [];
  if (questCompletePopup.rewardCoins > 0) rewardBits.push(`+${questCompletePopup.rewardCoins} коин`);
  if (questCompletePopup.rewardGold > 0) rewardBits.push(`+${questCompletePopup.rewardGold} gold`);

  ctx.fillStyle = "#111827";
  ctx.font = "bold 18px Arial";
  ctx.fillText("ЗАБЕРИТЕ НАГРАДУ", btn.x + btn.w / 2, btn.y + btn.h / 2 - 8);
  if (rewardBits.length) {
    ctx.fillStyle = "rgba(17,24,39,0.92)";
    ctx.font = "600 14px Arial";
    ctx.fillText(rewardBits.join(" · "), btn.x + btn.w / 2, btn.y + btn.h / 2 + 14);
  }

  ctx.restore();
}

function drawAchievementCompletePopup() {
  if (!achievementCompletePopup.active) return;

  const { panel, claimButton } = achievementCompleteUi;
  const t = Math.min(1, achievementCompletePopup.animT / 0.25);
  const fadeOut = Math.min(1, achievementCompletePopup.timer / 0.45);
  const alpha = t * fadeOut;
  const scale = 0.94 + 0.06 * t;
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  ctx.fillStyle = "rgba(20,12,40,0.94)";
  ctx.strokeStyle = "rgba(167,139,250,0.65)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 18);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Arial";
  ctx.fillText("АЧИВКА ПОЛУЧЕНА!", panel.x + panel.w / 2, panel.y + 66);

  ctx.fillStyle = "rgba(216,180,254,0.98)";
  ctx.font = "bold 28px Arial";
  ctx.fillText(String(achievementCompletePopup.title).toUpperCase(), panel.x + panel.w / 2, panel.y + 128);

  const btn = claimButton;
  ctx.fillStyle = "rgba(124,58,237,0.95)";
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 14);
  ctx.fill();
  ctx.stroke();

  const rewardBits = [];
  if (achievementCompletePopup.rewardCoins > 0) rewardBits.push(`+${achievementCompletePopup.rewardCoins} коин`);
  if (achievementCompletePopup.rewardGold > 0) rewardBits.push(`+${achievementCompletePopup.rewardGold} gold`);

  ctx.fillStyle = "#f5f3ff";
  ctx.font = "bold 18px Arial";
  ctx.fillText("ЗАБЕРИТЕ НАГРАДУ", btn.x + btn.w / 2, btn.y + btn.h / 2 - 8);
  if (rewardBits.length) {
    ctx.font = "600 14px Arial";
    ctx.fillText(rewardBits.join(" · "), btn.x + btn.w / 2, btn.y + btn.h / 2 + 14);
  }

  ctx.restore();
}

const engine = new Engine();

function update(deltaTime) {
  uiTime += deltaTime;
  syncBackgroundMusic();

  if (!skylineKickIntro.isDone()) {
    skylineKickIntro.update(deltaTime);
    if (skylineKickIntro.isDone()) finishSkylineIntroIfNeeded();
    return;
  }

  const pointer = inputManager.getPointerPosition();
  if (penaltyLaunch) {
    if (updatePenaltyLaunch(penaltyLaunch, deltaTime)) {
      startPenaltyMatch();
    }
  }

  if (state === STATES.TOURNAMENT) {
    updateTournamentFlow(deltaTime, () => {
      startTournamentMatch();
    });
  }

  if (state === STATES.MATCH && match) {
    match.update(deltaTime, pointer, inputManager.inputType);
    match.replayRecorder?.commitFrame(match);
    if (match.isFinished && !match._postMatchSystemsDone) {
      match._postMatchSystemsDone = true;
      const won = match.playerScore > match.botScore;

      if (match.isTournament) {
        if (won) {
          const tr = TournamentSystem.onRoundWin();
          if (tr.completed) {
            tournamentResultMsg = `Турнир пройден! +${tr.totalGoldAdded} gold, +${tr.bonusCoins} коинов`;
          } else {
            tournamentResultMsg = `Победа! +${tr.roundGold} gold`;
          }
        } else {
          TournamentSystem.onDefeat();
          tournamentResultMsg = "";
        }
      } else if (match.isPenalty) {
        /* Награды уже в MatchCore; MMR и серия не меняются. */
      } else {
        const streak = WinStreakSystem.onMatchEnd(won);
        match.winStreakCurrent = streak.current;
        match.streakMilestoneHit = streak.milestoneHit;
        if (streak.bonusGold > 0) {
          match.streakBonusGold = streak.bonusGold;
          match.goldDelta = (match.goldDelta || 0) + streak.bonusGold;
        }
        if (won) {
          match.fortuneTokensDelta = FortuneWheelSystem.grantMatchWinToken();
        }
      }

      DailyQuestSystem.recordMatchFinished({
        won,
        goalsPlayer: match.playerScore,
      });
      AchievementSystem.onMatchFinished({
        won,
        goalsPlayer: match.playerScore,
      });
      WeeklyQuestSystem.recordMatchFinished({
        won,
        goalsPlayer: match.playerScore,
      });
      detectAndMaybeShowQuestCompletePopup();
      detectAndMaybeShowAchievementPopup();
    }
  }

  if (state === STATES.MATCH_REPLAY && matchReplayPlayer) {
    matchReplayPlayer.update(deltaTime);
  }
  if (state === STATES.HIDE_SEEK && hideSeekGame) {
    hideSeekGame.update(deltaTime, hideSeekJoystick);
  }
  if (state === STATES.SHOP && shopUi.mode === "cases" && shopUi.isSpinning) {
    shopUi.spinElapsed += deltaTime;
    if (shopUi.spinElapsed >= shopUi.spinDuration) {
      shopUi.spinElapsed = shopUi.spinDuration;
      shopUi.isSpinning = false;
      finishCaseRoulette();
    }
  }
  if (state === STATES.SHOP && shopUi.mode === "cases" && shopUi.showResultPanel) {
    shopUi.revealTime += deltaTime;
  }
  if (state === STATES.SHOP && shopUi.mode === "wheel" && shopUi.wheelSpinning) {
    shopUi.wheelSpinElapsed += deltaTime;
    const t = Math.min(1, shopUi.wheelSpinElapsed / shopUi.wheelSpinDuration);
    const eased = 1 - Math.pow(1 - t, 3);
    shopUi.wheelRotation =
      shopUi.wheelSpinStartRot + (shopUi.wheelSpinEndRot - shopUi.wheelSpinStartRot) * eased;
    if (t >= 1) finishFortuneWheelSpin();
  }
  if (state === STATES.SHOP && shopUi.mode === "garage") {
    if (shopUi.garagePhase === "darken") {
      shopUi.garageDarkenElapsed += deltaTime;
      if (shopUi.garageDarkenElapsed >= shopUi.garageDarkenDuration) {
        shopUi.garagePhase = "reveal";
        shopUi.garageRevealElapsed = 0;
      }
    } else if (shopUi.garagePhase === "reveal") {
      shopUi.garageRevealElapsed += deltaTime;
      if (shopUi.garageRevealElapsed >= shopUi.garageRevealDuration) {
        shopUi.garagePhase = "done";
        shopUi.garageShowResult = true;
        refreshOwnedSkins();
      }
    }
  }
  if (state !== STATES.SHOP) {
    if (shopUi.result) {
      shopUi.result = null;
      shopUi.strip = [];
      shopUi.showResultPanel = false;
      shopUi.revealTime = 0;
    }
    if (shopUi.mode !== "hub" || shopUi.garagePhase !== "idle" || shopUi.garageShowResult) {
      enterShopState();
    }
  }
  if (shopUi.resultTimer > 0) {
    shopUi.resultTimer = Math.max(0, shopUi.resultTimer - deltaTime);
  }
  if (state === STATES.PAINT_SKIN && paintStudio.messageTimer > 0) {
    paintStudio.messageTimer = Math.max(0, paintStudio.messageTimer - deltaTime);
  }

  // Глобальное уведомление (5 сек).
  if (questCompletePopup.active) {
    questCompletePopup.timer = Math.max(0, questCompletePopup.timer - deltaTime);
    questCompletePopup.animT += deltaTime;
    if (questCompletePopup.timer <= 0) {
      questCompletePopup.active = false;
      questCompletePopup.questId = null;
      // Если одновременно стало готово несколько квестов — покажем следующий.
      detectAndMaybeShowQuestCompletePopup();
    }
  }

  const coinEvents = CurrencySystem.consumeCoinAnimEvents();
  for (const ev of coinEvents) spawnCoinFx(ev.amount);
  const goldEvents = CurrencySystem.consumeGoldAnimEvents();
  for (const ev of goldEvents) spawnGoldFx(ev.amount);
  updateCoinFx(deltaTime);
  updateGoldFx(deltaTime);

  if (achievementCompletePopup.active) {
    achievementCompletePopup.timer = Math.max(0, achievementCompletePopup.timer - deltaTime);
    achievementCompletePopup.animT += deltaTime;
    if (achievementCompletePopup.timer <= 0) {
      achievementCompletePopup.active = false;
      achievementCompletePopup.achievementId = null;
      detectAndMaybeShowAchievementPopup();
    }
  }

  if (questsToast.timer > 0) {
    questsToast.timer = Math.max(0, questsToast.timer - deltaTime);
  }
  if (menuToast.timer > 0) {
    menuToast.timer = Math.max(0, menuToast.timer - deltaTime);
  }
  if (inventoryToast.timer > 0) {
    inventoryToast.timer = Math.max(0, inventoryToast.timer - deltaTime);
  }
  if (state === STATES.INVENTORY) {
    updateInventoryPageAnim(deltaTime);
  }
  if (shouldShowFallingLeaves()) {
    fallingLeavesFx.update(deltaTime);
  }
}

function render() {
  clear();
  canvas.style.cursor = "default";

  if (!skylineKickIntro.isDone()) {
    drawSkylineKickIntro(ctx, skylineKickIntro, uiTime);
    return;
  }

  if (!appUnlocked) {
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);
    return;
  }
  if (state === STATES.MATCH && match) {
    match.draw(ctx);
    drawMatchLiveUi();
    drawMatchEndControls();
  } else if (state === STATES.MATCH_REPLAY && matchReplayPlayer) {
    matchReplayPlayer.draw(ctx);
    drawMatchReplayUi();
  } else if (state === STATES.MODE_SELECT) {
    drawModeSelectScreen(ctx, drawButton, {
      onCooldown: TournamentSystem.isOnCooldown(),
      cooldownText: TournamentSystem.formatCooldownRemaining(),
    });
    if (penaltyLaunch) drawPenaltyLaunchOverlay(ctx, penaltyLaunch);
  } else if (state === STATES.HIDE_SEEK && hideSeekGame) {
    if (hideSeekGame.phase === "role_select" || hideSeekGame.phase === "enter_fade") {
      drawHideSeekRoleSelect(ctx, drawButton, uiTime, hideSeekGame.getFlashOverlay());
    } else {
      drawHideSeekPlay(ctx, hideSeekGame, uiTime, drawButton, hideSeekJoystick);
      const flash = hideSeekGame.getFlashOverlay();
      if (flash > 0.02) {
        ctx.fillStyle = `rgba(0,0,0,${flash})`;
        ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);
      }
    }
  } else if (state === STATES.TOURNAMENT) {
    drawTournamentScreen(ctx, drawButton, uiTime);
  } else if (state === STATES.SHOP) {
    drawShopUi();
  } else if (state === STATES.INVENTORY) {
    drawInventoryUi();
  } else if (state === STATES.QUESTS) {
    drawQuestsUi();
  } else if (state === STATES.SETTINGS) {
    drawSettingsScreen(ctx, drawButton);
  } else if (state === STATES.PAINT_SKIN) {
    drawPaintSkinUi();
  } else {
    const selected = getActiveSkinSafe();
    const menuPointer = inputManager.getPointerPosition();
    mainMenu.draw(ctx, {
      mmr: EloSystem.getElo(),
      gold: CurrencySystem.getGold(),
      coins: CurrencySystem.getCoins(),
      trophies: TrophySystem.getTrophies(),
      winStreak: WinStreakSystem.getCurrent(),
      skinName: selected.name,
      skinRarity: selected.rarity,
      previewSkin: selected,
      uiTime,
      rarityColor: getRarityVisual(selected.rarity).color,
      displayName: AccountAuth.getDisplayName(),
      pointer: menuPointer,
      questsBadge: hasUnclaimedQuestOrAchievementRewards(),
      menuToastText: menuToast.timer > 0 ? menuToast.text : "",
    });
    // Курсор-«рука» над кнопкой главного меню.
    canvas.style.cursor = mainMenu.hoveredKey ? "pointer" : "default";
  }

  if (shouldShowFallingLeaves()) {
    fallingLeavesFx.draw(ctx);
  }

  drawQuestCompletePopup();
  drawAchievementCompletePopup();
  drawCoinFx();
  drawGoldFx();
  drawMenuToast();
}

function drawMenuToast() {
  if (!menuToast.text || menuToast.timer <= 0) return;
  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.beginPath();
  ctx.roundRect(280, 118, 640, 44, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(45,212,191,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ccfbf1";
  ctx.font = "600 17px Arial";
  ctx.fillText(menuToast.text, 600, 140);
}

engine.setUpdateFn(update);
engine.setRenderFn(render);
engine.start();

/** После полной загрузки модуля — проверить готовые квесты/ачивки (нельзя вызывать раньше объявления popup-переменных). */
if (AccountAuth.isLoggedIn() && appUnlocked) {
  detectAndMaybeShowAchievementPopup();
  detectAndMaybeShowQuestCompletePopup();
}
