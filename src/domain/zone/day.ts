import type { Ingredient } from '../food/types';
import type { Tolerance } from '../profile/types';
import { MACROS, gramsToBlocks, type MacroGrams } from './blocks';
import { mealTotals, type FoodLookup } from './meal';
import { evaluate, type ZoneStatus } from './status';

export interface LoggedMeal {
  id: string;
  /** Ora di registrazione, ISO. */
  at: string;
  items: Ingredient[];
}

export interface DayLog {
  /** `${profileId}:${YYYY-MM-DD}` */
  id: string;
  profileId: string;
  date: string;
  meals: LoggedMeal[];
}

export const dayId = (profileId: string, date: string) => `${profileId}:${date}`;

/** Data locale YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function sumGrams(a: MacroGrams, b: MacroGrams): MacroGrams {
  return { protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat };
}

export const ZERO: MacroGrams = { protein: 0, carbs: 0, fat: 0 };

/** Macro di tutti i pasti registrati. */
export function eatenTotals(meals: LoggedMeal[], lookup: FoodLookup): MacroGrams {
  return meals.reduce((acc, m) => {
    const t = mealTotals(m.items, lookup);
    return sumGrams(acc, { protein: t.protein, carbs: t.carbs, fat: t.fat });
  }, ZERO);
}

/** Tolleranza della giornata: il doppio di quella del pasto, almeno 1 blocco. */
export function dayTolerance(t: Tolerance): Tolerance {
  return { protein: Math.max(1, t.protein * 2), carbs: Math.max(1, t.carbs * 2), fat: Math.max(1, t.fat * 2) };
}

export interface DayStatus {
  /** Blocchi "occupati": il macro più alto comanda (un pasto da 8 C e 4 P vale 8). */
  used: number;
  budget: number;
  left: number;
  /** I tre macro sono allineati tra loro (rispetto al più alto). */
  balance: ZoneStatus;
  overBudget: boolean;
}

/**
 * Stato della giornata. Si può mangiare di tutto: conta che a fine giornata
 * proteine, carboidrati e grassi abbiano gli stessi blocchi, dentro il budget.
 */
export function dayStatus(totals: MacroGrams, budget: number, tol: Tolerance): DayStatus {
  const b = gramsToBlocks(totals);
  const used = Math.max(...MACROS.map((m) => b[m]));
  return {
    used,
    budget,
    left: budget - used,
    balance: evaluate(totals, used, dayTolerance(tol)),
    overBudget: used > budget + 0.25,
  };
}
