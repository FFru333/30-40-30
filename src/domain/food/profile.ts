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
