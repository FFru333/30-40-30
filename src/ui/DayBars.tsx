import { MACROS, gramsToBlocks, type MacroGrams } from '../domain/zone/blocks';
import type { DayStatus } from '../domain/zone/day';
import { MACRO_LABEL, n1 } from './format';

/**
 * La giornata a blocchi: una riga per macro, un segmento per blocco del budget.
 * Nero = già mangiato, tratteggiato = nel piatto adesso, grigio = ancora libero.
 * Oltre il budget i segmenti continuano con un bordo.
 */
export function DayBars({ eaten, plate, day }: { eaten: MacroGrams; plate: MacroGrams; day: DayStatus }) {
  const e = gramsToBlocks(eaten);
  const p = gramsToBlocks(plate);
  const cap = Math.max(day.budget, ...MACROS.map((m) => e[m] + p[m]));
  const cols = Math.max(1, Math.ceil(cap - 1e-9));

  return (
    <div className="daybars" style={{ ['--cols' as string]: cols }}>
      {MACROS.map((m) => {
        const tot = e[m] + p[m];
        const s = day.balance.macros[m];
        const note =
          tot === 0 ? '' : s.state === 'low' ? `−${n1(-s.deltaBlocks)}` : s.state === 'high' ? `+${n1(s.deltaBlocks)}` : 'ok';
        return (
          <div
            key={m}
            className={`daybars__row is-${tot === 0 ? 'none' : s.state}`}
            role="meter"
            aria-label={`${MACRO_LABEL[m]}: ${n1(e[m])} blocchi mangiati, ${n1(p[m])} nel piatto, budget ${n1(day.budget)}`}
            aria-valuemin={0}
            aria-valuemax={day.budget}
            aria-valuenow={tot}
          >
            <span className="daybars__label">
              <span>{MACRO_LABEL[m]}</span>
              <strong>{n1(tot)}</strong>
            </span>
            <span className="daybars__track">
              {Array.from({ length: cols }, (_, i) => {
                const eat = Math.min(1, Math.max(0, e[m] - i));
                const pl = Math.min(1 - eat, Math.max(0, tot - i) - eat);
                return (
                  <i
                    key={i}
                    className={`bk ${i >= day.budget ? 'is-over' : ''}`}
                    style={{ ['--e' as string]: eat, ['--p' as string]: Math.max(0, pl) }}
                  />
                );
              })}
            </span>
            <span className="daybars__note">{note}</span>
          </div>
        );
      })}
      <div className="daybars__legend" aria-hidden="true">
        <span>
          <i className="bk bk--key" style={{ ['--e' as string]: 1, ['--p' as string]: 0 }} /> mangiato
        </span>
        <span>
          <i className="bk bk--key" style={{ ['--e' as string]: 0, ['--p' as string]: 1 }} /> nel piatto
        </span>
        <span>
          <i className="bk bk--key" style={{ ['--e' as string]: 0, ['--p' as string]: 0 }} /> libero
        </span>
      </div>
    </div>
  );
}
