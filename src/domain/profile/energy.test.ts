import { describe, expect, it } from 'vitest';
import { BLOCK_KCAL, bmr, kcalToBlocks, targetKcal, tdee } from './energy';
import { dayBudget, DEFAULT_TOLERANCE, type Profile } from './types';

const base: Profile = {
  id: 'x', name: 'X', diet: 'onnivoro', blocksPerMeal: 4, mealsPerDay: 3, blocksPerSnack: 1, snacksPerDay: 2,
  tolerance: DEFAULT_TOLERANCE, excludedFoodIds: [],
};

describe('fabbisogno', () => {
  it('un blocco Zona vale 91 kcal', () => expect(BLOCK_KCAL).toBe(91));
  it('Mifflin–St Jeor: uomo 80 kg, 180 cm, 35 anni', () => {
    expect(bmr({ sex: 'm', weightKg: 80, heightCm: 180, age: 35 })).toBe(1755);
  });
  it('donna 60 kg, 165 cm, 30 anni', () => {
    expect(bmr({ sex: 'f', weightKg: 60, heightCm: 165, age: 30 })).toBe(1320.25);
  });
  it('attività e obiettivo', () => {
    const b = { sex: 'm' as const, weightKg: 80, heightCm: 180, age: 35 };
    expect(tdee(b, 'moderato')).toBeCloseTo(2720.25, 2);
    expect(targetKcal(b, 'moderato', 'perdere')).toBe(2300);
  });
  it('3000 kcal = 33 blocchi (non 30)', () => expect(kcalToBlocks(3000)).toBe(33));
  it('kcal scritte a mano hanno la precedenza', () => {
    expect(dayBudget({ ...base, dailyKcal: 3000, body: { sex: 'm', weightKg: 50, heightCm: 150, age: 70 } })).toBe(33);
  });
  it('senza dati: somma pasti + spuntini', () => expect(dayBudget(base)).toBe(14));
});
