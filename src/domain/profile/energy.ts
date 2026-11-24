import { KCAL_PER_G, CARBS_PER_BLOCK, FAT_PER_BLOCK, PROTEIN_PER_BLOCK } from '../zone/blocks';

export type Sex = 'm' | 'f';
export type Activity = 'sedentario' | 'leggero' | 'moderato' | 'attivo' | 'molto';
export type Goal = 'perdere' | 'mantenere' | 'aumentare';

export interface Body {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
}

/** kcal di un blocco Zona completo: 7 g P + 9 g C + 3 g G = 28 + 36 + 27 = 91 kcal. */
export const BLOCK_KCAL =
  PROTEIN_PER_BLOCK * KCAL_PER_G.protein + CARBS_PER_BLOCK * KCAL_PER_G.carbs + FAT_PER_BLOCK * KCAL_PER_G.fat;

export const ACTIVITY: Record<Activity, { factor: number; label: string }> = {
  sedentario: { factor: 1.2, label: 'Sedentario (ufficio, poco movimento)' },
  leggero: { factor: 1.375, label: 'Leggero (sport 1–3 volte a settimana)' },
  moderato: { factor: 1.55, label: 'Moderato (sport 3–5 volte)' },
  attivo: { factor: 1.725, label: 'Attivo (sport 6–7 volte)' },
  molto: { factor: 1.9, label: 'Molto attivo (lavoro fisico + sport)' },
};

export const GOAL: Record<Goal, { factor: number; label: string }> = {
  perdere: { factor: 0.85, label: 'Perdere grasso (−15%)' },
  mantenere: { factor: 1, label: 'Mantenere' },
  aumentare: { factor: 1.1, label: 'Aumentare massa (+10%)' },
};

/** Metabolismo basale, formula di Mifflin–St Jeor. */
export function bmr(b: Body): number {
  const base = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age;
  return b.sex === 'm' ? base + 5 : base - 161;
}

/** Fabbisogno giornaliero: basale × attività. */
export function tdee(b: Body, a: Activity): number {
  return bmr(b) * ACTIVITY[a].factor;
}

/** Calorie della giornata secondo l'obiettivo, arrotondate a 50 kcal. */
export function targetKcal(b: Body, a: Activity, g: Goal): number {
  return Math.round((tdee(b, a) * GOAL[g].factor) / 50) * 50;
}

/** Blocchi della giornata, al mezzo blocco. */
export function kcalToBlocks(kcal: number): number {
  return Math.round((kcal / BLOCK_KCAL) * 2) / 2;
}
