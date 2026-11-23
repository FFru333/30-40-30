import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../../data/seed-foods';
import { DEFAULT_TOLERANCE, dietAllows } from '../profile/types';
import { plans } from './plan';

const byId = new Map(SEED_FOODS.map((f) => [f.id, f]));
const lookup = (id: string) => byId.get(id);
const tol = DEFAULT_TOLERANCE;
const pescetarian = SEED_FOODS.filter((f) => dietAllows('pescetariano', f.diet));

describe('piano di bilanciamento', () => {
  it('pizza intera: gli altri macro si adattano (tanto tonno), niente viene tolto', () => {
    const ps = plans({ items: [{ foodId: 'pizza-margherita', grams: 330 }], lookup, targetBlocks: 3, tolerance: tol, pool: pescetarian });
    const adapt = ps.find((p) => p.kind === 'adapt')!;
    expect(adapt).toBeDefined();
    expect(adapt.after.inZone).toBe(true);
    expect(adapt.targetBlocks).toBeGreaterThan(10);
    expect(adapt.changes.every((c) => c.deltaGrams > 0)).toBe(true);
    // la pizza resta intera
    expect(adapt.items.find((i) => i.foodId === 'pizza-margherita')?.grams).toBe(330);
    // una fonte proteica magra, in quantità importante
    const protein = adapt.changes[0]!;
    expect(lookup(protein.foodId)!.per100.protein).toBeGreaterThan(15);
    expect(protein.deltaGrams).toBeGreaterThan(120);
  });

  it('pizza: in alternativa resta nei blocchi del profilo riducendo la pizza', () => {
    const ps = plans({ items: [{ foodId: 'pizza-margherita', grams: 330 }], lookup, targetBlocks: 3, tolerance: tol, pool: pescetarian });
    const fit = ps.find((p) => p.kind === 'fit')!;
    expect(fit.targetBlocks).toBe(3);
    expect(fit.after.inZone).toBe(true);
    expect(fit.items.find((i) => i.foodId === 'pizza-margherita')!.grams).toBeLessThan(330);
  });

  it('mancano solo carboidrati: un piano "fill" che chiude tutto', () => {
    const ps = plans({ items: [{ foodId: 'planted-kebab', grams: 125 }], lookup, targetBlocks: 4, tolerance: tol, pool: SEED_FOODS });
    expect(ps).toHaveLength(1);
    expect(ps[0]!.kind).toBe('fill');
    expect(ps[0]!.after.inZone).toBe(true);
  });

  it('piatto vuoto o già in Zona: nessun piano', () => {
    expect(plans({ items: [], lookup, targetBlocks: 4, tolerance: tol, pool: SEED_FOODS })).toEqual([]);
  });

  it('esclusioni: "prova un altro" non ripropone lo stesso alimento', () => {
    const base = plans({ items: [{ foodId: 'planted-kebab', grams: 125 }], lookup, targetBlocks: 4, tolerance: tol, pool: SEED_FOODS })[0]!;
    const first = base.changes[0]!.foodId;
    const alt = plans({
      items: [{ foodId: 'planted-kebab', grams: 125 }],
      lookup,
      targetBlocks: 4,
      tolerance: tol,
      pool: SEED_FOODS,
      exclude: new Set([first]),
    })[0]!;
    expect(alt.changes.map((c) => c.foodId)).not.toContain(first);
  });
});
