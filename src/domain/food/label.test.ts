import { describe, expect, it } from 'vitest';
import { parseLabelReading } from './label';

describe('lettura etichetta', () => {
  it('risposta completa → bozza alimento con fonte etichetta', () => {
    const r = parseLabelReading({
      name: 'Tortillas di mais',
      brand: 'Old El Paso',
      per100: { kcal: 222, protein: 5.7, carbs: 43, fiber: 6, fat: 2.8 },
      carbBasis: 'eu',
      portionLabel: 'tortilla',
      portionGrams: 30,
      diet: 'vegano',
      notes: '',
    });
    expect(r.food.name).toBe('Tortillas di mais (Old El Paso)');
    expect(r.food.per100.carbs).toBe(43);
    expect(r.food.source).toBe('etichetta');
    expect(r.food.portion).toEqual({ label: 'tortilla', grams: 30 });
    expect(r.unreadable).toEqual([]);
  });

  it('valori come stringhe con virgola e -1 per illeggibile', () => {
    const r = parseLabelReading({
      name: 'Skyr',
      per100: { kcal: '63', protein: '11,0', carbs: 4, fiber: -1, fat: '0,2' },
    });
    expect(r.food.per100.protein).toBe(11);
    expect(r.food.per100.fat).toBe(0.2);
    expect(r.unreadable).toEqual(['fiber']);
    expect(r.food.carbBasis).toBe('eu');
    expect(r.food.diet).toBe('vegetariano');
  });

  it('fibre assenti in etichetta non sono un errore', () => {
    const r = parseLabelReading({ name: 'x', per100: { kcal: 100, protein: 1, carbs: 2, fat: 3 } });
    expect(r.unreadable).toEqual([]);
    expect(r.food.per100.fiber).toBe(0);
  });

  it('etichetta USA riconosciuta', () => {
    const r = parseLabelReading({ name: 'x', per100: { kcal: 100, protein: 1, carbs: 20, fiber: 5, fat: 3 }, carbBasis: 'us_total' });
    expect(r.food.carbBasis).toBe('us_total');
  });

  it('nessun macro leggibile → errore chiaro', () => {
    expect(() => parseLabelReading({ name: 'foto sfocata', per100: {} })).toThrow(/tabella nutrizionale/);
    expect(() => parseLabelReading('ciao')).toThrow();
  });
});
