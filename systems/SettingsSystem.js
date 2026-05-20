const STORAGE_KEY = "eloball.audioSettings";

const DEFAULTS = {
  musicVolume: 1,
  sfxVolume: 1,
};

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function readRaw() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeRaw(data) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    /* ignore */
  }
}

const state = { ...DEFAULTS };

function load() {
  const saved = readRaw();
  if (!saved || typeof saved !== "object") return;
  if (saved.musicVolume != null) state.musicVolume = clamp01(saved.musicVolume);
  if (saved.sfxVolume != null) state.sfxVolume = clamp01(saved.sfxVolume);
}

function persist() {
  writeRaw({
    musicVolume: state.musicVolume,
    sfxVolume: state.sfxVolume,
  });
}

load();

const SettingsSystem = {
  load,
  getMusicVolume() {
    return state.musicVolume;
  },
  getSfxVolume() {
    return state.sfxVolume;
  },
  setMusicVolume(value) {
    state.musicVolume = clamp01(value);
    persist();
  },
  setSfxVolume(value) {
    state.sfxVolume = clamp01(value);
    persist();
  },
  formatPercent(value) {
    return `${Math.round(clamp01(value) * 100)}%`;
  },
};

export default SettingsSystem;
