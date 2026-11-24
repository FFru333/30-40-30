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

  it('a cena "Bilancia" compensa la pizza di pranzo con proteine e grassi', () => {
    const base = eatenTotals([{ id: 'a', at: '', items: [{ foodId: 'pizza-margherita', grams: 330 }] }], lookup);
    const ps = dayPlans({ items: [], lookup, targetBlocks: 0, tolerance: tol, pool: SEED_FOODS, base, budget: 33 });
    const adapt = ps.find((p) => p.kind === 'adapt')!;
    expect(adapt.after.inZone).toBe(true);
    expect(adapt.changes.every((c) => c.deltaGrams > 0)).toBe(true);
    const day = dayStatus(totalsWith(adapt.items, lookup, base), 33, tol);
    expect(day.balance.inZone).toBe(true);
  });

  it('"Chiudi la giornata" porta tutti e tre i macro al budget', () => {
    const base = eatenTotals([{ id: 'a', at: '', items: [{ foodId: 'planted-kebab', grams: 160 }, { foodId: 'riso-crudo', grams: 70 }] }], lookup);
    const groups = planGroups(
      { items: [], lookup, targetBlocks: 0, tolerance: tol, pool: SEED_FOODS, base },
      3,
      (i) => dayPlans({ ...i, budget: 20 }),
    );
    const close = groups.find((g) => g.kind === 'close')!;
    expect(close.targetBlocks).toBe(20);
    expect(close.variants[0]!.after.inZone).toBe(true);
  });
});
