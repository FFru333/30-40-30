import { MACROS, ZONE_KCAL_SPLIT, type Macro } from '../domain/zone/blocks';
import type { ZoneStatus } from '../domain/zone/status';
import { MACRO_LABEL, n0, n1, pct } from './format';

const C = 130; // centro
const R_OUT = 122; // anello guida 30/40/30
const R_IN = 104; // anello reale
const TAU = Math.PI * 2;

function arc(r: number, from: number, to: number): string {
  // angoli in frazioni di giro, 0 = ore 12, senso orario
  const a0 = from * TAU - Math.PI / 2;
  const a1 = to * TAU - Math.PI / 2;
  const large = to - from > 0.5 ? 1 : 0;
  const p = (a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  return `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`;
}

function segments(split: Record<Macro, number>, gap: number) {
  let at = 0;
  return MACROS.map((m) => {
    const from = at;
    at += split[m];
    const g = split[m] > gap * 2 ? gap : 0;
    return { m, from: from + g, to: at - g, size: split[m] };
  }).filter((s) => s.size > 0.001);
}

/**
 * Anello: fuori la ripartizione Zona (30/40/30), dentro quella reale del piatto.
 * Al centro lo stato e le kcal.
 */
export function Ring({
  split,
  kcal,
  empty,
  inZone,
  targetBlocks,
}: {
  split: Record<Macro, number>;
  kcal: number;
  empty: boolean;
  inZone: boolean;
  targetBlocks: number;
}) {
  const guide = segments(ZONE_KCAL_SPLIT, 0.006);
  const real = empty ? [] : segments(split, 0.008);
  const label = empty
    ? 'Ripartizione: nessun alimento'
    : `Ripartizione reale: ${MACROS.map((m) => `${MACRO_LABEL[m]} ${pct(split[m])}`).join(', ')}. Zona: 31, 40, 30 per cento.`;

  return (
    <figure className="ring" aria-label={label} role="img">
      <svg viewBox="0 0 260 260" width="100%" height="100%">
        <circle cx={C} cy={C} r={R_OUT} className="ring__track ring__track--out" />
        <circle cx={C} cy={C} r={R_IN} className="ring__track" />
        {guide.map((s) => (
          <path key={s.m} d={arc(R_OUT, s.from, s.to)} className={`ring__guide ring__guide--${s.m}`} />
        ))}
        {real.map((s) =>
          s.size >= 0.999 ? (
            <circle key={s.m} cx={C} cy={C} r={R_IN} className={`ring__arc ring__arc--${s.m}`} />
          ) : (
            <path key={s.m} d={arc(R_IN, s.from, s.to)} className={`ring__arc ring__arc--${s.m}`} />
          ),
        )}
      </svg>
      <figcaption className="ring__center">
        <span className={`ring__pill ${empty ? '' : inZone ? 'is-in' : 'is-out'}`}>
          {empty ? 'Piatto vuoto' : inZone ? 'In Zona' : 'Fuori Zona'}
        </span>
        <span className="ring__kcal">{n0(kcal)}</span>
        <span className="ring__unit">kcal · obiettivo {n1(targetBlocks)} bl</span>
      </figcaption>
    </figure>
  );
}

/** Tre colonne sotto l'anello: quota calorica reale vs Zona, e blocchi vs target. */
export function MacroStats({ status, split, empty }: { status: ZoneStatus; split: Record<Macro, number>; empty: boolean }) {
  return (
    <div className="stats">
      {MACROS.map((m) => {
        const s = status.macros[m];
        const fill = Math.min(1, s.targetBlocks > 0 ? s.blocks / s.targetBlocks : 0);
        return (
          <div key={m} className={`stat stat--${m} ${empty ? '' : `is-${s.state}`}`}>
            <span className="stat__label">{MACRO_LABEL[m]}</span>
            <span className="stat__pct">
              {empty ? '–' : pct(split[m])}
              <small>/{pct(ZONE_KCAL_SPLIT[m])}</small>
            </span>
            <span className="stat__bar" aria-hidden="true">
              <span style={{ width: `${fill * 100}%` }} />
            </span>
            <span className="stat__blocks">
              {n1(s.blocks)} / {n1(s.targetBlocks)} bl
            </span>
            <span className="stat__state">
              {empty || s.state === 'ok'
                ? `${n1(s.grams)} g`
                : s.state === 'low'
                  ? `mancano ${n1(-s.deltaBlocks)}`
                  : `+${n1(s.deltaBlocks)} in più`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
