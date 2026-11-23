import { useMemo, useState } from 'react';
import { db } from '../../db/schema';
import type { Food, Source } from '../../domain/food/types';
import { netCarbs } from '../../domain/zone/blocks';
import { newId, useFoods } from '../../app/data';
import { searchFoods } from '../../domain/food/search';
import { SourceBadge } from '../../ui/SourceBadge';
import { MacroSig } from '../../ui/MacroSig';
import { n0, n1 } from '../../ui/format';
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
  const [editing, setEditing] = useState<Food | null>(null);
  const [scanInfo, setScanInfo] = useState<{ notice: string; flagged: LabelReading['unreadable'] } | null>(null);

  const list = useMemo(() => {
    return searchFoods(foods ?? [], q).filter(
      (f) => filter === 'tutti' || (filter === 'piatti' ? !!f.ingredients : f.source === filter),
    );
  }, [foods, q, filter]);

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
      <ul className="foodlist">
        {list.map((f) => (
          <li key={f.id}>
            <button className="food" onClick={() => setEditing(f)}>
              <MacroSig food={f} label />
              <span className="food__name">
                {f.name} <SourceBadge food={f} />
                {f.ingredients && <span className="badge">piatto</span>}
              </span>
              <span className="food__nums">
                <span className="c-protein">P {n1(f.per100.protein)}</span>
                <span className="c-carbs">C {n1(netCarbs(f.per100, f.carbBasis))}</span>
                <span className="c-fat">G {n1(f.per100.fat)}</span>
                <span className="muted">{n0(f.per100.kcal)} kcal</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
