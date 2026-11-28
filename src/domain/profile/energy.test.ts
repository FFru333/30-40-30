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

describe('metodo Zona', async () => {
  const { zoneBlocks, navyBodyFat, distribute } = await import('./energy');
  it('120 g di proteine = 17 blocchi (esempio classico)', () => {
    // 80 kg al 11,76% di grasso → ~70,6 kg di massa magra × 1,7 = 120 g
    expect(zoneBlocks(80, 100 * (1 - 120 / 1.7 / 80), 1.7).blocks).toBe(17);
  });
  it('mai sotto 11 blocchi', () => expect(zoneBlocks(45, 35, 1.1).blocks).toBe(11));
  it('stima del grasso US Navy: uomo 180 cm, vita 85, collo 38 ≈ 16%', () => {
    expect(navyBodyFat('m', 180, 85, 38)!).toBeCloseTo(16.1, 1);
  });
  it('donna senza fianchi: niente stima', () => expect(navyBodyFat('f', 165, 70, 32)).toBeNull());
  it('distribuzione: somma esatta, spuntini da 1 o 2', () => {
    for (const b of [11, 14, 17, 19, 25, 33]) {
      const d = distribute(b);
      expect(d.reduce((a, x) => a + x.blocks, 0)).toBeCloseTo(b, 6);
      expect(d.map((x) => x.name)).toEqual(['Colazione', 'Spuntino', 'Pranzo', 'Spuntino', 'Cena']);
    }
    expect(distribute(14).map((x) => x.blocks)).toEqual([4, 1, 4, 1, 4]);
    expect(distribute(17).map((x) => x.blocks)).toEqual([5, 1, 5, 1, 5]);
    expect(distribute(16).map((x) => x.blocks)).toEqual([4, 2, 4, 2, 4]);
    expect(distribute(13).map((x) => x.blocks)).toEqual([3, 2, 3, 2, 3]);
  });
});
