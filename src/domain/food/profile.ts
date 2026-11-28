import type { Food } from './types';
import { KCAL_PER_G, MACROS, netCarbs, type Macro } from '../zone/blocks';

export type Dominant = Macro | 'mixed';

export interface MacroProfile {
  /** Quota delle kcal da ciascun macro (somma 1; 0 se l'alimento non ne ha). */
  share: Record<Macro, number>;
  /** Macro che porta almeno metà delle kcal, altrimenti 'mixed'. */
  dominant: Dominant;
}

/** Per quale macro è "forte" un alimento: su questo si basa la firma visiva. */
export function macroProfile(food: Food): MacroProfile {
  const g = { protein: food.per100.protein, carbs: netCarbs(food.per100, food.carbBasis), fat: food.per100.fat };
  const k = { protein: g.protein * KCAL_PER_G.protein, carbs: g.carbs * KCAL_PER_G.carbs, fat: g.fat * KCAL_PER_G.fat };
  const total = k.protein + k.carbs + k.fat;
  const share = { protein: 0, carbs: 0, fat: 0 };
  if (total > 0) for (const m of MACROS) share[m] = k[m] / total;
  const top = MACROS.reduce((a, b) => (share[b] > share[a] ? b : a));
  return { share, dominant: total > 0 && share[top] >= 0.5 ? top : 'mixed' };
}

/** Unità di un mini-blocco: 7 g di proteine, 9 g di carboidrati netti, 1,5 g di grassi. */
export const MINI_BLOCK = { protein: 7, carbs: 9, fat: 1.5 } as const;

/**
 * Grammi dell'alimento che forniscono un mini-blocco di ciascun macro.
 * null se l'alimento ne contiene troppo poco (servirebbero più di 1 kg).
 */
export function miniBlockGrams(food: Food): Record<Macro, number | null> {
  const per100 = { protein: food.per100.protein, carbs: netCarbs(food.per100, food.carbBasis), fat: food.per100.fat };
  const out = { protein: null, carbs: null, fat: null } as Record<Macro, number | null>;
  for (const m of MACROS) {
    const g = per100[m] > 0 ? (MINI_BLOCK[m] / per100[m]) * 100 : Infinity;
    out[m] = g <= 1000 ? g : null;
  }
  return out;
}

/** Arrotondamento da bilancia: sotto 10 g al mezzo grammo, sotto 100 al grammo, poi ai 5 g. */
export function scaleGrams(g: number): number {
  if (g < 10) return Math.round(g * 2) / 2;
  if (g < 100) return Math.round(g);
  return Math.round(g / 5) * 5;
}
