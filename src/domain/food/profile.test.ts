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
