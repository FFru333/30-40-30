import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, EMPTY_DRAFT, type Draft } from '../../db/schema';
import type { Food, Ingredient } from '../../domain/food/types';
import { dailyKcalOf, dayBudget, type Profile } from '../../domain/profile/types';
import { BLOCK_KCAL } from '../../domain/profile/energy';
import { buildComposite } from '../../domain/food/composite';
import { MACROS, gramsToBlocks, type MacroGrams } from '../../domain/zone/blocks';
import { foodMacros, macroKcal, mealTotals, totalsWith } from '../../domain/zone/meal';
import type { ZoneStatus } from '../../domain/zone/status';
import { dayId, dayStatus, dayTolerance, eatenTotals, localDate, type DayLog } from '../../domain/zone/day';
import { dayPlans, planGroups, type Plan } from '../../domain/zone/plan';
import { balance, type Advice, type Suggestion } from '../../domain/zone/balance';
import { MacroSig } from '../../ui/MacroSig';
import { GramsInput } from '../../ui/GramsInput';
import { allowedFoods, newId, useFoodMap, useFoods, useProfiles } from '../../app/data';
import { DayBars } from '../../ui/DayBars';
import { IconPlus } from '../../ui/icons';
import { SourceBadge } from '../../ui/SourceBadge';
import { MACRO_LABEL, MACRO_OF, MACRO_SHORT, blocchi, n0, n1 } from '../../ui/format';
import { FoodPicker } from './FoodPicker';

const stepFor = (g: number) => (g < 20 ? 1 : 5);

const MOOD_COLOR = { in: '#b0c0af', out: '#bdabb1', empty: '#c9c7c0' } as const;
/** La barra del browser/telefono prende la tinta dello stato. */
function setThemeColor(mood: keyof typeof MOOD_COLOR) {
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = MOOD_COLOR[mood];
}

function balanceLine(s: ZoneStatus): string {
  const w = s.worst;
  if (!w) return 'Proteine, carboidrati e grassi della giornata sono allineati.';
  const b = Math.abs(w.deltaBlocks);
  return w.state === 'low'
    ? `Per bilanciare la giornata mancano ${n1(b)} ${blocchi(b)} ${MACRO_OF[w.macro]}.`
    : `${n1(b)} ${blocchi(b)} ${MACRO_OF[w.macro]} in più rispetto agli altri.`;
}

const PLAN_TITLE: Record<Plan['kind'], string> = {
  adapt: 'Bilancia',
  close: 'Pasto bilanciato',
  fill: 'Completa',
  fit: 'Resta nei blocchi',
};

function dayLabel(date: string): string {
  const today = localDate();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (date === today) return 'Oggi';
  if (date === localDate(y)) return 'Ieri';
  const [yy, mm, dd] = date.split('-').map(Number);
  return new Date(yy!, mm! - 1, dd!).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function shiftDate(date: string, days: number): string {
  const [yy, mm, dd] = date.split('-').map(Number);
  return localDate(new Date(yy!, mm! - 1, dd! + days));
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

export function Composer() {
  const foods = useFoods();
  const profiles = useProfiles();
  const foodMap = useFoodMap(foods);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [date, setDate] = useState(localDate);
  const [picking, setPicking] = useState(false);
  const [game, setGame] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Plan['kind'] | null>(null);
  const [openTweaks, setOpenTweaks] = useState<Set<string>>(() => new Set());
  const [justLogged, setJustLogged] = useState(false);

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
  const day = useLiveQuery(
    async (): Promise<DayLog | null> => (profile ? ((await db.days.get(dayId(profile.id, date))) ?? null) : null),
    [profile?.id, date],
  );
  const meals = useMemo(() => day?.meals ?? [], [day]);
  const items = draft?.items ?? [];
  const lookup = (id: string) => foodMap.get(id);

  const eaten = useMemo(() => eatenTotals(meals, lookup), [meals, foodMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const plateT = useMemo(() => mealTotals(items, lookup), [items, foodMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const plate: MacroGrams = { protein: plateT.protein, carbs: plateT.carbs, fat: plateT.fat };
  const budget = profile ? dayBudget(profile) : 0;
  const mealBlocks = profile ? Math.max(2, Math.round((budget / (profile.mealsPerDay + profile.snacksPerDay * 0.5)) * 2) / 2) : 4;
  const pool = useMemo(() => (foods && profile ? allowedFoods(foods, profile) : []), [foods, profile]);
  const dayTol = profile ? dayTolerance(profile.tolerance) : { protein: 1, carbs: 1, fat: 1 };

  const groups = useMemo(
    () =>
      profile && (items.length || meals.length)
        ? planGroups({ items, lookup, targetBlocks: 0, tolerance: dayTol, pool, base: eaten }, 5, (i) =>
            dayPlans({ ...i, budget, mealBlocks }),
          )
        : [],
    [items, meals, foodMap, profile, pool, eaten, budget, mealBlocks], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const group = groups.find((g) => g.kind === strategy) ?? groups[0];
  const tweakTarget = group?.targetBlocks ?? 0;
  const tweaks = useMemo(
    () =>
      profile && group
        ? balance({
            items,
            lookup,
            targetBlocks: tweakTarget,
            tolerance: dayTol,
            pool,
            maxOptions: 6,
            strict: false,
            base: eaten,
          })
        : [],
    [items, foodMap, tweakTarget, profile, pool, eaten, group], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const totals = totalsWith(items, lookup, eaten);
  const status = dayStatus(totals, budget, profile?.tolerance ?? { protein: 0.5, carbs: 0.5, fat: 0.5 });
  const nothing = items.length === 0 && meals.length === 0;
  const moodNow = nothing ? 'empty' : status.balance.inZone && !status.overBudget ? 'in' : 'out';
  useEffect(() => {
    document.documentElement.dataset.mood = moodNow;
    setThemeColor(moodNow);
  }, [moodNow]);

  if (!foods || !profiles || !draft || !profile || day === undefined) return <div className="loading">Carico…</div>;

  const kcal = dailyKcalOf(profile);
  const empty = items.length === 0;

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const setItems = (fn: (xs: Ingredient[]) => Ingredient[]) => update((d) => ({ ...d, items: fn(d.items) }));
  const setGrams = (idx: number, g: number) =>
    setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, grams: Math.max(0, Math.round(g * 10) / 10) } : x)));
  const removeAt = (idx: number) => setItems((xs) => xs.filter((_, i) => i !== idx));

  const add = (f: Food) => {
    const g = f.portion?.grams ?? 100;
    setItems((xs) => {
      const i = xs.findIndex((x) => x.foodId === f.id);
      if (i >= 0) return xs.map((x, j) => (j === i ? { ...x, grams: x.grams + g } : x));
      return [...xs, { foodId: f.id, grams: g }];
    });
  };

  const applyPlan = (p: Plan) => {
    setItems(() => p.items.map((x) => ({ ...x, grams: Math.round(x.grams * 10) / 10 })));
    setStrategy(null);
  };

  const applyTweak = (a: Advice, o: Suggestion) => {
    const delta = a.direction === 'add' ? o.grams : -o.grams;
    setItems((xs) => {
      const i = xs.findIndex((x) => x.foodId === o.foodId);
      if (i < 0) return delta > 0 ? [...xs, { foodId: o.foodId, grams: delta }] : xs;
      const g = xs[i]!.grams + delta;
      return g <= 0.0001 ? xs.filter((_, j) => j !== i) : xs.map((x, j) => (j === i ? { ...x, grams: g } : x));
    });
  };

  const logMeal = async () => {
    if (!items.length) return;
    const id = dayId(profile.id, date);
    const now = new Date();
    // Per un giorno passato, registra a mezzogiorno di quel giorno.
    const at = date === localDate() ? now.toISOString() : new Date(`${date}T12:00:00`).toISOString();
    const cur = (await db.days.get(id)) ?? { id, profileId: profile.id, date, meals: [] };
    await db.days.put({ ...cur, meals: [...cur.meals, { id: newId('pasto'), at, items }] });
    setItems(() => []);
    setJustLogged(true);
    window.dispatchEvent(new Event('mari-maybe'));
    window.setTimeout(() => setJustLogged(false), 2200);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeMeal = async (mealId: string) => {
    if (!day) return;
    await db.days.put({ ...day, meals: day.meals.filter((m) => m.id !== mealId) });
  };

  const reopenMeal = async (mealId: string) => {
    if (!day) return;
    const m = day.meals.find((x) => x.id === mealId);
    if (!m) return;
    await db.days.put({ ...day, meals: day.meals.filter((x) => x.id !== mealId) });
    setItems((xs) => {
      const out = [...xs];
      for (const it of m.items) {
        const i = out.findIndex((x) => x.foodId === it.foodId);
        if (i >= 0) out[i] = { ...out[i]!, grams: out[i]!.grams + it.grams };
        else out.push({ ...it });
      }
      return out;
    });
  };

  const saveDish = async (name: string) => {
    await db.foods.add(buildComposite(newId('piatto'), name.trim(), items, lookup));
    setSaving(null);
  };

  const plateB = gramsToBlocks(plate);
  const usedKcal = macroKcal(totals);

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
        <div className="datenav" aria-label="Giorno">
          <button onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="Giorno prima">
            ‹
          </button>
          <span>{dayLabel(date)}</span>
          <button
            onClick={() => setDate((d) => shiftDate(d, 1))}
            disabled={date >= localDate()}
            aria-label="Giorno dopo"
          >
            ›
          </button>
        </div>
      </header>

      <h1 className="title" aria-live="polite">
        {nothing ? (
          <>
            Giornata
            <br />
            libera
          </>
        ) : status.overBudget ? (
          <>
            Oltre il
            <br />
            budget
          </>
        ) : status.balance.inZone ? (
          <>
            In
            <br />
            Zona
          </>
        ) : (
          <>
            Da
            <br />
            bilanciare
          </>
        )}
      </h1>

      <div className="budget">
        <span className="budget__num">{n1(status.used)}</span>
        <span className="budget__of">
          / {n1(budget)} blocchi
          <small>
            {n0(usedKcal)} / {kcal ? `${n0(kcal)} kcal` : `${n0(budget * BLOCK_KCAL)} kcal`}
          </small>
        </span>
      </div>
      <p className="lede">
        {nothing
          ? `Hai ${n1(budget)} blocchi da distribuire come vuoi. Conta che a fine giornata proteine, carboidrati e grassi siano pari.`
          : `${status.left >= 0 ? `Restano ${n1(status.left)} blocchi.` : `${n1(-status.left)} blocchi oltre il budget.`} ${balanceLine(status.balance)}`}
      </p>
      {!kcal && (
        <p className="hint">
          <a href="#profili">Imposta peso, altezza e attività</a> per calcolare il budget di {profile.name}.
        </p>
      )}

      <DayBars eaten={eaten} plate={plate} day={status} />

      {meals.length > 0 && (
        <section className="section">
          <h2 className="h2">
            Pasti
            <br />
            di {dayLabel(date).toLowerCase()}
            <sup>{meals.length}</sup>
          </h2>
          <ul className="meals">
            {meals.map((m) => {
              const b = gramsToBlocks(mealTotals(m.items, lookup));
              const names = m.items.map((i) => foodMap.get(i.foodId)?.name ?? '—');
              return (
                <li key={m.id} className="meal">
                  <span className="meal__time">{timeOf(m.at)}</span>
                  <span className="meal__names">{names.join(', ')}</span>
                  <span className="meal__b">
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
                  <span className="meal__actions">
                    <button className="meal__btn" onClick={() => reopenMeal(m.id)}>
                      Modifica
                    </button>
                    <button className="x" onClick={() => removeMeal(m.id)} aria-label="Elimina pasto">
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
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
        {justLogged && <p className="toast">Pasto registrato.</p>}

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

        {!empty && (
          <p className="platesum">
            Questo piatto: <strong>P {n1(plateB.protein)}</strong> · <strong>C {n1(plateB.carbs)}</strong> ·{' '}
            <strong>G {n1(plateB.fat)}</strong> blocchi · {n0(plateT.kcalMacro)} kcal
          </p>
        )}

        <button className={empty ? 'add' : 'add add--ghost'} onClick={() => setPicking(true)}>
          <IconPlus size={20} />
          {empty ? 'Aggiungi alimento' : 'Aggiungi altro'}
        </button>

        {!empty && (
          <button className="add add--log" onClick={logMeal}>
            Registra pasto · {dayLabel(date).toLowerCase()}
          </button>
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
      </section>

      {group && (
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
                  {g.kind === 'close' && g.targetBlocks >= budget ? 'Chiudi la giornata' : PLAN_TITLE[g.kind]}
                </button>
              ))}
            </div>
          )}
          <p className="note">
            {group.kind === 'adapt'
              ? `Aggiungi al piatto quello che manca perché la giornata torni pari: ${n1(group.targetBlocks)} blocchi per macro, niente da togliere.`
              : group.targetBlocks >= budget
                ? `Un ultimo pasto che porta proteine, carboidrati e grassi a ${n1(budget)} blocchi: giornata chiusa e bilanciata.`
                : `Un pasto da circa ${n1(group.targetBlocks - status.used)} blocchi che lascia la giornata bilanciata a ${n1(group.targetBlocks)} su ${n1(budget)}.`}
            {group.targetBlocks > budget + 0.25 && ` Supera il budget di ${n1(group.targetBlocks - budget)} blocchi.`}
          </p>
          <div className="variants">
            {group.variants.map((p, vi) => {
              const main = p.changes[0]!;
              const rest = p.changes.slice(1);
              return (
                <div key={vi} className={`variant ${vi === 0 ? 'variant--first' : ''}`}>
                  <span className="variant__n">{vi === 0 ? 'Consigliato' : `Variante ${vi + 1}`}</span>
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
                    Metti nel piatto
                  </button>
                </div>
              );
            })}
          </div>

          {tweaks.length > 0 && (
            <>
              <h3 className="h3">Oppure un alimento alla volta</h3>
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
                          <span className="tweak__after">
                            {o.inZoneAfter
                              ? 'pari'
                              : MACROS.filter((m) => o.after[m] !== 'ok')
                                  .map((m) => `${MACRO_SHORT[m]}${o.after[m] === 'low' ? '↓' : '↑'}`)
                                  .join(' ')}
                          </span>
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

