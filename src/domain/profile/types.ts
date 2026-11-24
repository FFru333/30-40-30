import type { DietTag } from '../food/types';
import { kcalToBlocks, targetKcal, type Activity, type Body, type Goal } from './energy';

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
  /** Dati per il calcolo del fabbisogno. */
  body?: Body;
  activity?: Activity;
  goal?: Goal;
  /** Calorie della giornata scritte a mano: hanno la precedenza sul calcolo. */
  dailyKcal?: number;
}

/** Calorie della giornata: quelle scritte a mano, altrimenti dal metabolismo. */
export function dailyKcalOf(p: Profile): number | null {
  if (p.dailyKcal && p.dailyKcal > 0) return p.dailyKcal;
  const b = p.body;
  if (b && b.sex && b.age > 0 && b.weightKg > 0 && b.heightCm > 0)
    return targetKcal(b, p.activity ?? 'leggero', p.goal ?? 'mantenere');
  return null;
}

/** Blocchi della giornata: dalle calorie se note, altrimenti dalla somma pasti + spuntini. */
export function dayBudget(p: Profile): number {
  const k = dailyKcalOf(p);
  return k ? kcalToBlocks(k) : dailyBlocks(p);
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
