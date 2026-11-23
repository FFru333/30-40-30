import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food } from '../../domain/food/types';
import type { Profile } from '../../domain/profile/types';
import { netCarbs } from '../../domain/zone/blocks';
import { whyNotAllowed } from '../../app/data';
import { SourceBadge } from '../../ui/SourceBadge';
import { n1 } from '../../ui/format';

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

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
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return foods
      .filter((f) => words.every((w) => norm(f.name).includes(w)))
      .map((f) => ({ f, why: whyNotAllowed(f, profile) }))
      .sort((a, b) => Number(!!a.why) - Number(!!b.why));
  }, [foods, q, profile]);

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
        {list.length === 0 && <li className="empty">Nessun alimento. Aggiungilo da “Alimenti”.</li>}
      </ul>
    </div>
  );
}
