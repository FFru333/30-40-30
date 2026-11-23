import type { CarbBasis, Nutrients } from '../food/types';

/** Grammi di proteine in un blocco proteico. */
export const PROTEIN_PER_BLOCK = 7;
/** Grammi di carboidrati netti in un blocco di carboidrati. */
export const CARBS_PER_BLOCK = 9;
/** Grammi di grassi TOTALI per blocco Zona completo (usato nei calcoli). */
export const FAT_PER_BLOCK = 3;
/** "Blocco di grassi" da 1,5 g: solo valore secondario, mai nei calcoli. */
export const FAT_MINI_BLOCK = 1.5;

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export type Macro = 'protein' | 'carbs' | 'fat';
export const MACROS: Macro[] = ['protein', 'carbs', 'fat'];

export const GRAMS_PER_BLOCK: Record<Macro, number> = {
  protein: PROTEIN_PER_BLOCK,
  carbs: CARBS_PER_BLOCK,
  fat: FAT_PER_BLOCK,
};

/** Ripartizione calorica teorica di un blocco: 28 + 36 + 27 kcal. */
export const ZONE_KCAL_SPLIT: Record<Macro, number> = (() => {
  const p = PROTEIN_PER_BLOCK * KCAL_PER_G.protein;
  const c = CARBS_PER_BLOCK * KCAL_PER_G.carbs;
  const f = FAT_PER_BLOCK * KCAL_PER_G.fat;
  const t = p + c + f;
  return { protein: p / t, carbs: c / t, fat: f / t };
})();

/**
 * Carboidrati netti per 100 g.
 * Le etichette UE riportano già i carboidrati disponibili (fibre escluse):
 * sottrarre le fibre lì le conterebbe due volte.
 */
export function netCarbs(n: Pick<Nutrients, 'carbs' | 'fiber'>, basis: CarbBasis): number {
  if (basis === 'eu') return n.carbs;
  return Math.max(0, n.carbs - n.fiber);
}

export interface MacroGrams {
  protein: number;
  carbs: number;
  fat: number;
}

export function gramsToBlocks(g: MacroGrams): MacroGrams {
  return {
    protein: g.protein / PROTEIN_PER_BLOCK,
    carbs: g.carbs / CARBS_PER_BLOCK,
    fat: g.fat / FAT_PER_BLOCK,
  };
}

/** Target in grammi per un pasto da N blocchi. */
export function targetGrams(blocks: number): MacroGrams {
  return {
    protein: blocks * PROTEIN_PER_BLOCK,
    carbs: blocks * CARBS_PER_BLOCK,
    fat: blocks * FAT_PER_BLOCK,
  };
}

export function fatMiniBlocks(fatGrams: number): number {
  return fatGrams / FAT_MINI_BLOCK;
}
