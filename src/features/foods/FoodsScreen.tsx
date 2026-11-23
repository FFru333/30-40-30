import { useMemo, useState } from 'react';
import { db } from '../../db/schema';
import type { Food, Source } from '../../domain/food/types';
import { netCarbs } from '../../domain/zone/blocks';
import { newId, useFoods } from '../../app/data';
import { SourceBadge } from '../../ui/SourceBadge';
import { n0, n1 } from '../../ui/format';
import { FoodForm } from './FoodForm';

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

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

  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return (foods ?? []).filter(
      (f) =>
        words.every((w) => norm(f.name).includes(w)) &&
        (filter === 'tutti' || (filter === 'piatti' ? !!f.ingredients : f.source === filter)),
    );
  }, [foods, q, filter]);

  if (!foods) return <div className="loading">Carico…</div>;

  if (editing) {
    const isNew = !editing.id;
    return (
      <div className="screen">
        <h1 className="h1">{isNew ? 'Nuovo alimento' : 'Modifica alimento'}</h1>
        <FoodForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={async (f) => {
            await db.foods.put(isNew ? { ...f, id: newId('food') } : f);
            setEditing(null);
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
      <div className="screen__head">
        <h1 className="h1">Alimenti</h1>
        <button className="btn btn--primary" onClick={() => setEditing({ ...BLANK })}>
          + Nuovo
        </button>
      </div>
      <p className="muted small">
        {foods.length} alimenti · {nStima} da verificare in etichetta. Valori per 100 g, carboidrati netti.
      </p>
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
