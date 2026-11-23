import { MACROS } from '../domain/zone/blocks';
import type { MacroStatus, ZoneStatus } from '../domain/zone/status';
import { MACRO_LABEL, n1 } from './format';

const MAX_COLS = 12;

/**
 * Matrice dei blocchi: una riga per macro, un punto per blocco.
 * Grigio = blocco del target ancora vuoto, nero = raggiunto (anche in parte),
 * tratteggiato = oltre il target.
 */
export function BlockMatrix({ status, empty }: { status: ZoneStatus; empty: boolean }) {
  const t = status.targetBlocks;
  const top = Math.max(...MACROS.map((m) => status.macros[m].blocks));
  const cols = Math.max(1, Math.min(MAX_COLS, Math.ceil(Math.max(t, top) - 1e-9)));

  return (
    <div className="matrix" style={{ ['--cols' as string]: cols }}>
      {MACROS.map((m) => (
        <Row key={m} s={status.macros[m]} cols={cols} empty={empty} />
      ))}
      <div className="matrix__legend" aria-hidden="true">
        <span>
          <i className="blk blk--key" style={{ ['--f' as string]: 1, ['--t' as string]: 1 }} /> raggiunto
        </span>
        <span>
          <i className="blk blk--key" style={{ ['--f' as string]: 0, ['--t' as string]: 1 }} /> manca
        </span>
        <span>
          <i className="blk blk--key is-extra" style={{ ['--f' as string]: 1, ['--t' as string]: 0 }} /> in più
        </span>
      </div>
    </div>
  );
}

function Row({ s, cols, empty }: { s: MacroStatus; cols: number; empty: boolean }) {
  const hidden = Math.max(0, Math.ceil(s.blocks - 1e-9) - cols);
  const note =
    empty || s.state === 'ok'
      ? 'ok'
      : s.state === 'low'
        ? `−${n1(-s.deltaBlocks)}`
        : `+${n1(s.deltaBlocks)}`;
  return (
    <div
      className={`matrix__row ${empty ? '' : `is-${s.state}`}`}
      role="meter"
      aria-label={`${MACRO_LABEL[s.macro]}: ${n1(s.blocks)} blocchi su ${n1(s.targetBlocks)}`}
      aria-valuemin={0}
      aria-valuemax={Math.max(s.targetBlocks, s.blocks)}
      aria-valuenow={s.blocks}
    >
      <div className="matrix__label">
        <span className="matrix__name">{MACRO_LABEL[s.macro]}</span>
        <span className="matrix__val">
          {n1(s.blocks)}
          <small>/{n1(s.targetBlocks)}</small>
        </span>
      </div>
      <div className="matrix__dots">
        {Array.from({ length: cols }, (_, i) => {
          const f = Math.min(1, Math.max(0, s.blocks - i));
          const tcov = Math.min(1, Math.max(0, s.targetBlocks - i));
          const extra = tcov === 0;
          return (
            <i
              key={i}
              className={`blk ${extra ? 'is-extra' : ''}`}
              style={{ ['--f' as string]: f, ['--t' as string]: tcov }}
            />
          );
        })}
      </div>
      <span className="matrix__note">{hidden > 0 ? `+${hidden} bl` : note}</span>
    </div>
  );
}
