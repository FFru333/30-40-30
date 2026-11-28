import type { DietTag } from '../food/types';
import { distribute, kcalToBlocks, navyBodyFat, targetKcal, zoneBlocks, type Activity, type Body, type Goal, type ZoneCalc } from './energy';

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
  /** Come si calcola il budget: Zona (massa magra × attività) o calorie. */
  method?: 'zona' | 'calorie';
  /** Percentuale di grasso misurata (plicometria, bilancia). */
  bodyFatPct?: number;
  /** Circonferenze per stimare il grasso se non lo conosci (cm). */
  waistCm?: number;
  neckCm?: number;
  hipsCm?: number;
  /** Indice di attività Zona, 1,1–2,3. */
  zoneActivity?: number;
}

/** Percentuale di grasso: misurata, altrimenti stimata dalle circonferenze. */
export function bodyFatOf(p: Profile): { pct: number; estimated: boolean } | null {
  if (p.bodyFatPct && p.bodyFatPct > 0) return { pct: p.bodyFatPct, estimated: false };
  const b = p.body;
  if (b?.sex && b.heightCm > 0 && p.waistCm && p.neckCm) {
    const est = navyBodyFat(b.sex, b.heightCm, p.waistCm, p.neckCm, p.hipsCm);
    if (est) return { pct: est, estimated: true };
  }
  return null;
}

/** Calcolo Zona del profilo, se ci sono peso e grasso. */
export function zoneCalcOf(p: Profile): ZoneCalc | null {
  const bf = bodyFatOf(p);
  if (!p.body?.weightKg || !bf) return null;
  return zoneBlocks(p.body.weightKg, bf.pct, p.zoneActivity ?? 1.3);
}

export const methodOf = (p: Profile): 'zona' | 'calorie' => p.method ?? (p.dailyKcal ? 'calorie' : 'zona');

/** Schema della giornata: colazione, spuntino, pranzo, spuntino, cena con i loro blocchi. */
export function slotsOf(p: Profile) {
  return distribute(dayBudget(p), p.mealsPerDay, p.snacksPerDay);
}

/** Calorie della giornata: quelle scritte a mano, altrimenti dal metabolismo. */
export function dailyKcalOf(p: Profile): number | null {
  if (methodOf(p) === 'zona') {
    const z = zoneCalcOf(p);
    return z ? z.blocks * 91 : null;
  }
  if (p.dailyKcal && p.dailyKcal > 0) return p.dailyKcal;
  const b = p.body;
  if (b && b.sex && b.age > 0 && b.weightKg > 0 && b.heightCm > 0)
    return targetKcal(b, p.activity ?? 'leggero', p.goal ?? 'mantenere');
  return null;
}

/**
 * Blocchi della giornata.
 * - Metodo Zona: massa magra × indice di attività ÷ 7 (minimo 11).
 * - Metodo calorie: calorie ÷ 91.
 * Se mancano i dati, la somma di pasti + spuntini del profilo.
 */
export function dayBudget(p: Profile): number {
  if (methodOf(p) === 'zona') {
    const z = zoneCalcOf(p);
    if (z) return z.blocks;
  } else {
    const k = dailyKcalOf(p);
    if (k) return kcalToBlocks(k);
  }
  return dailyBlocks(p);
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
