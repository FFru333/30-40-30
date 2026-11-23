import { useEffect, useMemo, useRef, useState } from 'react';
import { db, EMPTY_DRAFT, type Draft } from '../../db/schema';
import type { Food, Ingredient } from '../../domain/food/types';
import type { Profile } from '../../domain/profile/types';
import { buildComposite } from '../../domain/food/composite';
import { MACROS, gramsToBlocks } from '../../domain/zone/blocks';
import { foodMacros, kcalSplit, mealTotals } from '../../domain/zone/meal';
import { evaluate, type ZoneStatus } from '../../domain/zone/status';
import { balance, type Advice, type Suggestion } from '../../domain/zone/balance';
import { allowedFoods, newId, useFoodMap, useFoods, useProfiles } from '../../app/data';
import { CalorieSplit, MacroBars } from '../../ui/MacroBars';
import { SourceBadge } from '../../ui/SourceBadge';
import { MACRO_LABEL, MACRO_OF, MACRO_SHORT, blocchi, n0, n1 } from '../../ui/format';
import { FoodPicker } from './FoodPicker';

function statusLine(s: ZoneStatus): string {
  const w = s.worst;
  if (!w) return 'Tutti e tre i macro dentro la tolleranza.';
  const b = Math.abs(w.deltaBlocks);
  return w.state === 'low'
    ? `Mancano ${n1(b)} ${blocchi(b)} ${MACRO_OF[w.macro]}.`
    : `${n1(b)} ${blocchi(b)} ${MACRO_OF[w.macro]} di troppo.`;
}

function shortStatus(s: ZoneStatus): string {
  if (s.inZone) return 'in Zona';
  return MACROS.filter((m) => s.macros[m].state !== 'ok')
    .map((m) => {
      const d = s.macros[m].deltaBlocks;
      return `${MACRO_LABEL[m].toLowerCase()} ${d > 0 ? '+' : '−'}${n1(Math.abs(d))}`;
    })
    .join(' · ');
}

function stepFor(g: number) {
  return g < 20 ? 1 : 5;
}

export function Composer() {
  const foods = useFoods();
  const profiles = useProfiles();
  const foodMap = useFoodMap(foods);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [game, setGame] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Carica la bozza una volta, poi la salva con un piccolo ritardo.
  useEffect(() => {
    db.drafts.get('current').then((d) => setDraft(d ?? EMPTY_DRAFT));
  }, []);
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!draft) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void db.drafts.put(draft), 250);
  }, [draft]);

  const profile: Profile | undefined =
    profiles?.find((p) => p.id === draft?.activeProfileId) ?? profiles?.[0];

  const lookup = (id: string) => foodMap.get(id);
  const items = draft?.items ?? [];
  const totals = useMemo(() => mealTotals(items, lookup), [items, foodMap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!foods || !profiles || !draft || !profile) return <div className="loading">Carico…</div>;

  const blocksFor = (p: Profile) => draft.blocksByProfile[p.id] ?? p.blocksPerMeal;
  const target = blocksFor(profile);
  const status = evaluate(totals, target, profile.tolerance);
  const split = kcalSplit(totals);
  const pool = allowedFoods(foods, profile);
  const advice = items.length ? balance({ items, lookup, targetBlocks: target, tolerance: profile.tolerance, pool }) : [];
  const others = profiles.filter((p) => p.id !== profile.id);

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const setItems = (fn: (xs: Ingredient[]) => Ingredient[]) => update((d) => ({ ...d, items: fn(d.items) }));
  const setGrams = (idx: number, g: number) =>
    setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, grams: Math.max(0, Math.round(g * 10) / 10) } : x)));
  const removeAt = (idx: number) => setItems((xs) => xs.filter((_, i) => i !== idx));
  const setTarget = (b: number) =>
    update((d) => ({ ...d, blocksByProfile: { ...d.blocksByProfile, [profile.id]: Math.min(12, Math.max(0.5, b)) } }));

  const add = (f: Food, grams?: number) => {
    const g = grams ?? f.portion?.grams ?? 100;
    setItems((xs) => {
      const i = xs.findIndex((x) => x.foodId === f.id);
      if (i >= 0) return xs.map((x, j) => (j === i ? { ...x, grams: x.grams + g } : x));
      return [...xs, { foodId: f.id, grams: g }];
    });
  };

  const apply = (a: Advice, s: Suggestion) => {
    const delta = a.direction === 'add' ? s.grams : -s.grams;
    setItems((xs) => {
      const i = xs.findIndex((x) => x.foodId === s.foodId);
      if (i < 0) return delta > 0 ? [...xs, { foodId: s.foodId, grams: delta }] : xs;
      const g = xs[i]!.grams + delta;
      return g <= 0.0001 ? xs.filter((_, j) => j !== i) : xs.map((x, j) => (j === i ? { ...x, grams: g } : x));
    });
  };

  const saveDish = async (name: string) => {
    const dish = buildComposite(newId('piatto'), name.trim(), items, lookup);
    await db.foods.add(dish);
    setSaving(null);
  };

  return (
    <div className="composer">
      <header className="ctl">
        <div className="seg" role="tablist" aria-label="Profilo">
          {profiles.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === profile.id}
              className={`seg__btn ${p.id === profile.id ? 'is-on' : ''}`}
              onClick={() => update((d) => ({ ...d, activeProfileId: p.id }))}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="stepper" aria-label="Blocchi del pasto">
          <button className="stepper__btn" onClick={() => setTarget(target - 0.5)} aria-label="Meno blocchi">
            −
          </button>
          <span className="stepper__val">
            <strong>{n1(target)}</strong> {blocchi(target)}
          </span>
          <button className="stepper__btn" onClick={() => setTarget(target + 0.5)} aria-label="Più blocchi">
            +
          </button>
        </div>
        <div className="chips">
          <button
            className={`chip ${target === profile.blocksPerMeal ? 'is-on' : ''}`}
            onClick={() => setTarget(profile.blocksPerMeal)}
          >
            Pasto · {n1(profile.blocksPerMeal)}
          </button>
          <button
            className={`chip ${target === profile.blocksPerSnack ? 'is-on' : ''}`}
            onClick={() => setTarget(profile.blocksPerSnack)}
          >
            Spuntino · {n1(profile.blocksPerSnack)}
          </button>
        </div>
      </header>

      <section className={`verdict ${items.length === 0 ? 'is-empty' : status.inZone ? 'is-in' : 'is-out'}`} aria-live="polite">
        <h1 className="verdict__title">
          {items.length === 0 ? 'Piatto vuoto' : status.inZone ? 'In Zona' : 'Fuori Zona'}
        </h1>
        <p className="verdict__line">
          {items.length === 0
            ? `Obiettivo ${profile.name}: ${n1(target)} ${blocchi(target)}.`
            : statusLine(status)}
        </p>
      </section>

      <MacroBars status={status} />
      <CalorieSplit split={split} kcal={totals.kcalMacro} />

      {items.length > 0 && others.length > 0 && (
        <ul className="others">
          {others.map((p) => {
            const s = evaluate(totals, blocksFor(p), p.tolerance);
            return (
              <li key={p.id}>
                <button className="others__btn" onClick={() => update((d) => ({ ...d, activeProfileId: p.id }))}>
                  <strong>{p.name}</strong> <span className="muted">{n1(blocksFor(p))} bl</span>{' '}
                  <span className={s.inZone ? 'ok' : ''}>{shortStatus(s)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {advice.length > 0 && (
        <section className="advice">
          <h2 className="h2">Come bilanciare</h2>
          {advice.map((a) => (
            <div key={a.macro} className={`advice__item advice__item--${a.macro}`}>
              <p className="advice__need">
                {a.direction === 'add' ? 'Mancano' : 'Troppi'}{' '}
                <strong>
                  {n1(a.blocks)} {blocchi(a.blocks)}
                </strong>{' '}
                {MACRO_OF[a.macro]} <span className="muted">({n1(a.grams)} g)</span>
              </p>
              <div className="advice__opts">
                {a.options.map((o) => (
                  <button key={o.foodId} className="opt" onClick={() => apply(a, o)}>
                    <span className="opt__main">
                      {a.direction === 'add' ? '+' : '−'}
                      {n0(o.grams)} g {o.foodName}
                      {o.removesItem && <span className="muted"> (tutto)</span>}
                    </span>
                    <span className="opt__sub">
                      {o.portionHint && <span>= {o.portionHint}</span>}
                      {o.inZoneAfter ? (
                        <span className="ok">→ in Zona</span>
                      ) : (
                        <span className="muted">
                          poi:{' '}
                          {MACROS.filter((m) => o.after[m] !== 'ok')
                            .map((m) => `${MACRO_SHORT[m]} ${o.after[m] === 'low' ? 'basso' : 'alto'}`)
                            .join(', ')}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
                {a.options.length === 0 && (
                  <p className="muted">Nessun alimento adatto in archivio per {profile.name}.</p>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="plate">
        <div className="plate__head">
          <h2 className="h2">Nel piatto</h2>
          <label className="toggle">
            <input type="checkbox" checked={game} onChange={(e) => setGame(e.target.checked)} />
            <span>Gioco</span>
          </label>
        </div>

        <ul className="items">
          {items.map((it, i) => {
            const f = foodMap.get(it.foodId);
            if (!f)
              return (
                <li key={i} className="item">
                  <span className="muted">Alimento eliminato</span>
                  <button className="btn btn--ghost" onClick={() => removeAt(i)}>
                    Togli
                  </button>
                </li>
              );
            const b = gramsToBlocks(foodMacros(f, it.grams));
            const step = stepFor(it.grams);
            const sliderMax = Math.max(50, Math.ceil((Math.max(it.grams * 2, (f.portion?.grams ?? 100) * 2)) / 10) * 10);
            return (
              <li key={i} className="item">
                <div className="item__top">
                  <span className="item__name">
                    {f.name} <SourceBadge food={f} />
                  </span>
                  <button className="x" onClick={() => removeAt(i)} aria-label={`Togli ${f.name}`}>
                    ×
                  </button>
                </div>
                <div className="item__row">
                  <div className="grams">
                    <button className="grams__btn" onClick={() => setGrams(i, it.grams - step)} aria-label="Meno">
                      −
                    </button>
                    <input
                      className="grams__in"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={Number.isFinite(it.grams) ? it.grams : 0}
                      onChange={(e) => setGrams(i, Number(e.target.value.replace(',', '.')) || 0)}
                      aria-label={`Grammi di ${f.name}`}
                    />
                    <span className="grams__u">g</span>
                    <button className="grams__btn" onClick={() => setGrams(i, it.grams + step)} aria-label="Più">
                      +
                    </button>
                  </div>
                  <span className="item__blocks">
                    <span className="c-protein">{n1(b.protein)}</span>
                    <span className="c-carbs">{n1(b.carbs)}</span>
                    <span className="c-fat">{n1(b.fat)}</span>
                  </span>
                </div>
                {game && (
                  <input
                    className="slider"
                    type="range"
                    min={0}
                    max={sliderMax}
                    step={step}
                    value={it.grams}
                    onChange={(e) => setGrams(i, Number(e.target.value))}
                    aria-label={`Grammi di ${f.name}`}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {items.length > 0 && <p className="legend muted">Blocchi per alimento: P · C · G</p>}

        <div className="plate__actions">
          <button className="btn btn--primary" onClick={() => setPicking(true)}>
            + Aggiungi alimento
          </button>
          {items.length > 0 && (
            <>
              <button className="btn" onClick={() => setSaving('')}>
                Salva come piatto
              </button>
              <button className="btn btn--ghost" onClick={() => setItems(() => [])}>
                Svuota
              </button>
            </>
          )}
        </div>

        {saving !== null && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (saving.trim()) void saveDish(saving);
            }}
          >
            <input
              autoFocus
              className="search"
              placeholder="Nome del piatto, es. Wrap kebab"
              value={saving}
              onChange={(e) => setSaving(e.target.value)}
            />
            <button className="btn btn--primary" type="submit" disabled={!saving.trim()}>
              Salva
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => setSaving(null)}>
              Annulla
            </button>
          </form>
        )}
      </section>

      {totals.missing.length > 0 && (
        <p className="muted">{totals.missing.length} alimenti non più in archivio, ignorati nei calcoli.</p>
      )}

      {picking && (
        <FoodPicker
          foods={foods}
          profile={profile}
          onClose={() => setPicking(false)}
          onPick={(f) => {
            add(f);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
