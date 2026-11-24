import type { Food, Ingredient } from '../food/types';
import type { Tolerance } from '../profile/types';
import { MACROS } from './blocks';
import { balance } from './balance';
import { totalsWith, type FoodLookup } from './meal';
import type { MacroGrams } from './blocks';
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
  kind: 'adapt' | 'fit' | 'fill' | 'close';
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
  /** Macro già mangiati oggi: contano nel bilancio ma non si toccano. */
  base?: MacroGrams;
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
  for (let step = 0; step < 10; step++) {
    const s = evaluate(totalsWith(cur, lookup, input.base), target, input.tolerance);
    if (s.inZone) break;
    const all = balance({ items: cur, lookup, targetBlocks: target, tolerance: input.tolerance, pool, maxOptions: 3, base: input.base });
    // Prima le proteine, poi i carboidrati, i grassi per ultimi: le fonti proteiche
    // portano anche grasso, e l'olio si dosa meglio alla fine.
    const order = ['protein', 'carbs', 'fat'];
    const adds = all.filter((a) => a.direction === 'add').sort((x, y) => order.indexOf(x.macro) - order.indexOf(y.macro));
    const a = adds[0];
    const opt = a?.options.find((o) => !protect.has(o.foodId) || o.currentGrams > 0);
    if (a && opt) {
      cur = applyDelta(cur, opt.foodId, opt.grams);
      continue;
    }
    // Niente da aggiungere ma qualcosa sfora: riduci ciò che il piano ha appena aggiunto.
    const cut = all.find((x) => x.direction === 'remove')?.options.find((o) => !items.some((i) => i.foodId === o.foodId));
    if (!cut) break;
    cur = applyDelta(cur, cut.foodId, -cut.grams);
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
  const status = evaluate(totalsWith(items, lookup, input.base), n, tolerance);
  if (status.inZone) return [];
  const out: Plan[] = [];
  const protect = new Set<string>();

  const highest = Math.max(...MACROS.map((m) => status.macros[m].blocks));
  const anyHigh = MACROS.some((m) => status.macros[m].state === 'high');

  const make = (kind: Plan['kind'], target: number, next: Ingredient[]) => {
    const after = evaluate(totalsWith(next, lookup, input.base), target, tolerance);
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
      const s = evaluate(totalsWith(cur, lookup, input.base), n, tolerance);
      const high = MACROS.map((m) => s.macros[m]).filter((x) => x.state === 'high');
      if (!high.length) break;
      const adv = balance({ items: cur, lookup, targetBlocks: n, tolerance, pool: [], maxOptions: 1, base: input.base }).find(
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

export interface PlanGroup {
  kind: Plan['kind'];
  targetBlocks: number;
  /** Varianti diverse dello stesso piano (alimento principale diverso). */
  variants: Plan[];
}

/**
 * Più modi di controbilanciare: per ogni strategia fino a `n` varianti, ognuna con
 * un alimento principale diverso (tonno, poi gamberi, poi uova…).
 */
export function planGroups(input: PlanInput, n = 3, gen: (i: PlanInput) => Plan[] = plans): PlanGroup[] {
  const first = gen(input);
  return first.map((p0) => {
    const variants: Plan[] = [p0];
    const seen = new Set([signature(p0)]);
    const ex = new Set(input.exclude ?? []);
    let prev = p0;
    for (let i = 1; i < n; i++) {
      const main = prev.changes.find((c) => c.deltaGrams > 0 && !input.items.some((it) => it.foodId === c.foodId));
      if (!main) break;
      ex.add(main.foodId);
      // Varietà vera: dopo "Tonno al naturale" non proporre "Tonno fresco".
      const head = main.foodName.split(/[\s(]/)[0]!.toLowerCase();
      for (const f of input.pool) if (f.name.split(/[\s(]/)[0]!.toLowerCase() === head) ex.add(f.id);
      const next = gen({ ...input, exclude: ex }).find((p) => p.kind === p0.kind);
      if (!next || !next.after.inZone || seen.has(signature(next))) break;
      seen.add(signature(next));
      variants.push(next);
      prev = next;
    }
    return { kind: p0.kind, targetBlocks: p0.targetBlocks, variants };
  });
}

/**
 * Piani sulla giornata: `base` è quanto già mangiato, `items` il piatto di adesso.
 * - `adapt` (Bilancia): aggiungi al piatto ciò che serve perché i tre macro della
 *   giornata si allineino al più alto. Niente viene tolto.
 * - `close`: un pasto bilanciato da `mealBlocks` blocchi in più; se arriva al budget
 *   chiude la giornata.
 */
export function dayPlans(input: PlanInput & { budget: number; mealBlocks?: number }): Plan[] {
  const { items, lookup, tolerance, budget } = input;
  const totals = totalsWith(items, lookup, input.base);
  const level = Math.max(totals.protein / 7, totals.carbs / 9, totals.fat / 3);
  const out: Plan[] = [];
  const protect = new Set<string>();
  const make = (kind: Plan['kind'], target: number, next: Ingredient[]) => {
    const after = evaluate(totalsWith(next, lookup, input.base), target, tolerance);
    const changes = diff(items, next, lookup);
    if (changes.length) out.push({ kind, targetBlocks: target, changes, items: next, after });
  };
  const now = evaluate(totals, level, tolerance);
  if (!now.inZone && level > 0) {
    const t = roundUpHalf(level);
    make('adapt', t, fillUp(input, items, t, lookup, protect));
  }
  // Un pasto bilanciato di dimensione normale; se basta a finire il budget, chiude la giornata.
  const step = input.mealBlocks ?? budget;
  const goal = Math.min(budget, roundUpHalf(level) + step);
  if (goal - level >= 1) make('close', goal, fillUp(input, items, goal, lookup, protect));
  return out;
}

function signature(p: Plan): string {
  return p.changes.map((c) => `${c.foodId}:${Math.round(c.deltaGrams)}`).join('|');
}
