import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food } from '../../domain/food/types';
import type { Profile } from '../../domain/profile/types';
import { newId, whyNotAllowed } from '../../app/data';
import { db } from '../../db/schema';
import { FoodForm } from '../foods/FoodForm';
import { ScanButton } from '../scan/ScanButton';
import { readingNotice } from '../scan/notice';
import type { LabelReading } from '../../domain/food/label';
import { searchFoods } from '../../domain/food/search';
import { macroProfile, miniBlockGrams, scaleGrams } from '../../domain/food/profile';
import { SourceBadge } from '../../ui/SourceBadge';
import { MacroSig } from '../../ui/MacroSig';


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
  const [creating, setCreating] = useState<{ initial: Food; notice?: string; flagged?: LabelReading['unreadable'] } | null>(
    null,
  );
  const blank = (): Food => ({
    id: '',
    name: q.trim().replace(/^./, (c) => c.toUpperCase()),
    per100: { kcal: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 },
    carbBasis: 'eu',
    diet: 'vegano',
    source: 'etichetta',
  });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  // Esc chiude; la pagina sotto non scorre mentre il selettore è aperto.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const list = useMemo(() => {
    return searchFoods(foods, q)
      .map((f) => ({ f, why: whyNotAllowed(f, profile) }))
      .sort((a, b) => Number(!!a.why) - Number(!!b.why));
  }, [foods, q, profile]);

  if (creating) {
    return (
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Nuovo alimento">
        <div className="sheet__scroll">
          <header className="head">
            <h1 className="head__title">Nuovo alimento.</h1>
            <p className="head__sub">Valori per 100 g.</p>
          </header>
          {!creating.notice && (
            <p className="muted small">Copia i valori per 100 g dall’etichetta. Verrà aggiunto anche al piatto.</p>
          )}
          <FoodForm
            initial={creating.initial}
            notice={creating.notice}
            flagged={creating.flagged}
            onCancel={() => setCreating(null)}
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
        <li>
          <ScanButton
            variant="row"
            onRead={(r) => setCreating({ initial: r.food, notice: readingNotice(r), flagged: r.unreadable })}
          />
        </li>
        {list.map(({ f, why }) => (
          <li key={f.id}>
            <button className="pick" disabled={!!why} onClick={() => onPick(f)}>
              <MacroSig food={f} label />
              <span className="pick__name">
                {f.name} <SourceBadge food={f} />
                {f.ingredients && <span className="badge">piatto</span>}
              </span>
              <span className="pick__meta">
                {why ?? (
                  <>
                    {(() => {
                      const g = miniBlockGrams(f);
                      const top = macroProfile(f).dominant;
                      return (['protein', 'carbs', 'fat'] as const).map((m) => (
                        <span key={m} className={m === top ? 'is-top' : ''}>
                          {m === 'protein' ? 'P' : m === 'carbs' ? 'C' : 'G'}{' '}
                          {g[m] === null ? '—' : `${String(scaleGrams(g[m]!)).replace('.', ',')} g`}
                        </span>
                      ));
                    })()}
                    <span className="muted">per mini-blocco</span>
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
            <button className="pick pick--new" onClick={() => setCreating({ initial: blank() })}>
              <span className="pick__name">+ Crea “{q.trim()}”</span>
              <span className="pick__meta muted">Inserisci i valori dall’etichetta</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
