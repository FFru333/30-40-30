import { describe, expect, it } from 'vitest';
import { parseGrams } from './GramsInput';

describe('grammi digitati', () => {
  it('virgola e punto', () => {
    expect(parseGrams('150,5')).toBe(150.5);
    expect(parseGrams('150.5')).toBe(150.5);
    expect(parseGrams('80')).toBe(80);
  });
  it('testo incompleto non cambia il pasto', () => {
    expect(parseGrams('')).toBeNull();
    expect(parseGrams(',')).toBeNull();
    expect(parseGrams('-3')).toBeNull();
  });
  it('"12," è già 12 mentre scrivi i decimali', () => {
    expect(parseGrams('12,')).toBe(12);
  });
});
