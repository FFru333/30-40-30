import type { Food, Ingredient } from '../food/types';
import type { Tolerance } from '../profile/types';
import { MACROS } from './blocks';
import { balance } from './balance';
import { mealTotals, type FoodLookup } from './meal';
import { evaluate, type ZoneStatus } from './status';

export interface PlanChange {
  foodId: string;
  foodName: string;
  /** Grammi da aggiungere (positivi) o togliere (negativi). */
  deltaGrams: number;
  /** Grammi dell'alimento nel piatto dopo il piano. */
  newGrams: number;
  portionHint?: string;
}

export interface Plan {
  /**
   * `adapt`: nessun alimento viene tolto, gli altri macro crescono fino al più alto
   *          (la pizza resta intera, si aggiunge tonno).
   * `fit`:   il piatto resta nei blocchi del profilo: si riduce ciò che eccede, poi si completa.
   * `fill`:  nessun eccesso, si completa ciò che manca.
   */
  kind: 'adapt' | 'fit' | 'fill';
  targetBlocks: number;
  changes: PlanChange[];
  items: Ingredient[];
  after: ZoneStatus;
}

export interface PlanInput {
  items: Ingredient[];
  lookup: FoodLookup;
  targetBlocks: number;
  tolerance: Tolerance;
  pool: Food[];
  /** Alimenti da non proporre (es. "prova un'altra opzione"). */
  exclude?: Set<string>;
}

const roundUpHalf = (x: number) => Math.ceil(x * 2 - 1e-9) / 2;

function applyDelta(items: Ingredient[], foodId: string, delta: number): Ingredient[] {
  const i = items.findIndex((x) => x.foodId === foodId);
  if (i < 0) return delta > 0 ? [...items, { foodId, grams: delta }] : items;
  const g = items[i]!.grams + delta;
  return g <= 0.0001 ? items.filter((_, j) => j !== i) : items.map((x, j) => (j === i ? { ...x, grams: g } : x));
}

/** Aggiunge, un macro alla volta, ciò che manca per arrivare a `target`. */
function fillUp(input: PlanInput, items: Ingredient[], target: number, lookup: FoodLookup, protect: Set<string>) {
  const pool = input.pool.filter((f) => !input.exclude?.has(f.id));
  let cur = items;
  for (let step = 0; step < 4; step++) {
    const s = evaluate(mealTotals(cur, lookup), target, input.tolerance);
    if (s.inZone) break;
    const adv = balance({ items: cur, lookup, targetBlocks: target, tolerance: input.tolerance, pool, maxOptions: 3 })
      .filter((a) => a.direction === 'add');
    // Prima le proteine, poi i carboidrati, i grassi per ultimi: le fonti proteiche
    // portano anche grasso, e l'olio si dosa meglio alla fine.
    const order = ['protein', 'carbs', 'fat'];
    const a = [...adv].sort((x, y) => order.indexOf(x.macro) - order.indexOf(y.macro))[0];
    const opt = a?.options.find((o) => !protect.has(o.foodId) || o.currentGrams > 0);
    if (!a || !opt) break;
    cur = applyDelta(cur, opt.foodId, opt.grams);
  }
  return cur;
}

function diff(before: Ingredient[], after: Ingredient[], lookup: FoodLookup): PlanChange[] {
  const ids = new Set([...before, ...after].map((i) => i.foodId));
  const sum = (xs: Ingredient[], id: string) => xs.filter((x) => x.foodId === id).reduce((a, x) => a + x.grams, 0);
  const out: PlanChange[] = [];
  for (const id of ids) {
    const d = sum(after, id) - sum(before, id);
    if (Math.abs(d) < 0.5) continue;
    const f = lookup(id);
    let portionHint: string | undefined;
    if (f?.portion && d > 0) {
      const n = d / f.portion.grams;
      const r = Math.round(n * 2) / 2;
      if (r >= 1 && Math.abs(n - r) <= 0.12) portionHint = `${r === 1 ? '' : `${String(r).replace('.', ',')} × `}${f.portion.label}`;
    }
    out.push({ foodId: id, foodName: f?.name ?? id, deltaGrams: d, newGrams: sum(after, id), portionHint });
  }
  // Prima le aggiunte, poi le riduzioni.
  return out.sort((a, b) => b.deltaGrams - a.deltaGrams);
}

/**
 * Piani per bilanciare il piatto in un solo gesto.
 * - Se un macro è in eccesso: `adapt` (gli altri crescono fino a lui) e `fit` (si resta nei blocchi).
 * - Altrimenti: `fill` (si completa ciò che manca).
 * Restituisce solo piani che cambiano qualcosa.
 */
export function plans(input: PlanInput): Plan[] {
  const { items, lookup, targetBlocks: n, tolerance } = input;
  if (items.length === 0) return [];
  const status = evaluate(mealTotals(items, lookup), n, tolerance);
  if (status.inZone) return [];
  const out: Plan[] = [];
  const protect = new Set<string>();

  const highest = Math.max(...MACROS.map((m) => status.macros[m].blocks));
  const anyHigh = MACROS.some((m) => status.macros[m].state === 'high');

  const make = (kind: Plan['kind'], target: number, next: Ingredient[]) => {
    const after = evaluate(mealTotals(next, lookup), target, tolerance);
    const changes = diff(items, next, lookup);
    if (changes.length) out.push({ kind, targetBlocks: target, changes, items: next, after });
  };

  if (anyHigh) {
    // Gli altri si adattano al macro più alto: niente viene tolto.
    const t = roundUpHalf(highest); // il macro più alto, arrotondato al mezzo blocco sopra
    make('adapt', t, fillUp(input, items, t, lookup, protect));

    // Resta nei blocchi: riduci ciò che eccede, poi completa.
    let cur = items;
    for (let step = 0; step < 3; step++) {
      const s = evaluate(mealTotals(cur, lookup), n, tolerance);
      const high = MACROS.map((m) => s.macros[m]).filter((x) => x.state === 'high');
      if (!high.length) break;
      const adv = balance({ items: cur, lookup, targetBlocks: n, tolerance, pool: [], maxOptions: 1 }).find(
        (a) => a.direction === 'remove',
      );
      const opt = adv?.options[0];
      if (!opt) break;
      cur = applyDelta(cur, opt.foodId, -opt.grams);
    }
    make('fit', n, fillUp(input, cur, n, lookup, protect));
  } else {
    make('fill', n, fillUp(input, items, n, lookup, protect));
  }
  return out;
}
