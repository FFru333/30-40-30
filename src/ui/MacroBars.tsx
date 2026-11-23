import { MACROS, ZONE_KCAL_SPLIT, fatMiniBlocks, type Macro } from '../domain/zone/blocks';
import type { MacroStatus, ZoneStatus } from '../domain/zone/status';
import { MACRO_LABEL, MACRO_SHORT, n0, n1, n1f, pct, signed } from './format';

function MacroRow({ s }: { s: MacroStatus }) {
  const t = s.targetBlocks;
  // Scala: almeno 1,5× il target, allargata se il valore lo supera.
  const max = Math.max(t * 1.5, s.blocks * 1.08, 1);
  const x = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const lo = Math.max(0, t - s.tolerance);
  const hi = t + s.tolerance;
  const stateText =
    s.state === 'ok' ? 'ok' : s.state === 'low' ? `mancano ${n1(-s.deltaBlocks)}` : `${n1(s.deltaBlocks)} di troppo`;

  return (
    <div className={`macro macro--${s.macro} is-${s.state}`}>
      <div className="macro__head">
        <span className="macro__label">{MACRO_LABEL[s.macro]}</span>
        <span className="macro__state">{stateText}</span>
        <span className="macro__value">
          <span className="macro__big">{n1f(s.blocks)}</span>
          <span className="macro__of">/ {n1(t)}</span>
        </span>
      </div>
      <div
        className="bar"
        role="meter"
        aria-label={`${MACRO_LABEL[s.macro]}: ${n1(s.blocks)} blocchi su ${n1(t)}`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={s.blocks}
      >
        <div className="bar__band" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
        <div className="bar__fill" style={{ width: x(s.blocks) }} />
        <div className="bar__target" style={{ left: x(t) }} />
      </div>
      <div className="macro__foot">
        <span>
          {n1(s.grams)} g di {n1(s.targetGrams)} g
          <span className="muted"> · {signed(s.deltaGrams)} g</span>
        </span>
        {s.macro === 'fat' && (
          <span className="muted" title="Blocchi di grasso da 1,5 g: solo indicativo, non usato nei calcoli">
            {n1(fatMiniBlocks(s.grams))} bl. da 1,5 g
          </span>
        )}
      </div>
    </div>
  );
}

export function MacroBars({ status }: { status: ZoneStatus }) {
  return (
    <div className="macros">
      {MACROS.map((m) => (
        <MacroRow key={m} s={status.macros[m]} />
      ))}
    </div>
  );
}

function Stack({ split, label }: { split: Record<Macro, number>; label: string }) {
  const empty = split.protein + split.carbs + split.fat === 0;
  return (
    <div className="split__row">
      <span className="split__label">{label}</span>
      <div className="split__bar">
        {empty ? (
          <div className="split__empty" />
        ) : (
          MACROS.map((m) => (
            <div key={m} className={`split__seg split__seg--${m}`} style={{ flexGrow: split[m] }} />
          ))
        )}
      </div>
      <span className="split__nums">
        {MACROS.map((m) => (
          <span key={m} className={`split__num split__num--${m}`}>
            {MACRO_SHORT[m]} {empty ? '–' : pct(split[m])}
          </span>
        ))}
      </span>
    </div>
  );
}

export function CalorieSplit({ split, kcal }: { split: Record<Macro, number>; kcal: number }) {
  return (
    <div className="split">
      <Stack split={split} label="Reale" />
      <Stack split={ZONE_KCAL_SPLIT} label="Zona" />
      <p className="split__note muted">
        {n0(kcal)} kcal calcolate dai macro (4/4/9). Zona: 30/40/30.
      </p>
    </div>
  );
}
