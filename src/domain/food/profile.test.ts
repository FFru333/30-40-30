import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../../data/seed-foods';
import { macroProfile } from './profile';

const get = (id: string) => macroProfile(SEED_FOODS.find((f) => f.id === id)!);

describe('macro forte di un alimento', () => {
  it('tonno proteico, riso carboidrati, olio grassi', () => {
    expect(get('tonno-naturale').dominant).toBe('protein');
    expect(get('riso-crudo').dominant).toBe('carbs');
    expect(get('olio-evo').dominant).toBe('fat');
  });
  it('pizza: carboidrati; hummus: grassi; uova: misto (nessun macro oltre metà)', () => {
    expect(get('pizza-margherita').dominant).toBe('carbs');
    expect(get('hummus').dominant).toBe('fat');
    expect(get('uovo').dominant).toBe('fat');
    expect(get('tacos-manzo').dominant).toBe('mixed');
  });
  it('quote sommano a 1', () => {
    const s = get('planted-kebab').share;
    expect(s.protein + s.carbs + s.fat).toBeCloseTo(1, 10);
  });
});

describe('grammi per mini-blocco', async () => {
  const { miniBlockGrams, scaleGrams } = await import('./profile');
  const food = (id: string) => SEED_FOODS.find((f) => f.id === id)!;
  it('planted.kebab: 7 g di proteine in ~32 g', () => {
    expect(miniBlockGrams(food('planted-kebab')).protein).toBeCloseTo(31.8, 1);
  });
  it('riso crudo: 9 g di carboidrati in ~11,5 g', () => {
    expect(miniBlockGrams(food('riso-crudo')).carbs).toBeCloseTo(11.54, 2);
  });
  it('olio: 1,5 g di grassi in 1,5 g', () => {
    expect(scaleGrams(miniBlockGrams(food('olio-evo')).fat!)).toBe(1.5);
  });
  it('macro quasi assente: nessun valore', () => {
    expect(miniBlockGrams(food('olio-evo')).protein).toBeNull();
  });
});
