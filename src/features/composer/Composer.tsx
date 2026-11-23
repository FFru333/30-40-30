import { useEffect, useMemo, useRef, useState } from 'react';
import { db, EMPTY_DRAFT, type Draft } from '../../db/schema';
import type { Food, Ingredient } from '../../domain/food/types';
import type { Profile } from '../../domain/profile/types';
import { buildComposite } from '../../domain/food/composite';
import { MACROS, gramsToBlocks } from '../../domain/zone/blocks';
import { foodMacros, kcalSplit, mealTotals } from '../../domain/zone/meal';
import { evaluate, type ZoneStatus } from '../../domain/zone/status';
import { plans, type Plan } from '../../domain/zone/plan';
import { allowedFoods, newId, useFoodMap, useFoods, useProfiles } from '../../app/data';
import { MacroStats, Ring } from '../../ui/Ring';
import { IconPlus } from '../../ui/icons';
import { SourceBadge } from '../../ui/SourceBadge';
import { MACRO_LABEL, MACRO_OF, blocchi, n0, n1 } from '../../ui/format';
import { FoodPicker } from './FoodPicker';

function statusLine(s: ZoneStatus): string {
  const w = s.worst;
  if (!w) return 'Proteine, carboidrati e grassi sono in equilibrio.';
  const b = Math.abs(w.deltaBlocks);
  return w.state === 'low'
    ? `Mancano ${n1(b)} ${blocchi(b)} ${MACRO_OF[w.macro]}.`
    : `${n1(b)} ${blocchi(b)} ${MACRO_OF[w.macro]} in più: adegua il resto.`;
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

const stepFor = (g: number) => (g < 20 ? 1 : 5);

const PLAN_TITLE: Record<Plan['kind'], string> = {
  fill: 'Completa il piatto',
  adapt: 'Tieni tutto, adegua il resto',
  fit: 'Resta nei tuoi blocchi',
};

export function Composer() {
  const foods = useFoods();
  const profiles = useProfiles();
  const foodMap = useFoodMap(foods);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [game, setGame] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [exclude, setExclude] = useState<Set<string>>(() => new Set());

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

  const profile: Profile | undefined = profiles?.find((p) => p.id === draft?.activeProfileId) ?? profiles?.[0];
  const items = draft?.items ?? [];
  const lookup = (id: string) => foodMap.get(id);
  const totals = useMemo(() => mealTotals(items, lookup), [items, foodMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocksFor = (p: Profile) => draft?.blocksByProfile[p.id] ?? p.blocksPerMeal;
  const target = profile ? blocksFor(profile) : 0;
  const pool = useMemo(() => (foods && profile ? allowedFoods(foods, profile) : []), [foods, profile]);
  const planList = useMemo(
    () =>
      profile && items.length
        ? plans({ items, lookup, targetBlocks: target, tolerance: profile.tolerance, pool, exclude })
        : [],
    [items, foodMap, target, profile, pool, exclude], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!foods || !profiles || !draft || !profile) return <div className="loading">Carico…</div>;

  const status = evaluate(totals, target, profile.tolerance);
  const split = kcalSplit(totals);
  const empty = items.length === 0;
  const others = profiles.filter((p) => p.id !== profile.id);

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const setItems = (fn: (xs: Ingredient[]) => Ingredient[]) => update((d) => ({ ...d, items: fn(d.items) }));
  const setGrams = (idx: number, g: number) =>
    setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, grams: Math.max(0, Math.round(g * 10) / 10) } : x)));
  const removeAt = (idx: number) => setItems((xs) => xs.filter((_, i) => i !== idx));
  const setTarget = (b: number) =>
    update((d) => ({ ...d, blocksByProfile: { ...d.blocksByProfile, [profile.id]: Math.min(20, Math.max(0.5, b)) } }));

  const add = (f: Food) => {
    const g = f.portion?.grams ?? 100;
    setItems((xs) => {
      const i = xs.findIndex((x) => x.foodId === f.id);
      if (i >= 0) return xs.map((x, j) => (j === i ? { ...x, grams: x.grams + g } : x));
      return [...xs, { foodId: f.id, grams: g }];
    });
  };

  const applyPlan = (p: Plan) => {
    update((d) => ({
      ...d,
      items: p.items.map((x) => ({ ...x, grams: Math.round(x.grams * 10) / 10 })),
      blocksByProfile: { ...d.blocksByProfile, [profile.id]: p.targetBlocks },
    }));
    setExclude(new Set());
  };

  const saveDish = async (name: string) => {
    await db.foods.add(buildComposite(newId('piatto'), name.trim(), items, lookup));
    setSaving(null);
  };

  return (
    <div className="composer">
      <section className="hero">
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
              Pasto · {n1(profile.blocksPerMeal)}
            </button>
            <button
              className={`kind ${target === profile.blocksPerSnack ? 'is-on' : ''}`}
              onClick={() => setTarget(profile.blocksPerSnack)}
            >
              Spuntino · {n1(profile.blocksPerSnack)}
            </button>
            <button className="hero__add" onClick={() => setPicking(true)}>
              <IconPlus size={18} /> Aggiungi
            </button>
          </div>

          <Ring split={split} kcal={totals.kcalMacro} empty={empty} inZone={status.inZone} targetBlocks={target} />
          <p className="hero__line" aria-live="polite">
            {empty ? `Aggiungi alimenti: l’anello mostra la ripartizione rispetto a 30/40/30.` : statusLine(status)}
          </p>
          <MacroStats status={status} split={split} empty={empty} />

          {!empty && others.length > 0 && (
            <div className="others">
              {others.map((p) => {
                const s = evaluate(totals, blocksFor(p), p.tolerance);
                return (
                  <button key={p.id} className="others__btn" onClick={() => update((d) => ({ ...d, activeProfileId: p.id }))}>
                    <span className={`dot ${s.inZone ? 'dot--ok' : 'dot--warn'}`} />
                    <strong>{p.name}</strong>
                    <span className="muted">{n1(blocksFor(p))} bl</span>
                    <span className="others__s">{shortStatus(s)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section__row">
          <h2 className="section__title">
            Nel piatto. {!empty && <span className="section__sub">{items.length}</span>}
          </h2>
          {!empty && (
            <label className="switch">
              <input type="checkbox" checked={game} onChange={(e) => setGame(e.target.checked)} />
              <span className="switch__track" />
              <span>Slider</span>
            </label>
          )}
        </div>

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
              <li key={it.foodId} className="card item">
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
          <li>
            <button className="card add-row" onClick={() => setPicking(true)}>
              <span className="add-row__plus">
                <IconPlus size={20} />
              </span>
              <span>
                <strong>{empty ? 'Aggiungi il primo alimento' : 'Aggiungi alimento'}</strong>
                <small>Cerca, piatti pronti o scansiona un’etichetta</small>
              </span>
            </button>
          </li>
        </ul>
        {!empty && <p className="legend">Blocchi per alimento: proteine · carboidrati · grassi</p>}
      </section>

      {planList.length > 0 && (
        <section className="section">
          <h2 className="section__title">
            Bilancia. <span className="section__sub">Un tocco e sei in Zona.</span>
          </h2>
          {planList.map((p) => {
            const big = p.targetBlocks > profile.blocksPerMeal * 1.25;
            return (
              <div key={p.kind} className={`card plan plan--${p.kind}`}>
                <div className="plan__head">
                  <div>
                    <p className="plan__title">{PLAN_TITLE[p.kind]}</p>
                    <p className="plan__sub">
                      {p.after.inZone ? 'In Zona' : 'Più vicino alla Zona'} a {n1(p.targetBlocks)} blocchi
                      {big && ` · ${n1(p.targetBlocks / profile.blocksPerMeal)} pasti di ${profile.name}`}
                    </p>
                  </div>
                  <p className="plan__big">
                    {n1(p.targetBlocks)}
                    <span>bl</span>
                  </p>
                </div>
                <ul className="plan__list">
                  {p.changes.map((c) => (
                    <li key={c.foodId} className="plan__row">
                      <span className={`plan__g ${c.deltaGrams > 0 ? 'is-add' : 'is-cut'}`}>
                        {c.deltaGrams > 0 ? '+' : '−'}
                        {n0(Math.abs(c.deltaGrams))} g
                      </span>
                      <span className="plan__name">
                        {c.foodName}
                        <small>
                          {c.portionHint
                            ? ` = ${c.portionHint}`
                            : c.deltaGrams < 0
                              ? c.newGrams > 0
                                ? ` → ${n0(c.newGrams)} g`
                                : ' (tutto)'
                              : ''}
                        </small>
                      </span>
                      {c.deltaGrams > 0 && (
                        <button
                          className="plan__swap"
                          onClick={() => setExclude((s) => new Set([...s, c.foodId]))}
                          aria-label={`Proponi un’alternativa a ${c.foodName}`}
                          title="Un’altra opzione"
                        >
                          ↻
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button className="pill pill--solid plan__apply" onClick={() => applyPlan(p)}>
                  Applica
                </button>
              </div>
            );
          })}
          {exclude.size > 0 && (
            <button className="pill pill--ghost" onClick={() => setExclude(new Set())}>
              Ripristina le proposte iniziali
            </button>
          )}
        </section>
      )}

      {!empty && (
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

      {totals.missing.length > 0 && (
        <p className="muted small">{totals.missing.length} alimenti non più in archivio, ignorati nei calcoli.</p>
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
