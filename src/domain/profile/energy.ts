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

/* ---------- Metodo Zona (Sears): blocchi dalla massa magra ---------- */

/** Indice di attività: grammi di proteine al giorno per kg di massa magra. */
export const ZONE_ACTIVITY: { value: number; label: string }[] = [
  { value: 1.1, label: '1,1 · Sedentario puro' },
  { value: 1.3, label: '1,3 · Lavoro tranquillo, niente sport regolare' },
  { value: 1.5, label: '1,5 · Fitness leggero' },
  { value: 1.7, label: '1,7 · Allenamento 3+ volte a settimana' },
  { value: 1.9, label: '1,9 · Allenamento quotidiano (aerobico o pesi)' },
  { value: 2.1, label: '2,1 · Allenamento pesante quotidiano' },
  { value: 2.3, label: '2,3 · Agonismo' },
];

/** Minimo di blocchi al giorno: sotto la dieta diventa troppo ipocalorica. */
export const MIN_ZONE_BLOCKS = 11;

/**
 * Stima della percentuale di grasso dalle circonferenze (formula US Navy).
 * Uomo: vita e collo. Donna: vita, fianchi e collo. Misure in cm. Null se le misure non tornano.
 */
export function navyBodyFat(sex: Sex, heightCm: number, waistCm: number, neckCm: number, hipsCm?: number): number | null {
  const log = Math.log10;
  if (sex === 'm') {
    if (waistCm - neckCm <= 0) return null;
    const bf = 495 / (1.0324 - 0.19077 * log(waistCm - neckCm) + 0.15456 * log(heightCm)) - 450;
    return bf > 2 && bf < 60 ? bf : null;
  }
  if (!hipsCm || waistCm + hipsCm - neckCm <= 0) return null;
  const bf = 495 / (1.29579 - 0.35004 * log(waistCm + hipsCm - neckCm) + 0.221 * log(heightCm)) - 450;
  return bf > 5 && bf < 65 ? bf : null;
}

export interface ZoneCalc {
  leanKg: number;
  proteinG: number;
  /** Blocchi al giorno, interi, mai sotto il minimo. */
  blocks: number;
}

/** Massa magra × indice di attività = proteine al giorno; diviso 7 = blocchi. */
export function zoneBlocks(weightKg: number, bodyFatPct: number, activityIndex: number): ZoneCalc {
  const leanKg = weightKg * (1 - bodyFatPct / 100);
  const proteinG = leanKg * activityIndex;
  return { leanKg, proteinG, blocks: Math.max(MIN_ZONE_BLOCKS, Math.round(proteinG / 7)) };
}

/**
 * Distribuzione dei blocchi nella giornata: spuntini da 1 (2 se i blocchi sono tanti),
 * il resto diviso tra i pasti, con l'eventuale avanzo al pranzo e poi alla cena.
 * Ordine: colazione, spuntino, pranzo, spuntino, cena (con 3 pasti e 2 spuntini).
 */
export function distribute(blocks: number, meals = 3, snacks = 2): { name: string; blocks: number; snack: boolean }[] {
  // Come le tabelle di Sears/CrossFit: spuntini da 1 se i pasti tornano pari, altrimenti da 2 se così tornano.
  const even = (sb: number) => Number.isInteger((blocks - snacks * sb) / meals);
  const snackBl = snacks === 0 ? 0 : even(1) ? 1 : even(2) && blocks - snacks * 2 >= meals * 2 ? 2 : 1;
  const rest = Math.max(0, blocks - snacks * snackBl);
  const base = Math.floor((rest / meals) * 2) / 2;
  const mealBl = Array.from({ length: meals }, () => base);
  let left = Math.round((rest - base * meals) * 2) / 2;
  const order = meals >= 3 ? [1, 2, 0] : Array.from({ length: meals }, (_, i) => i);
  for (let k = 0; left > 0; k++) {
    const i = order[k % order.length]!;
    const add = Math.min(0.5, left);
    mealBl[i]! += add;
    left = Math.round((left - add) * 2) / 2;
  }
  const mealNames = meals === 3 ? ['Colazione', 'Pranzo', 'Cena'] : Array.from({ length: meals }, (_, i) => `Pasto ${i + 1}`);
  const out: { name: string; blocks: number; snack: boolean }[] = [];
  for (let i = 0; i < meals; i++) {
    out.push({ name: mealNames[i]!, blocks: mealBl[i]!, snack: false });
    if (i < snacks && i < meals - 1) out.push({ name: 'Spuntino', blocks: snackBl, snack: true });
  }
  for (let j = Math.max(0, meals - 1); j < snacks; j++) out.push({ name: 'Spuntino', blocks: snackBl, snack: true });
  return out;
}
