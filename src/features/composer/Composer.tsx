import { useEffect, useMemo, useRef, useState } from 'react';
import { db, EMPTY_DRAFT, type Draft } from '../../db/schema';
import type { Food, Ingredient } from '../../domain/food/types';
import type { Profile } from '../../domain/profile/types';
import { buildComposite } from '../../domain/food/composite';
import { MACROS, gramsToBlocks } from '../../domain/zone/blocks';
import { foodMacros, kcalSplit, mealTotals } from '../../domain/zone/meal';
import { evaluate, type ZoneStatus } from '../../domain/zone/status';
import { planGroups, type Plan } from '../../domain/zone/plan';
import { balance, type Advice, type Suggestion } from '../../domain/zone/balance';
import { MacroSig } from '../../ui/MacroSig';
import { GramsInput } from '../../ui/GramsInput';
import { allowedFoods, newId, useFoodMap, useFoods, useProfiles } from '../../app/data';
import { BlockMatrix } from '../../ui/Blocks';
import { IconPlus } from '../../ui/icons';
import { SourceBadge } from '../../ui/SourceBadge';
import { MACRO_LABEL, MACRO_OF, MACRO_SHORT, blocchi, n0, n1, pct } from '../../ui/format';
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

const MOOD_COLOR = { in: '#b0c0af', out: '#bdabb1', empty: '#c9c7c0' } as const;
/** La barra del browser/telefono prende la tinta dello stato. */
function setThemeColor(mood: keyof typeof MOOD_COLOR) {
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = MOOD_COLOR[mood];
}

const PLAN_TITLE: Record<Plan['kind'], string> = {
  fill: 'Completa',
  adapt: 'Tieni tutto',
  fit: 'Resta nei blocchi',
};

const PLAN_NOTE: Record<Plan['kind'], string> = {
  fill: 'Aggiungi ciò che manca, il resto non cambia.',
  adapt: 'Non togli niente: gli altri macro crescono fino a quello in eccesso.',
  fit: 'Riduci ciò che eccede e completa, restando nei tuoi blocchi.',
};

export function Composer() {
  const foods = useFoods();
  const profiles = useProfiles();
  const foodMap = useFoodMap(foods);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [game, setGame] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Plan['kind'] | null>(null);

  // Carica la bozza una volta, poi la salva con un piccolo ritardo.
  useEffect(() => {
    db.drafts.get('current').then((d) => setDraft(d ?? EMPTY_DRAFT));
  }, []);
  const saveTimer = useRef<number | undefined>(undefined);
  const latest = useRef<Draft | null>(null);
  useEffect(() => {
    if (!draft) return;
    latest.current = draft;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void db.drafts.put(draft), 250);
  }, [draft]);
  // Se l'app va in background o si cambia schermata, salva subito: niente modifiche perse.
  useEffect(() => {
    const flush = () => {
      window.clearTimeout(saveTimer.current);
      if (latest.current) void db.drafts.put(latest.current);
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const profile: Profile | undefined = profiles?.find((p) => p.id === draft?.activeProfileId) ?? profiles?.[0];
  const items = draft?.items ?? [];
  const lookup = (id: string) => foodMap.get(id);
  const totals = useMemo(() => mealTotals(items, lookup), [items, foodMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocksFor = (p: Profile) => draft?.blocksByProfile[p.id] ?? p.blocksPerMeal;
  const target = profile ? blocksFor(profile) : 0;
  const pool = useMemo(() => (foods && profile ? allowedFoods(foods, profile) : []), [foods, profile]);
  const groups = useMemo(
    () =>
      profile && items.length
        ? planGroups({ items, lookup, targetBlocks: target, tolerance: profile.tolerance, pool }, 5)
        : [],
    [items, foodMap, target, profile, pool], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Ritocchi singoli: per ogni macro fuori tolleranza, più alimenti da aggiungere o ridurre.
  // Calcolati sui blocchi della strategia scelta: con "Tieni tutto" si completa fino al macro più alto.
  const tweakTarget = (groups.find((g) => g.kind === strategy) ?? groups[0])?.targetBlocks ?? target;
  const tweaks = useMemo(
    () =>
      profile && items.length
        ? balance({ items, lookup, targetBlocks: tweakTarget, tolerance: profile.tolerance, pool, maxOptions: 6, strict: false })
        : [],
    [items, foodMap, tweakTarget, profile, pool], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Il colore di fondo della pagina racconta lo stato del piatto.
  const moodNow = !profile || !items.length ? 'empty' : evaluate(totals, target, profile.tolerance).inZone ? 'in' : 'out';
  useEffect(() => {
    document.documentElement.dataset.mood = moodNow;
    setThemeColor(moodNow);
  }, [moodNow]);
  const [openTweaks, setOpenTweaks] = useState<Set<string>>(() => new Set());

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
    setStrategy(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyTweak = (a: Advice, o: Suggestion) => {
    const delta = a.direction === 'add' ? o.grams : -o.grams;
    if (tweakTarget !== target) setTarget(tweakTarget);
    setItems((xs) => {
      const i = xs.findIndex((x) => x.foodId === o.foodId);
      if (i < 0) return delta > 0 ? [...xs, { foodId: o.foodId, grams: delta }] : xs;
      const g = xs[i]!.grams + delta;
      return g <= 0.0001 ? xs.filter((_, j) => j !== i) : xs.map((x, j) => (j === i ? { ...x, grams: g } : x));
    });
  };

  const saveDish = async (name: string) => {
    await db.foods.add(buildComposite(newId('piatto'), name.trim(), items, lookup));
    setSaving(null);
  };

  const mood = empty ? 'empty' : status.inZone ? 'in' : 'out';
  const group = groups.find((g) => g.kind === strategy) ?? groups[0];

  return (
    <div className="composer">
      <header className="top">
        <div className="who" role="tablist" aria-label="Profilo">
          {profiles.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === profile.id}
              className={`who__btn ${p.id === profile.id ? 'is-on' : ''}`}
              onClick={() => update((d) => ({ ...d, activeProfileId: p.id }))}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="step" aria-label="Blocchi del pasto">
          <button onClick={() => setTarget(target - 0.5)} aria-label="Meno blocchi">
            −
          </button>
          <span>{n1(target)} bl</span>
          <button onClick={() => setTarget(target + 0.5)} aria-label="Più blocchi">
            +
          </button>
        </div>
      </header>

      <h1 className="title" aria-live="polite">
        {mood === 'empty' ? (
          <>
            Piatto
            <br />
            vuoto
          </>
        ) : mood === 'in' ? (
          <>
            In
            <br />
            Zona
          </>
        ) : (
          <>
            Fuori
            <br />
            Zona
          </>
        )}
      </h1>
      <p className="lede">{empty ? `${profile.name}: ${n1(target)} ${blocchi(target)} per pasto.` : statusLine(status)}</p>

      <div className="kinds">
        <button
          className={`kinds__btn ${target === profile.blocksPerMeal ? 'is-on' : ''}`}
          onClick={() => setTarget(profile.blocksPerMeal)}
        >
          Pasto<sup>{n1(profile.blocksPerMeal)}</sup>
        </button>
        <button
          className={`kinds__btn ${target === profile.blocksPerSnack ? 'is-on' : ''}`}
          onClick={() => setTarget(profile.blocksPerSnack)}
        >
          Spuntino<sup>{n1(profile.blocksPerSnack)}</sup>
        </button>
      </div>

      <BlockMatrix status={status} empty={empty} />

      <div className="sumrow">
        <span>Totale</span>
        <span className="sumrow__split">
          {empty ? '' : MACROS.map((m) => `${MACRO_SHORT[m]} ${pct(split[m])}`).join('  ')}
        </span>
        <strong>{n0(totals.kcalMacro)} kcal</strong>
      </div>

      {!empty && others.length > 0 && (
        <div className="others">
          {others.map((p) => {
            const s = evaluate(totals, blocksFor(p), p.tolerance);
            return (
              <button key={p.id} className="others__btn" onClick={() => update((d) => ({ ...d, activeProfileId: p.id }))}>
                <strong>{p.name}</strong> <span>{n1(blocksFor(p))} bl</span> <span>{shortStatus(s)}</span>
              </button>
            );
          })}
        </div>
      )}

      <section className="section">
        <div className="section__row">
          <h2 className="h2">
            Nel
            <br />
            piatto
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
                <li key={i} className="item">
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
              <li key={it.foodId} className="item">
                <div className="item__top">
                  <MacroSig food={f} label />
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
                    <GramsInput
                      id={`grams-${it.foodId}`}
                      grams={it.grams}
                      onChange={(g) => setGrams(i, g)}
                      label={`Grammi di ${f.name}`}
                    />
                    <span className="grams__u">g</span>
                    <button className="grams__btn" onClick={() => setGrams(i, it.grams + step)} aria-label="Più">
                      +
                    </button>
                  </div>
                  <span className="item__blocks" aria-label="Blocchi proteine, carboidrati, grassi">
                    <span>
                      <small>P</small>
                      {n1(b.protein)}
                    </span>
                    <span>
                      <small>C</small>
                      {n1(b.carbs)}
                    </span>
                    <span>
                      <small>G</small>
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

        <button className="add" onClick={() => setPicking(true)}>
          <IconPlus size={20} />
          {empty ? 'Aggiungi il primo alimento' : 'Aggiungi alimento'}
        </button>

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
      </section>

      {groups.length > 0 && group && (
        <section className="section">
          <h2 className="h2">
            Contro-
            <br />
            bilancia
          </h2>
          {groups.length > 1 && (
            <div className="seg" role="tablist" aria-label="Strategia">
              {groups.map((g) => (
                <button
                  key={g.kind}
                  role="tab"
                  aria-selected={g.kind === group.kind}
                  className={`seg__btn ${g.kind === group.kind ? 'is-on' : ''}`}
                  onClick={() => setStrategy(g.kind)}
                >
                  {PLAN_TITLE[g.kind]}
                  <sup>{n1(g.targetBlocks)} bl</sup>
                </button>
              ))}
            </div>
          )}
          <p className="note">
            {PLAN_NOTE[group.kind]}
            {group.targetBlocks > profile.blocksPerMeal * 1.25 &&
              ` Diventa un pasto da ${n1(group.targetBlocks)} blocchi, ${n1(group.targetBlocks / profile.blocksPerMeal)} volte il tuo.`}
          </p>
          <div className="variants">
            {group.variants.map((p, vi) => {
              const main = p.changes[0]!;
              const rest = p.changes.slice(1);
              return (
                <div key={vi} className={`variant ${vi === 0 ? 'variant--first' : ''}`}>
                  <span className="variant__n">
                    {vi === 0 ? 'Consigliato' : `Variante ${vi + 1}`}
                    {!p.after.inZone && ' · quasi'}
                  </span>
                  <span className="variant__g">
                    {main.deltaGrams > 0 ? '+' : '−'}
                    {n0(Math.abs(main.deltaGrams))} g
                  </span>
                  {foodMap.get(main.foodId) && <MacroSig food={foodMap.get(main.foodId)!} label size="lg" />}
                  <span className="variant__name">
                    {main.foodName}
                    {main.portionHint && <small> = {main.portionHint}</small>}
                  </span>
                  <ul className="variant__rest">
                    {rest.map((c) => (
                      <li key={c.foodId}>
                        <span>
                          {c.deltaGrams > 0 ? '+' : '−'}
                          {n0(Math.abs(c.deltaGrams))} g
                        </span>{' '}
                        {c.foodName}
                        {c.deltaGrams < 0 && c.newGrams > 0 && <small> → {n0(c.newGrams)} g</small>}
                      </li>
                    ))}
                  </ul>
                  <button className="variant__apply" onClick={() => applyPlan(p)}>
                    Applica
                  </button>
                </div>
              );
            })}
          </div>

          {tweaks.length > 0 && (
            <>
              <h3 className="h3">Oppure un ritocco alla volta{tweakTarget !== target && ` · a ${n1(tweakTarget)} bl`}</h3>
              {tweaks.map((a) => (
                <div key={a.macro} className="tweak">
                  <p className="tweak__need">
                    <strong>{MACRO_LABEL[a.macro]}</strong>{' '}
                    {a.direction === 'add' ? `mancano ${n1(a.blocks)} bl` : `${n1(a.blocks)} bl in più`}
                    <span> · {n1(a.grams)} g</span>
                  </p>
                  <div className="tweak__opts">
                    {(openTweaks.has(a.macro) ? a.options : a.options.slice(0, 3)).map((o) => {
                      const f = foodMap.get(o.foodId);
                      return (
                        <button key={o.foodId} className="tweak__opt" onClick={() => applyTweak(a, o)}>
                          {f && <MacroSig food={f} />}
                          <span className="tweak__txt">
                            <strong>
                              {a.direction === 'add' ? '+' : '−'}
                              {n0(o.grams)} g
                            </strong>{' '}
                            {o.foodName}
                            {o.portionHint && <small> = {o.portionHint}</small>}
                          </span>
                          <span className="tweak__after">{o.inZoneAfter ? 'Zona' : MACROS.filter((m) => o.after[m] !== 'ok').map((m) => `${MACRO_SHORT[m]}${o.after[m] === 'low' ? '↓' : '↑'}`).join(' ')}</span>
                        </button>
                      );
                    })}
                    {a.options.length === 0 && <p className="note">Nessun alimento adatto in archivio.</p>}
                    {a.options.length > 3 && !openTweaks.has(a.macro) && (
                      <button className="more" onClick={() => setOpenTweaks((s) => new Set([...s, a.macro]))}>
                        Altri {a.options.length - 3}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
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
