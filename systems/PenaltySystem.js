import CurrencySystem from "./CurrencySystem.js";
import FortuneWheelSystem from "./FortuneWheelSystem.js";

export const PENALTY_WIN_GOALS = 5;
export const PENALTY_WIN_GOLD = 150;
export const PENALTY_WIN_COINS = 50;
export const PENALTY_WIN_TOKENS = 1;

/** Награда за победу в пенальти (MMR не трогаем). */
export function grantPenaltyWinRewards() {
  const gold = CurrencySystem.addGold(PENALTY_WIN_GOLD);
  const coins = CurrencySystem.addCoins(PENALTY_WIN_COINS);
  let tokens = 0;
  for (let i = 0; i < PENALTY_WIN_TOKENS; i += 1) {
    tokens += FortuneWheelSystem.grantMatchWinToken();
  }
  return { gold, coins, tokens };
}
