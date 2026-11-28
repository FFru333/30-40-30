import { useMemo, useState } from 'react';
import { db } from '../../db/schema';
import type { Food, Source } from '../../domain/food/types';
import { MACROS, type Macro } from '../../domain/zone/blocks';
import { macroProfile, miniBlockGrams, scaleGrams, MINI_BLOCK } from '../../domain/food/profile';
import { newId, useFoods } from '../../app/data';
import { searchFoods } from '../../domain/food/search';
import { SourceBadge } from '../../ui/SourceBadge';
import { MacroSig } from '../../ui/MacroSig';
import { MACRO_LABEL, MACRO_SHORT, n1 } from '../../ui/format';
import { FoodForm } from './FoodForm';
import { ScanButton } from '../scan/ScanButton';
import { readingNotice } from '../scan/notice';
import type { LabelReading } from '../../domain/food/label';


const BLANK: Food = {
  id: '',
  name: '',
  per100: { kcal: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 },
  carbBasis: 'eu',
  diet: 'vegano',
  source: 'etichetta',
};

type Filter = 'tutti' | Source | 'piatti';

export function FoodsScreen() {
  const foods = useFoods();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('tutti');
  /** Ordina per grammi necessari a un mini-blocco di questo macro (i più concentrati prima). */
  const [by, setBy] = useState<Macro | null>(null);
  const [editing, setEditing] = useState<Food | null>(null);
  const [scanInfo, setScanInfo] = useState<{ notice: string; flagged: LabelReading['unreadable'] } | null>(null);

  const list = useMemo(() => {
    const base = searchFoods(foods ?? [], q).filter(
      (f) => filter === 'tutti' || (filter === 'piatti' ? !!f.ingredients : f.source === filter),
    );
    if (!by) return base;
    // Solo gli alimenti che sono davvero una fonte di quel macro, dal più concentrato.
    return base
      .filter((f) => macroProfile(f).share[by] >= 0.35 && miniBlockGrams(f)[by] !== null)
      .sort((a, b) => miniBlockGrams(a)[by]! - miniBlockGrams(b)[by]!);
  }, [foods, q, filter, by]);

  if (!foods) return <div className="loading">Carico…</div>;

  if (editing) {
    const isNew = !editing.id;
    return (
      <div className="screen">
        <header className="head">
          <h1 className="head__title">{isNew ? 'Nuovo alimento.' : 'Modifica.'}</h1>
          <p className="head__sub">Valori per 100 g.</p>
        </header>
        <FoodForm
          initial={editing}
          notice={scanInfo?.notice}
          flagged={scanInfo?.flagged}
          onCancel={() => {
            setEditing(null);
            setScanInfo(null);
          }}
          onSave={async (f) => {
            await db.foods.put(isNew ? { ...f, id: newId('food') } : f);
            setEditing(null);
            setScanInfo(null);
          }}
          onDelete={
            isNew
              ? undefined
              : async () => {
                  await db.foods.delete(editing.id);
                  setEditing(null);
                }
          }
        />
      </div>
    );
  }

  const nStima = foods.filter((f) => f.source === 'stima').length;

  return (
    <div className="screen">
      <header className="head">
        <h1 className="head__title">Alimenti.</h1>
        <p className="head__sub">
          {foods.length} in archivio, {nStima} da verificare.
        </p>
      </header>
      <div className="actions">
        <ScanButton
          onRead={(r) => {
            setScanInfo({ notice: readingNotice(r), flagged: r.unreadable });
            setEditing(r.food);
          }}
        />
        <button className="pill" onClick={() => setEditing({ ...BLANK })}>
          + Nuovo
        </button>
      </div>
      <input className="search" type="search" placeholder="Cerca" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {(
          [
            ['tutti', 'Tutti'],
            ['stima', 'Stime'],
            ['etichetta', 'Verificati'],
            ['piatti', 'Piatti'],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button key={k} className={`chip ${filter === k ? 'is-on' : ''}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="minihead">
        <p className="minihead__t">
          Grammi per <strong>1 mini-blocco</strong>: {MINI_BLOCK.protein} g proteine · {MINI_BLOCK.carbs} g carboidrati ·{' '}
          {n1(MINI_BLOCK.fat)} g grassi. Ordina per:
        </p>
        <div className="chips">
          {MACROS.map((m) => (
            <button key={m} className={`chip ${by === m ? 'is-on' : ''}`} onClick={() => setBy(by === m ? null : m)}>
              {MACRO_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <ul className="foodlist">
        {list.map((f) => {
          const g = miniBlockGrams(f);
          const top = by ?? macroProfile(f).dominant;
          return (
            <li key={f.id}>
              <button className="food" onClick={() => setEditing(f)}>
                <MacroSig food={f} label />
                <span className="food__name">
                  {f.name} <SourceBadge food={f} />
                  {f.ingredients && <span className="badge">piatto</span>}
                </span>
                <span className="food__mini" aria-label="Grammi per un mini-blocco">
                  {MACROS.map((m) => (
                    <span key={m} className={m === top ? 'is-top' : ''}>
                      <small>{MACRO_SHORT[m]}</small>
                      {g[m] === null ? '—' : `${String(scaleGrams(g[m]!)).replace('.', ',')} g`}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="empty">Nessun alimento.</li>}
      </ul>
    </div>
  );
}
