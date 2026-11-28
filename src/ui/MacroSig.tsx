import type { Food } from '../domain/food/types';
import { macroProfile, type Dominant } from '../domain/food/profile';
import { MACROS } from '../domain/zone/blocks';
import { MACRO_SHORT, pct } from './format';

export const DOMINANT_LABEL: Record<Dominant, string> = {
  protein: 'proteico',
  carbs: 'carboidrati',
  fat: 'grassi',
  mixed: 'misto',
};

/**
 * Firma dell'alimento: tre barrette (P, C, G) alte quanto la loro quota di kcal;
 * quella dominante è piena, le altre tratteggiate. Con `label` aggiunge il nome del macro forte.
 */
export function MacroSig({ food, label = false, size = 'sm' }: { food: Food; label?: boolean; size?: 'sm' | 'lg' }) {
  const { share, dominant } = macroProfile(food);
  const aria = `${DOMINANT_LABEL[dominant]}: ${MACROS.map((m) => `${MACRO_SHORT[m]} ${pct(share[m])}`).join(', ')}`;
  return (
    <span className={`sig sig--${size} sig--${dominant}`} aria-hidden="true" title={aria}>
      <span className="sig__bars" aria-hidden="true">
        {MACROS.map((m) => (
          <span key={m} className={`sig__bar ${m === dominant ? 'is-top' : ''}`}>
            <span style={{ height: `${Math.max(8, share[m] * 100)}%` }} />
            <small>{MACRO_SHORT[m]}</small>
          </span>
        ))}
      </span>
      {label && <span className="sig__label">{DOMINANT_LABEL[dominant]}</span>}
    </span>
  );
}
