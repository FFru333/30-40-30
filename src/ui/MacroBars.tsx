import { MACROS, ZONE_KCAL_SPLIT, fatMiniBlocks, type Macro } from '../domain/zone/blocks';
import type { MacroStatus, ZoneStatus } from '../domain/zone/status';
import { MACRO_LABEL, MACRO_SHORT, n1, n1f, pct, signed } from './format';

/** Riquadro di un macro: il riempimento è il valore, la tacca è il target. */
function MacroTile({ s, wide }: { s: MacroStatus; wide?: boolean }) {
  const t = s.targetBlocks;
  const max = Math.max(t * 1.5, s.blocks * 1.05, 1);
  const x = (v: number) => Math.min(100, Math.max(0, (v / max) * 100));
  const stateText =
    s.state === 'ok'
      ? 'ok'
      : s.state === 'low'
        ? `mancano ${n1(-s.deltaBlocks)}`
        : `+${n1(s.deltaBlocks)} di troppo`;

  return (
    <div
      className={`tile tile--${s.macro} is-${s.state} ${wide ? 'tile--wide' : ''}`}
      role="meter"
      aria-label={`${MACRO_LABEL[s.macro]}: ${n1(s.blocks)} blocchi su ${n1(t)}, ${stateText}`}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={s.blocks}
    >
      <div className="tile__fill" style={{ width: `${x(s.blocks)}%` }} />
      <div
        className="tile__band"
        style={{ left: `${x(Math.max(0, t - s.tolerance))}%`, width: `${x(t + s.tolerance) - x(Math.max(0, t - s.tolerance))}%` }}
      />
      <div className="tile__target" style={{ left: `${x(t)}%` }} />
      <div className="tile__top">
        <span className="tile__label">{MACRO_LABEL[s.macro]}.</span>
        <span className="tile__tag">
          {n1(s.grams)} / {n1(s.targetGrams)} g
        </span>
      </div>
      <div className="tile__bottom">
        <span className="tile__num">
          {n1f(s.blocks)}
          <span className="tile__of">/{n1(t)}</span>
        </span>
        <span className="tile__state">
          {s.state === 'ok' ? <span className="dot dot--ok" /> : null}
          {stateText}
        </span>
      </div>
      {s.macro === 'fat' && (
        <span className="tile__aside" title="Blocchi di grasso da 1,5 g: solo indicativo, non usato nei calcoli">
          {n1(fatMiniBlocks(s.grams))} bl. da 1,5 g · {signed(s.deltaGrams)} g
        </span>
      )}
      {s.macro !== 'fat' && <span className="tile__aside">{signed(s.deltaGrams)} g dal target</span>}
    </div>
  );
}

export function MacroTiles({ status, empty }: { status: ZoneStatus; empty?: boolean }) {
  return (
    <div className={`tiles ${empty ? 'is-empty' : ''}`}>
      <MacroTile s={status.macros.protein} wide />
      <MacroTile s={status.macros.carbs} />
      <MacroTile s={status.macros.fat} />
    </div>
  );
}

/** Ripartizione calorica reale, in chip, con la Zona come riferimento. */
export function SplitChips({ split, empty }: { split: Record<Macro, number>; empty: boolean }) {
  return (
    <div className="splitchips">
      <div className="splitbar" aria-hidden="true">
        {MACROS.map((m) => (
          <span key={m} className={`splitbar__seg splitbar__seg--${m}`} style={{ flexGrow: empty ? 1 : split[m] }} />
        ))}
      </div>
      <div className="chips">
        {MACROS.map((m) => (
          <span key={m} className={`chip chip--${m}`}>
            <span className={`dot dot--${m}`} />
            {MACRO_SHORT[m]} {empty ? '–' : pct(split[m])}
            <span className="chip__ref">/{pct(ZONE_KCAL_SPLIT[m])}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
