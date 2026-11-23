import type { Food, Ingredient } from '../food/types';
import type { Tolerance } from '../profile/types';
import { KCAL_PER_G, MACROS, netCarbs, type Macro, type MacroGrams } from './blocks';
import { mealTotals, type FoodLookup } from './meal';
import { evaluate, type MacroState, type ZoneStatus } from './status';

export interface Suggestion {
  foodId: string;
  foodName: string;
  /** Grammi da aggiungere (add) o togliere (remove), sempre positivi. */
  grams: number;
  /** Grammi dell'alimento nel pasto prima della modifica (0 se nuovo). */
  currentGrams: number;
  /** Es. "1 tortilla" quando la quantità corrisponde a porzioni intere. */
  portionHint?: string;
  /** Rimuove del tutto l'alimento dal pasto. */
  removesItem: boolean;
  /** Stato dei tre macro dopo la modifica. */
  after: Record<Macro, MacroState>;
  /** Variazione in blocchi su ciascun macro. */
  effect: MacroGrams;
  inZoneAfter: boolean;
}

export interface Advice {
  macro: Macro;
  direction: 'add' | 'remove';
  /** Blocchi da aggiungere o togliere per arrivare esattamente al target. */
  blocks: number;
  grams: number;
  options: Suggestion[];
}

export interface BalanceInput {
  items: Ingredient[];
  lookup: FoodLookup;
  targetBlocks: number;
  tolerance: Tolerance;
  /** Alimenti che il profilo può mangiare (dieta ed esclusioni già applicate). */
  pool: Food[];
  maxOptions?: number;
}

function macroPer100(food: Food, m: Macro): number {
  return m === 'carbs' ? netCarbs(food.per100, food.carbBasis) : food.per100[m];
}

/** Quota delle kcal dell'alimento che viene dal macro m. */
export function purity(food: Food, m: Macro): number {
  let total = 0;
  let mine = 0;
  for (const x of MACROS) {
    const k = macroPer100(food, x) * KCAL_PER_G[x];
    total += k;
    if (x === m) mine = k;
  }
  return total > 0 ? mine / total : 0;
}

function roundGrams(g: number): number {
  if (g < 20) return Math.max(1, Math.round(g));
  return Math.round(g / 5) * 5;
}

function withChange(items: Ingredient[], foodId: string, deltaGrams: number): Ingredient[] {
  let found = false;
  const out: Ingredient[] = [];
  for (const it of items) {
    if (it.foodId === foodId && !found) {
      found = true;
      const g = it.grams + deltaGrams;
      if (g > 0.0001) out.push({ foodId, grams: g });
    } else out.push(it);
  }
  if (!found && deltaGrams > 0) out.push({ foodId, grams: deltaGrams });
  return out;
}

/**
 * Costo di una modifica, in blocchi: quanto il macro da correggere resta fuori
 * tolleranza, più quanto gli altri macro finiscono SOPRA la tolleranza.
 * Un altro macro che resta basso non penalizza: ha il suo suggerimento.
 */
function cost(s: ZoneStatus, target: Macro): number {
  let x = 0;
  for (const m of MACROS) {
    const d = s.macros[m];
    x += m === target
      ? Math.max(0, Math.abs(d.deltaBlocks) - d.tolerance)
      : Math.max(0, d.deltaBlocks - d.tolerance);
  }
  return x;
}

function portionHint(food: Food, grams: number): string | undefined {
  const p = food.portion;
  if (!p || p.grams <= 0) return undefined;
  const n = grams / p.grams;
  const r = Math.round(n * 2) / 2;
  if (r < 1 || Math.abs(n - r) > 0.12) return undefined;
  const qty = r === 1 ? '' : `${String(r).replace('.', ',')} × `;
  return `${qty}${p.label}`;
}

function evaluateChange(
  input: BalanceInput,
  before: ZoneStatus,
  food: Food,
  delta: number,
  target: Macro,
): { suggestion: Suggestion; score: number } {
  const { items, lookup, targetBlocks, tolerance } = input;
  const nextItems = withChange(items, food.id, delta);
  const look: FoodLookup = (id) => (id === food.id ? food : lookup(id));
  const after = evaluate(mealTotals(nextItems, look), targetBlocks, tolerance);
  const current = items.filter((i) => i.foodId === food.id).reduce((a, i) => a + i.grams, 0);
  const grams = Math.abs(delta);
  const suggestion: Suggestion = {
    foodId: food.id,
    foodName: food.name,
    grams,
    currentGrams: current,
    portionHint: delta > 0 ? portionHint(food, grams) : undefined,
    removesItem: delta < 0 && current + delta <= 0.0001,
    after: {
      protein: after.macros.protein.state,
      carbs: after.macros.carbs.state,
      fat: after.macros.fat.state,
    },
    effect: {
      protein: after.macros.protein.blocks - before.macros.protein.blocks,
      carbs: after.macros.carbs.blocks - before.macros.carbs.blocks,
      fat: after.macros.fat.blocks - before.macros.fat.blocks,
    },
    inZoneAfter: after.inZone,
  };
  return { suggestion, score: cost(after, target) };
}

/**
 * Suggerimenti per bilanciare il pasto: per ogni macro fuori tolleranza,
 * quali alimenti aggiungere (o ridurre) e di quanti grammi per centrare il target.
 * Le opzioni sono ordinate per quanto lasciano il pasto vicino alla Zona.
 */
export function balance(input: BalanceInput): Advice[] {
  const { items, lookup, targetBlocks, tolerance, pool } = input;
  const maxOptions = input.maxOptions ?? 3;
  const status = evaluate(mealTotals(items, lookup), targetBlocks, tolerance);
  const inMeal = new Set(items.map((i) => i.foodId));

  const offenders = MACROS.map((m) => status.macros[m])
    .filter((s) => s.state !== 'ok')
    .sort((a, b) => Math.abs(b.deltaBlocks) - b.tolerance - (Math.abs(a.deltaBlocks) - a.tolerance));

  const advice: Advice[] = [];

  for (const s of offenders) {
    const m = s.macro;
    const needGrams = -s.deltaGrams; // >0 manca, <0 eccesso
    const scored: { suggestion: Suggestion; cost: number; score: number }[] = [];

    if (needGrams > 0) {
      const candidates = new Map<string, Food>();
      for (const f of pool) {
        const minPurity = inMeal.has(f.id) ? 0.4 : 0.55;
        if (f.ingredients && !inMeal.has(f.id)) continue; // i piatti composti non sono "riempitivi"
        if (f.suggest === false && !inMeal.has(f.id)) continue; // zucchero, alcol, salse
        if (macroPer100(f, m) >= 2 && purity(f, m) >= minPurity) candidates.set(f.id, f);
      }
      for (const f of candidates.values()) {
        const density = macroPer100(f, m) / 100;
        let grams = roundGrams(needGrams / density);
        if (grams > 500) continue;
        // Se una porzione intera centra comunque il macro, preferiscila.
        if (f.portion && f.portion.grams > 0) {
          const n = Math.round(grams / f.portion.grams);
          if (n >= 1) {
            const snapped = n * f.portion.grams;
            const probe = evaluateChange(input, status, f, snapped, m);
            if (probe.suggestion.after[m] === 'ok') grams = snapped;
          }
        }
        const r = evaluateChange(input, status, f, grams, m);
        // Preferenze a parità di risultato: ciò che è già nel piatto, alimenti "puri"
        // e quantità piccole (300 g di mela sono meno pratici di 40 g di riso).
        const bias = (inMeal.has(f.id) ? 0 : 0.15) + (1 - purity(f, m)) * 0.3 + grams / 1000;
        scored.push({ suggestion: r.suggestion, cost: r.score, score: r.score + bias });
      }
    } else {
      const excess = -needGrams;
      for (const it of items) {
        const f = lookup(it.foodId);
        if (!f) continue;
        const density = macroPer100(f, m) / 100;
        if (density <= 0) continue;
        const grams = Math.min(it.grams, roundGrams(excess / density));
        const r = evaluateChange(input, status, f, -grams, m);
        const bias = (1 - purity(f, m)) * 0.3;
        scored.push({ suggestion: r.suggestion, cost: r.score, score: r.score + bias });
      }
    }

    scored.sort((a, b) => a.score - b.score || a.suggestion.grams - b.suggestion.grams);
    // Non mostrare opzioni nettamente peggiori della migliore (es. che sforano un altro macro).
    const best = Math.min(...scored.map((x) => x.cost));
    const kept = scored.filter((x) => x.cost <= best + 0.01);
    advice.push({
      macro: m,
      direction: needGrams > 0 ? 'add' : 'remove',
      blocks: Math.abs(s.deltaBlocks),
      grams: Math.abs(s.deltaGrams),
      options: kept.slice(0, maxOptions).map((x) => x.suggestion),
    });
  }

  return advice;
}
