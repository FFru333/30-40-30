import type { Tolerance } from '../profile/types';
import { GRAMS_PER_BLOCK, MACROS, targetGrams, type Macro, type MacroGrams } from './blocks';

export type MacroState = 'ok' | 'low' | 'high';

export interface MacroStatus {
  macro: Macro;
  grams: number;
  targetGrams: number;
  blocks: number;
  targetBlocks: number;
  /** Raggiunto − target, in blocchi (negativo = manca). */
  deltaBlocks: number;
  deltaGrams: number;
  tolerance: number;
  state: MacroState;
}

export interface ZoneStatus {
  targetBlocks: number;
  macros: Record<Macro, MacroStatus>;
  inZone: boolean;
  /** Macro più lontano dalla tolleranza, se fuori Zona. */
  worst: MacroStatus | null;
}

const EPS = 1e-9;

export function evaluate(totals: MacroGrams, targetBlocks: number, tol: Tolerance): ZoneStatus {
  const target = targetGrams(targetBlocks);
  const macros = {} as Record<Macro, MacroStatus>;
  let worst: MacroStatus | null = null;
  let worstExcess = 0;

  for (const m of MACROS) {
    const blocks = totals[m] / GRAMS_PER_BLOCK[m];
    const deltaBlocks = blocks - targetBlocks;
    const t = tol[m];
    const state: MacroState =
      deltaBlocks < -t - EPS ? 'low' : deltaBlocks > t + EPS ? 'high' : 'ok';
    const s: MacroStatus = {
      macro: m,
      grams: totals[m],
      targetGrams: target[m],
      blocks,
      targetBlocks,
      deltaBlocks,
      deltaGrams: totals[m] - target[m],
      tolerance: t,
      state,
    };
    macros[m] = s;
    const excess = Math.abs(deltaBlocks) - t;
    if (state !== 'ok' && excess > worstExcess) {
      worstExcess = excess;
      worst = s;
    }
  }

  return { targetBlocks, macros, inZone: worst === null, worst };
}
