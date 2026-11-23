import type { Macro } from '../domain/zone/blocks';

const nf1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const nf1f = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

/** 1 decimale, senza zeri inutili: 4 / 3,9 / 27,5 */
export const n1 = (x: number) => nf1.format(Math.abs(x) < 0.05 ? 0 : x);
/** 1 decimale sempre: 4,0 */
export const n1f = (x: number) => nf1f.format(Math.abs(x) < 0.05 ? 0 : x);
export const n0 = (x: number) => nf0.format(x);
export const pct = (x: number) => `${nf0.format(x * 100)}%`;
/** Con segno esplicito: +1,5 / −0,5 */
export const signed = (x: number) => {
  const v = Math.abs(x) < 0.05 ? 0 : x;
  return v > 0 ? `+${nf1.format(v)}` : v < 0 ? `−${nf1.format(-v)}` : '0';
};

export const MACRO_LABEL: Record<Macro, string> = {
  protein: 'Proteine',
  carbs: 'Carboidrati',
  fat: 'Grassi',
};

export const MACRO_SHORT: Record<Macro, string> = { protein: 'P', carbs: 'C', fat: 'G' };

/** "di proteine", "di carboidrati", "di grassi" */
export const MACRO_OF: Record<Macro, string> = {
  protein: 'di proteine',
  carbs: 'di carboidrati',
  fat: 'di grassi',
};

export const blocchi = (x: number) => (Math.abs(Math.abs(x) - 1) < 0.05 ? 'blocco' : 'blocchi');
