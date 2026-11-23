import { describe, expect, it } from 'vitest';
import type { Food, Ingredient } from '../food/types';
import { DEFAULT_TOLERANCE, dailyBlocks, dietAllows, type Profile } from '../profile/types';
import { SEED_FOODS, PLANTED_KEBAB } from '../../data/seed-foods';
import { buildComposite } from '../food/composite';
import {
  ZONE_KCAL_SPLIT,
  fatMiniBlocks,
  gramsToBlocks,
  netCarbs,
  targetGrams,
} from './blocks';
import { foodMacros, kcalSplit, mealTotals } from './meal';
import { evaluate } from './status';
import { balance } from './balance';

const byId = new Map(SEED_FOODS.map((f) => [f.id, f]));
const lookup = (id: string) => byId.get(id);
const tol = DEFAULT_TOLERANCE;

describe('blocchi', () => {
  it('pasto da 4 blocchi = 28 g P, 36 g C, 12 g G', () => {
    expect(targetGrams(4)).toEqual({ protein: 28, carbs: 36, fat: 12 });
  });

  it('pasto da 3 blocchi = 21 g P, 27 g C, 9 g G', () => {
    expect(targetGrams(3)).toEqual({ protein: 21, carbs: 27, fat: 9 });
  });

  it('converte grammi in blocchi', () => {
    expect(gramsToBlocks({ protein: 28, carbs: 36, fat: 12 })).toEqual({ protein: 4, carbs: 4, fat: 4 });
  });

  it('il grasso in blocchi da 1,5 g è il doppio dei blocchi da 3 g', () => {
    expect(fatMiniBlocks(12)).toBe(8);
  });

  it('ripartizione teorica ~31/40/30 (28 + 36 + 27 kcal)', () => {
    expect(ZONE_KCAL_SPLIT.protein).toBeCloseTo(28 / 91, 10);
    expect(ZONE_KCAL_SPLIT.carbs).toBeCloseTo(36 / 91, 10);
    expect(ZONE_KCAL_SPLIT.fat).toBeCloseTo(27 / 91, 10);
  });
});

describe('carboidrati netti', () => {
  it('etichetta UE: i carboidrati sono già netti, le fibre non si sottraggono', () => {
    expect(netCarbs({ carbs: 2.7, fiber: 4.2 }, 'eu')).toBe(2.7);
  });

  it('etichetta USA: carboidrati totali meno fibre', () => {
    expect(netCarbs({ carbs: 20, fiber: 5 }, 'us_total')).toBe(15);
  });

  it('etichetta USA: mai negativi', () => {
    expect(netCarbs({ carbs: 2, fiber: 5 }, 'us_total')).toBe(0);
  });
});

describe('totali del pasto', () => {
  it('planted kebab 125 g: 27,5 g P, grasso totale contato', () => {
    const t = mealTotals([{ foodId: 'planted-kebab', grams: 125 }], lookup);
    expect(t.protein).toBeCloseTo(27.5, 6);
    expect(t.fat).toBeCloseTo(12.5, 6);
    expect(t.carbs).toBeCloseTo(3.375, 6);
    expect(t.missing).toEqual([]);
  });

  it('somma più alimenti', () => {
    const items: Ingredient[] = [
      { foodId: 'planted-kebab', grams: 100 },
      { foodId: 'olio-evo', grams: 10 },
    ];
    const t = mealTotals(items, lookup);
    expect(t.protein).toBeCloseTo(22, 6);
    expect(t.fat).toBeCloseTo(10 + 9.99, 6);
  });

  it('segnala gli alimenti mancanti senza rompersi', () => {
    const t = mealTotals([{ foodId: 'non-esiste', grams: 50 }], lookup);
    expect(t.missing).toEqual(['non-esiste']);
    expect(t.protein).toBe(0);
  });

  it('ripartizione calorica dai macro, non dalle kcal in etichetta', () => {
    const s = kcalSplit({ protein: 28, carbs: 36, fat: 12 });
    expect(s.protein + s.carbs + s.fat).toBeCloseTo(1, 10);
    expect(s.protein).toBeCloseTo(112 / 364, 10);
    expect(s.fat).toBeCloseTo(108 / 364, 10);
  });

  it('pasto vuoto: ripartizione a zero', () => {
    expect(kcalSplit({ protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe('stato Zona', () => {
  it('esattamente sul target: in Zona', () => {
    const s = evaluate({ protein: 28, carbs: 36, fat: 12 }, 4, tol);
    expect(s.inZone).toBe(true);
    expect(s.worst).toBeNull();
  });

  it('sul bordo della tolleranza (±0,5 blocchi): ancora in Zona', () => {
    const s = evaluate({ protein: 28 + 3.5, carbs: 36 - 4.5, fat: 12 + 1.5 }, 4, tol);
    expect(s.inZone).toBe(true);
  });

  it('oltre la tolleranza: fuori Zona, con il macro peggiore', () => {
    const s = evaluate({ protein: 28, carbs: 18, fat: 12 }, 4, tol);
    expect(s.inZone).toBe(false);
    expect(s.macros.carbs.state).toBe('low');
    expect(s.macros.carbs.deltaBlocks).toBeCloseTo(-2, 10);
    expect(s.worst?.macro).toBe('carbs');
  });

  it('tolleranza per singolo macro', () => {
    const s = evaluate({ protein: 28, carbs: 36, fat: 14 }, 4, { protein: 0.5, carbs: 0.5, fat: 1 });
    expect(s.macros.fat.state).toBe('ok');
  });

  it('criterio MVP: kebab 125 g su 4 blocchi, mancano ~3,6 blocchi di carboidrati', () => {
    const t = mealTotals([{ foodId: 'planted-kebab', grams: 125 }], lookup);
    const s = evaluate(t, 4, tol);
    expect(s.macros.protein.state).toBe('ok');
    expect(s.macros.fat.state).toBe('ok');
    expect(s.macros.carbs.state).toBe('low');
    expect(-s.macros.carbs.deltaBlocks).toBeCloseTo((36 - 3.375) / 9, 6);
  });

  it('criterio MVP: stesso pasto, profili diversi, scostamenti diversi', () => {
    const t = mealTotals([{ foodId: 'planted-kebab', grams: 125 }], lookup);
    const luca = evaluate(t, 4, tol);
    const marina = evaluate(t, 3, tol);
    expect(luca.macros.protein.state).toBe('ok');
    expect(marina.macros.protein.state).toBe('high');
    expect(marina.macros.fat.state).toBe('high');
    expect(luca.macros.carbs.deltaGrams).not.toBe(marina.macros.carbs.deltaGrams);
  });
});

describe('bilanciamento', () => {
  const pool = SEED_FOODS;

  it('mancano carboidrati: propone alimenti ricchi di carboidrati che chiudono il gap', () => {
    const advice = balance({
      items: [{ foodId: 'planted-kebab', grams: 125 }],
      lookup,
      targetBlocks: 4,
      tolerance: tol,
      pool,
    });
    expect(advice).toHaveLength(1);
    const a = advice[0]!;
    expect(a.macro).toBe('carbs');
    expect(a.direction).toBe('add');
    expect(a.options.length).toBeGreaterThan(0);
    for (const o of a.options) {
      expect(o.after.carbs).toBe('ok');
      expect(o.inZoneAfter).toBe(true);
    }
  });

  it('troppi grassi: propone di ridurre l’olio', () => {
    const advice = balance({
      items: [
        { foodId: 'pollo', grams: 120 },
        { foodId: 'riso-cotto', grams: 130 },
        { foodId: 'olio-evo', grams: 20 },
      ],
      lookup,
      targetBlocks: 4,
      tolerance: tol,
      pool,
    });
    const fat = advice.find((a) => a.macro === 'fat');
    expect(fat?.direction).toBe('remove');
    expect(fat?.options[0]?.foodId).toBe('olio-evo');
    expect(fat?.options[0]?.after.fat).toBe('ok');
  });

  it('pasto in Zona: nessun suggerimento', () => {
    const advice = balance({
      items: [{ foodId: 'x', grams: 100 }],
      lookup: (): Food => ({
        id: 'x',
        name: 'Blocco perfetto',
        per100: { kcal: 0, protein: 28, carbs: 36, fiber: 0, fat: 12 },
        carbBasis: 'eu',
        diet: 'vegano',
        source: 'stima',
      }),
      targetBlocks: 4,
      tolerance: tol,
      pool: [],
    });
    expect(advice).toEqual([]);
  });

  it('rispetta il pool: con un pool vegano non propone pesce o carne', () => {
    const vegan = pool.filter((f) => f.diet === 'vegano');
    const advice = balance({ items: [], lookup, targetBlocks: 3, tolerance: tol, pool: vegan });
    for (const a of advice) for (const o of a.options) expect(lookup(o.foodId)?.diet).toBe('vegano');
  });

  it('suggerisce porzioni intere quando possibile', () => {
    const tortillaOnly = pool.filter((f) => f.id === 'tortilla');
    const advice = balance({
      items: [{ foodId: 'planted-kebab', grams: 125 }],
      lookup,
      targetBlocks: 4,
      tolerance: { protein: 0.5, carbs: 1, fat: 1 },
      pool: tortillaOnly,
    });
    const o = advice[0]?.options[0];
    expect(o?.grams).toBe(62);
    expect(o?.portionHint).toBe('tortilla');
  });
});

describe('piatti composti', () => {
  it('per 100 g calcolati dagli ingredienti', () => {
    const p = buildComposite(
      'wrap',
      'Wrap kebab',
      [
        { foodId: 'planted-kebab', grams: 100 },
        { foodId: 'tortilla', grams: 62 },
      ],
      lookup,
    );
    const m = foodMacros(p, 162);
    expect(m.protein).toBeCloseTo(22 + 8.5 * 0.62, 6);
    expect(m.carbs).toBeCloseTo(2.7 + 50 * 0.62, 6);
    expect(p.source).toBe('stima'); // la tortilla è una stima
    expect(p.diet).toBe('vegano');
  });

  it('eredita la dieta più restrittiva', () => {
    const p = buildComposite('x', 'x', [{ foodId: 'tonno-naturale', grams: 60 }, { foodId: 'riso-cotto', grams: 100 }], lookup);
    expect(p.diet).toBe('pesce');
  });

  it('kebab da solo resta "etichetta"', () => {
    const p = buildComposite('x', 'x', [{ foodId: PLANTED_KEBAB.id, grams: 160 }], lookup);
    expect(p.source).toBe('etichetta');
  });
});

describe('profili', () => {
  const marina: Profile = {
    id: 'm',
    name: 'Marina',
    diet: 'pescetariano',
    blocksPerMeal: 3,
    mealsPerDay: 3,
    blocksPerSnack: 1,
    snacksPerDay: 2,
    tolerance: tol,
    excludedFoodIds: [],
  };

  it('blocchi giornalieri', () => {
    expect(dailyBlocks(marina)).toBe(11);
  });

  it('pescetariano: pesce sì, carne no', () => {
    expect(dietAllows('pescetariano', 'pesce')).toBe(true);
    expect(dietAllows('pescetariano', 'carne')).toBe(false);
    expect(dietAllows('vegano', 'vegetariano')).toBe(false);
  });
});

describe('archivio iniziale', () => {
  it('id unici e valori plausibili', () => {
    const ids = new Set(SEED_FOODS.map((f) => f.id));
    expect(ids.size).toBe(SEED_FOODS.length);
    expect(SEED_FOODS.length).toBeGreaterThanOrEqual(60);
    for (const f of SEED_FOODS) {
      const { protein, carbs, fiber, fat } = f.per100;
      expect(protein + carbs + fiber + fat, f.id).toBeLessThanOrEqual(100.5);
      expect(f.source).toBeDefined();
    }
  });
});
