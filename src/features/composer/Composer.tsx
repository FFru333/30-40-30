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
import { MacroTiles, SplitChips } from '../../ui/MacroBars';
import { IconPlus } from '../../ui/icons';
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

  const heroState = items.length === 0 ? 'empty' : status.inZone ? 'in' : 'out';

  return (
    <div className="composer">
      <section className={`hero hero--${heroState}`}>
        <div className="hero__inner">
          <div className="hero__bar">
            <div className="glass-seg" role="tablist" aria-label="Profilo">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={p.id === profile.id}
                  className={`glass-seg__btn ${p.id === profile.id ? 'is-on' : ''}`}
                  onClick={() => update((d) => ({ ...d, activeProfileId: p.id }))}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="glass-step" aria-label="Blocchi del pasto">
              <button onClick={() => setTarget(target - 0.5)} aria-label="Meno blocchi">
                −
              </button>
              <span>
                <strong>{n1(target)}</strong> bl
              </span>
              <button onClick={() => setTarget(target + 0.5)} aria-label="Più blocchi">
                +
              </button>
            </div>
          </div>

          <div className="hero__kind">
            <button
              className={`kind ${target === profile.blocksPerMeal ? 'is-on' : ''}`}
              onClick={() => setTarget(profile.blocksPerMeal)}
            >
              Pasto {n1(profile.blocksPerMeal)}
            </button>
            <button
              className={`kind ${target === profile.blocksPerSnack ? 'is-on' : ''}`}
              onClick={() => setTarget(profile.blocksPerSnack)}
            >
              Spuntino {n1(profile.blocksPerSnack)}
            </button>
          </div>

          <h1 className="status" aria-live="polite">
            <span className="status__title">
              {items.length === 0 ? 'Piatto vuoto.' : status.inZone ? 'In Zona.' : 'Fuori Zona.'}
            </span>
            <span className="status__sub">
              {items.length === 0
                ? `${profile.name}: ${n1(target)} ${blocchi(target)} da comporre.`
                : statusLine(status)}
            </span>
          </h1>

          <div className="big">
            <span className="big__num">{n0(totals.kcalMacro)}</span>
            <span className="big__unit">kcal</span>
          </div>
          <SplitChips split={split} empty={items.length === 0} />
        </div>
      </section>

      <MacroTiles status={status} empty={items.length === 0} />

      {items.length > 0 && others.length > 0 && (
        <div className="others">
          {others.map((p) => {
            const s = evaluate(totals, blocksFor(p), p.tolerance);
            return (
              <button
                key={p.id}
                className="others__btn"
                onClick={() => update((d) => ({ ...d, activeProfileId: p.id }))}
              >
                <span className={`dot ${s.inZone ? 'dot--ok' : 'dot--warn'}`} />
                <strong>{p.name}</strong>
                <span className="muted">{n1(blocksFor(p))} bl</span>
                <span className="others__s">{shortStatus(s)}</span>
              </button>
            );
          })}
        </div>
      )}

      {advice.length > 0 && (
        <section className="section">
          <h2 className="section__title">
            Consigli. <span className="section__sub">Tocca per applicare.</span>
          </h2>
          {advice.map((a) => (
            <div key={a.macro} className={`card advice advice--${a.macro}`}>
              <div className="advice__head">
                <div>
                  <p className="advice__macro">{MACRO_LABEL[a.macro]}</p>
                  <p className="advice__need">
                    {a.direction === 'add' ? 'Mancano' : 'Troppi'} {n1(a.grams)} g
                  </p>
                </div>
                <p className="advice__big">
                  {a.direction === 'add' ? '+' : '−'}
                  {n1(a.blocks)}
                  <span>bl</span>
                </p>
              </div>
              <div className="advice__opts">
                {a.options.map((o) => (
                  <button key={o.foodId} className="opt" onClick={() => apply(a, o)}>
                    <span className="opt__g">
                      {a.direction === 'add' ? '+' : '−'}
                      {n0(o.grams)} g
                    </span>
                    <span className="opt__name">
                      {o.foodName}
                      {o.portionHint && <small> = {o.portionHint}</small>}
                      {o.removesItem && <small> (tutto)</small>}
                    </span>
                    <span className="opt__after">
                      {o.inZoneAfter ? (
                        <>
                          <span className="dot dot--ok" />
                          Zona
                        </>
                      ) : (
                        MACROS.filter((m) => o.after[m] !== 'ok')
                          .map((m) => `${MACRO_SHORT[m]} ${o.after[m] === 'low' ? '↓' : '↑'}`)
                          .join(' ')
                      )}
                    </span>
                  </button>
                ))}
                {a.options.length === 0 && (
                  <p className="muted small">Nessun alimento adatto in archivio per {profile.name}.</p>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <div className="section__row">
          <h2 className="section__title">Nel piatto.</h2>
          {items.length > 0 && (
            <label className="switch">
              <input type="checkbox" checked={game} onChange={(e) => setGame(e.target.checked)} />
              <span className="switch__track" />
              <span>Gioco</span>
            </label>
          )}
        </div>

        {items.length === 0 && (
          <button className="card empty-card" onClick={() => setPicking(true)}>
            <span className="empty-card__plus">
              <IconPlus size={22} />
            </span>
            <span>
              <strong>Aggiungi il primo alimento</strong>
              <small>Cerca, scegli un piatto pronto o scansiona un’etichetta.</small>
            </span>
          </button>
        )}

        <ul className="items">
          {items.map((it, i) => {
            const f = foodMap.get(it.foodId);
            if (!f)
              return (
                <li key={i} className="card item">
                  <div className="item__top">
                    <span className="muted">Alimento eliminato</span>
                    <button className="x" onClick={() => removeAt(i)} aria-label="Togli">
                      ×
                    </button>
                  </div>
                </li>
              );
            const b = gramsToBlocks(foodMacros(f, it.grams));
            const step = stepFor(it.grams);
            const sliderMax = Math.max(50, Math.ceil(Math.max(it.grams * 2, (f.portion?.grams ?? 100) * 2) / 10) * 10);
            return (
              <li key={i} className="card item">
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
                      id={`grams-${it.foodId}`}
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
                  <span className="item__blocks" aria-label="Blocchi P, C, G">
                    <span>
                      <i className="dot dot--protein" />
                      {n1(b.protein)}
                    </span>
                    <span>
                      <i className="dot dot--carbs" />
                      {n1(b.carbs)}
                    </span>
                    <span>
                      <i className="dot dot--fat" />
                      {n1(b.fat)}
                    </span>
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

        {items.length > 0 && (
          <div className="actions">
            <button className="pill" onClick={() => setSaving('')}>
              Salva come piatto
            </button>
            <button className="pill pill--ghost" onClick={() => setItems(() => [])}>
              Svuota
            </button>
          </div>
        )}

        {saving !== null && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (saving.trim()) void saveDish(saving);
            }}
          >
            <input
              id="dish-name"
              autoFocus
              className="search"
              placeholder="Nome del piatto, es. Wrap kebab"
              value={saving}
              onChange={(e) => setSaving(e.target.value)}
            />
            <button className="pill pill--solid" type="submit" disabled={!saving.trim()}>
              Salva
            </button>
            <button className="pill pill--ghost" type="button" onClick={() => setSaving(null)}>
              Annulla
            </button>
          </form>
        )}
      </section>

      {totals.missing.length > 0 && (
        <p className="muted small">{totals.missing.length} alimenti non più in archivio, ignorati nei calcoli.</p>
      )}

      <button className="fab" onClick={() => setPicking(true)} aria-label="Aggiungi alimento">
        <IconPlus size={26} />
      </button>

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
