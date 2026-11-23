import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food } from '../../domain/food/types';
import type { Profile } from '../../domain/profile/types';
import { netCarbs } from '../../domain/zone/blocks';
import { newId, whyNotAllowed } from '../../app/data';
import { db } from '../../db/schema';
import { FoodForm } from '../foods/FoodForm';
import { searchFoods } from '../../domain/food/search';
import { SourceBadge } from '../../ui/SourceBadge';
import { n1 } from '../../ui/format';


export function FoodPicker({
  foods,
  profile,
  onPick,
  onClose,
}: {
  foods: Food[];
  profile: Profile;
  onPick: (f: Food) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const list = useMemo(() => {
    return searchFoods(foods, q)
      .map((f) => ({ f, why: whyNotAllowed(f, profile) }))
      .sort((a, b) => Number(!!a.why) - Number(!!b.why));
  }, [foods, q, profile]);

  if (creating) {
    return (
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Nuovo alimento">
        <div className="sheet__scroll">
          <h1 className="h1">Nuovo alimento</h1>
          <p className="muted small">Copia i valori per 100 g dall’etichetta. Verrà aggiunto anche al piatto.</p>
          <FoodForm
            initial={{
              id: '',
              name: q.trim().replace(/^./, (c) => c.toUpperCase()),
              per100: { kcal: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 },
              carbBasis: 'eu',
              diet: 'vegano',
              source: 'etichetta',
            }}
            onCancel={() => setCreating(false)}
            onSave={async (f) => {
              const food = { ...f, id: newId('food') };
              await db.foods.put(food);
              onPick(food);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Aggiungi alimento">
      <div className="sheet__bar">
        <input
          ref={input}
          className="search"
          type="search"
          placeholder="Cerca alimento"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
        />
        <button className="btn btn--ghost" onClick={onClose}>
          Chiudi
        </button>
      </div>
      <ul className="picklist">
        {list.map(({ f, why }) => (
          <li key={f.id}>
            <button className="pick" disabled={!!why} onClick={() => onPick(f)}>
              <span className="pick__name">
                {f.name} <SourceBadge food={f} />
                {f.ingredients && <span className="badge">piatto</span>}
              </span>
              <span className="pick__meta">
                {why ?? (
                  <>
                    <span className="c-protein">P {n1(f.per100.protein)}</span>
                    <span className="c-carbs">C {n1(netCarbs(f.per100, f.carbBasis))}</span>
                    <span className="c-fat">G {n1(f.per100.fat)}</span>
                    <span className="muted">/100 g</span>
                    {f.portion && (
                      <span className="muted">
                        · {f.portion.label} {f.portion.grams} g
                      </span>
                    )}
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="empty">Nessun alimento trovato per “{q.trim()}”.</li>}
        {q.trim() && (
          <li>
            <button className="pick pick--new" onClick={() => setCreating(true)}>
              <span className="pick__name">+ Crea “{q.trim()}”</span>
              <span className="pick__meta muted">Inserisci i valori dall’etichetta</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
