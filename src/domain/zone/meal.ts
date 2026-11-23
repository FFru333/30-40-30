import type { Food, Ingredient } from '../food/types';
import { KCAL_PER_G, MACROS, netCarbs, type Macro, type MacroGrams } from './blocks';

export type FoodLookup = (id: string) => Food | undefined;

export interface MealTotals extends MacroGrams {
  fiber: number;
  /** kcal da etichetta (include fibre, arrotondamenti del produttore). */
  kcalLabel: number;
  /** kcal calcolate dai macro (4/4/9): base della ripartizione. */
  kcalMacro: number;
  /** Ingredienti il cui alimento non è più nell'archivio. */
  missing: string[];
}

/** Macro netti apportati da `grams` di un alimento. */
export function foodMacros(food: Food, grams: number): MacroGrams & { fiber: number; kcal: number } {
  const k = grams / 100;
  const p = food.per100;
  return {
    protein: p.protein * k,
    carbs: netCarbs(p, food.carbBasis) * k,
    fat: p.fat * k,
    fiber: p.fiber * k,
    kcal: p.kcal * k,
  };
}

export function mealTotals(items: Ingredient[], lookup: FoodLookup): MealTotals {
  const t: MealTotals = { protein: 0, carbs: 0, fat: 0, fiber: 0, kcalLabel: 0, kcalMacro: 0, missing: [] };
  for (const it of items) {
    const food = lookup(it.foodId);
    if (!food) {
      t.missing.push(it.foodId);
      continue;
    }
    const m = foodMacros(food, it.grams);
    t.protein += m.protein;
    t.carbs += m.carbs;
    t.fat += m.fat;
    t.fiber += m.fiber;
    t.kcalLabel += m.kcal;
  }
  t.kcalMacro = macroKcal(t);
  return t;
}

export function macroKcal(g: MacroGrams): number {
  return g.protein * KCAL_PER_G.protein + g.carbs * KCAL_PER_G.carbs + g.fat * KCAL_PER_G.fat;
}

/** Quota di kcal di ciascun macro (somma = 1). Zero se il pasto è vuoto. */
export function kcalSplit(g: MacroGrams): Record<Macro, number> {
  const total = macroKcal(g);
  const out = { protein: 0, carbs: 0, fat: 0 };
  if (total <= 0) return out;
  for (const m of MACROS) out[m] = (g[m] * KCAL_PER_G[m]) / total;
  return out;
}
