import type { Food, Ingredient, Nutrients, Source } from './types';
import { foodMacros, type FoodLookup } from '../zone/meal';
import type { DietTag } from './types';

const DIET_RANK: DietTag[] = ['vegano', 'vegetariano', 'pesce', 'carne'];

/**
 * Valori per 100 g di un piatto composto.
 * I carboidrati risultanti sono già netti, quindi il piatto ha carbBasis 'eu'.
 * `finalWeight` (peso a cottura finita) se diverso dalla somma degli ingredienti.
 */
export function compositeNutrients(
  ingredients: Ingredient[],
  lookup: FoodLookup,
  finalWeight?: number,
): { per100: Nutrients; source: Source; diet: DietTag } {
  const sum: Nutrients = { kcal: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
  let weight = 0;
  let source: Source = 'etichetta';
  let dietIdx = 0;
  for (const it of ingredients) {
    const f = lookup(it.foodId);
    if (!f) {
      source = 'stima';
      continue;
    }
    const m = foodMacros(f, it.grams);
    sum.kcal += m.kcal;
    sum.protein += m.protein;
    sum.carbs += m.carbs;
    sum.fiber += m.fiber;
    sum.fat += m.fat;
    weight += it.grams;
    if (f.source === 'stima') source = 'stima';
    else if (f.source === 'off' && source === 'etichetta') source = 'off';
    dietIdx = Math.max(dietIdx, DIET_RANK.indexOf(f.diet));
  }
  const w = finalWeight && finalWeight > 0 ? finalWeight : weight;
  const k = w > 0 ? 100 / w : 0;
  return {
    per100: {
      kcal: sum.kcal * k,
      protein: sum.protein * k,
      carbs: sum.carbs * k,
      fiber: sum.fiber * k,
      fat: sum.fat * k,
    },
    source,
    diet: DIET_RANK[dietIdx] ?? 'vegano',
  };
}

export function buildComposite(
  id: string,
  name: string,
  ingredients: Ingredient[],
  lookup: FoodLookup,
  finalWeight?: number,
): Food {
  const { per100, source, diet } = compositeNutrients(ingredients, lookup, finalWeight);
  const total = finalWeight && finalWeight > 0 ? finalWeight : ingredients.reduce((a, i) => a + i.grams, 0);
  return {
    id,
    name,
    per100,
    carbBasis: 'eu',
    diet,
    source,
    sourceNote: 'Calcolato dagli ingredienti',
    portion: { label: 'piatto intero', grams: Math.round(total) },
    ingredients: ingredients.map((i) => ({ ...i })),
  };
}
