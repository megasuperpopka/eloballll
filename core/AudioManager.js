import { resolveGameAssetUrl } from "../systems/AssetUrl.js";
import { isNativeMobileApp } from "./MobileLayout.js";
import SettingsSystem from "../systems/SettingsSystem.js";

const MENU_MUSIC_BASE = 0.55;

/** Дополнительный множитель громкости для отдельных звуков (итог не больше 1). */
const SFX_GAIN = {
  ui_click: 4,
};

/** @type {Map<string, { audio: HTMLAudioElement, loop: boolean }>} */
const sounds = new Map();

let audioUnlocked = false;
let pendingMenuPlay = false;
let hideSeekMusicWanted = false;
/** @type {string | null} */
let activeLoopId = null;
let gestureListenersAttached = false;
/** @type {"off" | "intro" | "loop"} */
let hideSeekMusicPhase = "off";
/** @type {(() => void) | null} */
let hideSeekIntroEndedHandler = null;
let goalSoundPlaying = false;
/** @type {(() => void) | null} */
let goalSoundEndedHandler = null;
/** @type {(() => void) | null} */
let goalSoundErrorHandler = null;

function canAutoplayWithoutGesture() {
  return isNativeMobileApp();
}

function getOrCreate(id, url, { loop = false, playbackRate = 1 } = {}) {
  let entry = sounds.get(id);
  if (entry) return entry;
  const audio = new Audio(resolveGameAssetUrl(url));
  audio.loop = loop;
  audio.preload = "auto";
  if (Number.isFinite(playbackRate) && playbackRate > 0) {
    audio.playbackRate = playbackRate;
  }
  entry = { audio, loop, playbackRate };
  sounds.set(id, entry);
  return entry;
}

function clearGoalSoundListeners(audio) {
  if (goalSoundEndedHandler) {
    audio.removeEventListener("ended", goalSoundEndedHandler);
    goalSoundEndedHandler = null;
  }
  if (goalSoundErrorHandler) {
    audio.removeEventListener("error", goalSoundErrorHandler);
    goalSoundErrorHandler = null;
  }
}

function finishGoalSound() {
  if (!goalSoundPlaying) return;
  const entry = sounds.get("goal_cheer");
  if (entry) clearGoalSoundListeners(entry.audio);
  goalSoundPlaying = false;
  pendingMenuPlay = true;
}

function attachGestureUnlockListeners() {
  if (gestureListenersAttached || typeof window === "undefined") return;
  gestureListenersAttached = true;
  const onGesture = () => {
    AudioManager.unlock();
  };
  window.addEventListener("pointerdown", onGesture, { once: true, passive: true });
  window.addEventListener("touchstart", onGesture, { once: true, passive: true });
}

function getMusicVolume() {
  return MENU_MUSIC_BASE * SettingsSystem.getMusicVolume();
}

function getSfxVolume(multiplier = 1) {
  return multiplier * SettingsSystem.getSfxVolume();
}

function tryPlayAudio(audio, onOk) {
  const vol = getMusicVolume();
  audio.volume = vol;
  if (vol <= 0) return false;
  const playPromise = audio.play();
  if (!playPromise || typeof playPromise.then !== "function") return true;
  playPromise
    .then(() => {
      audioUnlocked = true;
      if (onOk) onOk();
    })
    .catch(() => {
      attachGestureUnlockListeners();
    });
  return true;
}

function tryPlayLoop(entry) {
  entry.audio.volume = getMusicVolume();
  const playPromise = entry.audio.play();
  if (!playPromise || typeof playPromise.then !== "function") return;
  playPromise
    .then(() => {
      audioUnlocked = true;
      pendingMenuPlay = false;
    })
    .catch(() => {
      pendingMenuPlay = true;
      attachGestureUnlockListeners();
    });
}

function pauseHideSeekTracks() {
  for (const id of ["hide_seek_intro", "hide_seek_loop"]) {
    const entry = sounds.get(id);
    if (!entry) continue;
    entry.audio.pause();
    entry.audio.currentTime = 0;
  }
  if (hideSeekIntroEndedHandler) {
    const intro = sounds.get("hide_seek_intro");
    if (intro) intro.audio.removeEventListener("ended", hideSeekIntroEndedHandler);
    hideSeekIntroEndedHandler = null;
  }
  if (activeLoopId === "hide_seek_loop") activeLoopId = null;
  hideSeekMusicPhase = "off";
}

const AudioManager = {
  load(id, url, options = {}) {
    getOrCreate(id, url, options);
  },

  /**
   * Сразу после загрузки игры: предзагрузка и попытка запустить меню-музыку
   * (на Android APK обычно без нажатия; в браузере — после первого тапа).
   */
  bootstrap() {
    for (const id of ["menu", "hide_seek_intro", "hide_seek_loop", "goal_cheer"]) {
      const entry = sounds.get(id);
      if (!entry) continue;
      try {
        entry.audio.load();
      } catch {
        /* ignore */
      }
    }
    if (canAutoplayWithoutGesture()) {
      audioUnlocked = true;
    }
    pendingMenuPlay = true;
    this.syncMenuMusic(true);
    if (!audioUnlocked) attachGestureUnlockListeners();
  },

  unlock() {
    if (audioUnlocked) {
      if (hideSeekMusicWanted) this.syncHideSeekMusic(true);
      else if (pendingMenuPlay) this.syncMenuMusic(true);
      return;
    }
    audioUnlocked = true;
    for (const { audio } of sounds.values()) {
      try {
        audio.load();
      } catch {
        /* ignore */
      }
    }
    if (hideSeekMusicWanted) this.syncHideSeekMusic(true);
    else if (pendingMenuPlay) this.syncMenuMusic(true);
  },

  play(id, { volume = 1 } = {}) {
    if (!audioUnlocked && !canAutoplayWithoutGesture()) {
      attachGestureUnlockListeners();
      return;
    }
    const gain = SFX_GAIN[id] ?? 1;
    const effectiveVolume = Math.min(1, getSfxVolume(volume * gain));
    if (effectiveVolume <= 0) return;
    const entry = sounds.get(id);
    if (!entry || entry.loop) return;
    const { audio } = entry;
    try {
      const clip = audio.cloneNode();
      clip.volume = effectiveVolume;
      void clip.play();
    } catch {
      try {
        audio.currentTime = 0;
        audio.volume = effectiveVolume;
        void audio.play();
      } catch {
        /* ignore */
      }
    }
  },

  /** Обновить громкость уже играющей музыки (после ползунка в настройках). */
  updateVolumes() {
    const vol = getMusicVolume();
    for (const id of ["menu", "hide_seek_loop"]) {
      const entry = sounds.get(id);
      if (!entry) continue;
      entry.audio.volume = vol;
      if (vol <= 0 && !entry.audio.paused) {
        entry.audio.pause();
      }
    }
    const intro = sounds.get("hide_seek_intro");
    if (intro && hideSeekMusicPhase === "intro") {
      intro.audio.volume = vol;
    }
    if (hideSeekMusicWanted) {
      this.syncHideSeekMusic(true);
      return;
    }
    const menu = sounds.get("menu");
    if (
      menu &&
      vol > 0 &&
      pendingMenuPlay &&
      menu.audio.paused &&
      hideSeekMusicPhase === "off" &&
      (audioUnlocked || canAutoplayWithoutGesture())
    ) {
      void menu.audio.play().catch(() => {});
    }
  },

  isGoalSoundPlaying() {
    return goalSoundPlaying;
  },

  /** Гол игрока: стоп меню → GOAAAL (×2) → снова меню. */
  playGoalSound() {
    const entry = sounds.get("goal_cheer");
    if (!entry) return;

    if (!audioUnlocked && !canAutoplayWithoutGesture()) {
      attachGestureUnlockListeners();
      return;
    }

    const { audio } = entry;
    clearGoalSoundListeners(audio);
    goalSoundPlaying = true;
    this.syncMenuMusic(false);

    const vol = Math.min(1, getSfxVolume(1));
    if (vol <= 0) {
      finishGoalSound();
      return;
    }

    audio.volume = vol;
    audio.playbackRate = entry.playbackRate ?? 2;
    audio.currentTime = 0;

    goalSoundEndedHandler = () => finishGoalSound();
    goalSoundErrorHandler = () => finishGoalSound();
    audio.addEventListener("ended", goalSoundEndedHandler);
    audio.addEventListener("error", goalSoundErrorHandler, { once: true });

    const playPromise = audio.play();
    if (!playPromise || typeof playPromise.then !== "function") return;
    playPromise
      .then(() => {
        audioUnlocked = true;
      })
      .catch(() => {
        attachGestureUnlockListeners();
        finishGoalSound();
      });
  },

  syncMenuMusic(shouldPlay, loopId = "menu") {
    const entry = sounds.get(loopId);
    if (!entry || !entry.loop) return;

    if (goalSoundPlaying) {
      if (shouldPlay) pendingMenuPlay = true;
      return;
    }

    if (!shouldPlay) {
      pendingMenuPlay = false;
      if (activeLoopId === loopId) activeLoopId = null;
      if (!entry.audio.paused) {
        entry.audio.pause();
        entry.audio.currentTime = 0;
      }
      return;
    }

    if (hideSeekMusicWanted || goalSoundPlaying) return;

    pendingMenuPlay = true;
    if (activeLoopId === loopId && !entry.audio.paused) return;

    activeLoopId = loopId;

    if (audioUnlocked || canAutoplayWithoutGesture()) {
      tryPlayLoop(entry);
      return;
    }

    tryPlayLoop(entry);
  },

  stop(id) {
    const entry = sounds.get(id);
    if (!entry) return;
    entry.audio.pause();
    entry.audio.currentTime = 0;
    if (activeLoopId === id) activeLoopId = null;
  },

  /** Прятки: intro один раз, затем loop. Вызывать каждый кадр через syncHideSeekMusic(true). */
  syncHideSeekMusic(shouldPlay) {
    hideSeekMusicWanted = shouldPlay;

    if (!shouldPlay) {
      this.stopHideSeekMusic();
      return;
    }

    this.syncMenuMusic(false);

    const introEntry = sounds.get("hide_seek_intro");
    const loopEntry = sounds.get("hide_seek_loop");
    if (!introEntry && !loopEntry) return;

    const startLoop = () => {
      if (!loopEntry) return;
      if (hideSeekIntroEndedHandler && introEntry) {
        introEntry.audio.removeEventListener("ended", hideSeekIntroEndedHandler);
        hideSeekIntroEndedHandler = null;
      }
      if (introEntry && !introEntry.audio.paused) {
        introEntry.audio.pause();
        introEntry.audio.currentTime = 0;
      }
      hideSeekMusicPhase = "loop";
      activeLoopId = "hide_seek_loop";
      if (!loopEntry.audio.paused) return;
      loopEntry.audio.currentTime = 0;
      tryPlayAudio(loopEntry.audio);
    };

    if (hideSeekMusicPhase === "loop") {
      if (loopEntry?.audio.paused && getMusicVolume() > 0) {
        tryPlayAudio(loopEntry.audio);
      }
      return;
    }

    if (hideSeekMusicPhase === "intro") {
      if (introEntry?.audio.paused && !introEntry.audio.ended && getMusicVolume() > 0) {
        tryPlayAudio(introEntry.audio);
      }
      return;
    }

    if (!introEntry) {
      startLoop();
      return;
    }

    hideSeekMusicPhase = "intro";
    const { audio } = introEntry;
    audio.currentTime = 0;

    hideSeekIntroEndedHandler = () => {
      if (hideSeekMusicPhase !== "intro" || !hideSeekMusicWanted) return;
      startLoop();
    };
    audio.addEventListener("ended", hideSeekIntroEndedHandler);
    audio.addEventListener(
      "error",
      () => {
        if (hideSeekMusicWanted) startLoop();
      },
      { once: true },
    );

    if (!tryPlayAudio(audio)) {
      startLoop();
    }
  },

  stopHideSeekMusic() {
    hideSeekMusicWanted = false;
    pauseHideSeekTracks();
  },
};

export default AudioManager;
