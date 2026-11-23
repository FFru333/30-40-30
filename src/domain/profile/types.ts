import type { DietTag } from '../food/types';

export type Diet = 'onnivoro' | 'pescetariano' | 'vegetariano' | 'vegano';

export interface Tolerance {
  /** In blocchi, ± dal target. */
  protein: number;
  carbs: number;
  fat: number;
}

export interface Profile {
  id: string;
  name: string;
  diet: Diet;
  blocksPerMeal: number;
  mealsPerDay: number;
  blocksPerSnack: number;
  snacksPerDay: number;
  tolerance: Tolerance;
  excludedFoodIds: string[];
}

export const DEFAULT_TOLERANCE: Tolerance = { protein: 0.5, carbs: 0.5, fat: 0.5 };

export function dailyBlocks(p: Profile): number {
  return p.blocksPerMeal * p.mealsPerDay + p.blocksPerSnack * p.snacksPerDay;
}

const ALLOWED: Record<Diet, DietTag[]> = {
  onnivoro: ['vegano', 'vegetariano', 'pesce', 'carne'],
  pescetariano: ['vegano', 'vegetariano', 'pesce'],
  vegetariano: ['vegano', 'vegetariano'],
  vegano: ['vegano'],
};

export function dietAllows(diet: Diet, tag: DietTag): boolean {
  return ALLOWED[diet].includes(tag);
}

export const DIET_LABEL: Record<Diet, string> = {
  onnivoro: 'Onnivoro',
  pescetariano: 'Niente carne, sì pesce',
  vegetariano: 'Vegetariano',
  vegano: 'Vegano',
};
