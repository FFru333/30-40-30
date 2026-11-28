import type { Food } from '../domain/food/types';
import { macroProfile } from '../domain/food/profile';

/**
 * Qualità Zona in una parola. Per i carboidrati: "favorevole" / "da limitare";
 * per proteine e grassi: "ottimo" / "da limitare". "Discreto" non ha etichetta: è la norma.
 */
export function ZoneTag({ food }: { food: Food }) {
  if (!food.zone || food.zone === 'discreto') return null;
  const carb = macroProfile(food).dominant === 'carbs';
  const text = food.zone === 'ottimo' ? (carb ? 'favorevole' : 'ottimo') : 'da limitare';
  return <span className={`ztag ztag--${food.zone}`}>{text}</span>;
}
