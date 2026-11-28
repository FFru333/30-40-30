import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../../data/seed-foods';
import { DEFAULT_TOLERANCE } from '../profile/types';
import { dayStatus, eatenTotals, localDate } from './day';
import { dayPlans, planGroups } from './plan';
import { totalsWith } from './meal';

const byId = new Map(SEED_FOODS.map((f) => [f.id, f]));
const lookup = (id: string) => byId.get(id);
const tol = DEFAULT_TOLERANCE;

describe('giornata', () => {
  it('data locale', () => expect(localDate(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24'));

  it('a pranzo pizza: la giornata è sbilanciata sui carboidrati, i blocchi usati li decide il macro più alto', () => {
    const eaten = eatenTotals([{ id: 'a', at: '', items: [{ foodId: 'pizza-margherita', grams: 330 }] }], lookup);
    const s = dayStatus(eaten, 33, tol);
    expect(s.used).toBeCloseTo(11.37, 1);
    expect(s.balance.inZone).toBe(false);
    expect(s.balance.macros.carbs.state).toBe('ok');
    expect(s.balance.macros.protein.state).toBe('low');
    expect(s.left).toBeCloseTo(33 - 11.37, 1);
  });

  it('a cena "Bilancia la giornata" compensa la pizza di pranzo, senza togliere niente', () => {
    const base = eatenTotals([{ id: 'a', at: '', items: [{ foodId: 'pizza-margherita', grams: 330 }] }], lookup);
    const [p] = dayPlans({ items: [], lookup, targetBlocks: 0, tolerance: tol, pool: SEED_FOODS, base });
    expect(p!.kind).toBe('day');
    expect(p!.after.inZone).toBe(true);
    expect(p!.changes.every((c) => c.deltaGrams > 0)).toBe(true);
    expect(dayStatus(totalsWith(p!.items, lookup, base), 33, tol).balance.inZone).toBe(true);
  });

  it('giornata già pari: nessun piano', () => {
    const base = eatenTotals([{ id: 'a', at: '', items: [{ foodId: 'x', grams: 100 }] }], () => ({
      id: 'x', name: 'x', per100: { kcal: 0, protein: 28, carbs: 36, fiber: 0, fat: 12 }, carbBasis: 'eu', diet: 'vegano', source: 'stima',
    }));
    expect(dayPlans({ items: [], lookup, targetBlocks: 0, tolerance: tol, pool: SEED_FOODS, base })).toEqual([]);
  });

  it('varianti della giornata', () => {
    const base = eatenTotals([{ id: 'a', at: '', items: [{ foodId: 'pizza-margherita', grams: 330 }] }], lookup);
    const groups = planGroups({ items: [], lookup, targetBlocks: 0, tolerance: tol, pool: SEED_FOODS, base }, 3, dayPlans);
    expect(groups[0]!.variants.length).toBeGreaterThanOrEqual(2);
  });
});
