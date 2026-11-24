import { useEffect, useState } from 'react';
import { db } from '../../db/schema';
import { exportBackup, parseBackup, restoreBackup, type Backup } from '../../db/backup';
import { SEED_FOODS } from '../../data/seed-foods';
import { DIET_LABEL, dailyKcalOf, dayBudget, type Diet, type Profile } from '../../domain/profile/types';
import { ACTIVITY, GOAL, bmr, tdee, type Activity, type Goal, type Sex } from '../../domain/profile/energy';
import { sortByName, useFoods, useProfiles } from '../../app/data';
import { n0, n1 } from '../../ui/format';

function Num({
  label,
  value,
  step = 1,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="numfield">
      <span className="numfield__label">{label}</span>
      <div className="stepper stepper--sm">
        <button className="stepper__btn" onClick={() => onChange(Math.max(min, value - step))} aria-label={`${label}: meno`}>
          −
        </button>
        <span className="stepper__val">
          <strong>{n1(value)}</strong>
        </span>
        <button className="stepper__btn" onClick={() => onChange(value + step)} aria-label={`${label}: più`}>
          +
        </button>
      </div>
    </div>
  );
}

/** Campo numerico testuale (virgola ok) che salva quando esci dal campo. */
function NumText({
  id,
  label,
  value,
  unit,
  onCommit,
}: {
  id: string;
  label: string;
  value: number | undefined;
  unit: string;
  onCommit: (v: number | undefined) => void;
}) {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  useEffect(() => setText(value ? String(value).replace('.', ',') : ''), [value]);
  return (
    <label className="field field--num" htmlFor={id}>
      <span>{label}</span>
      <span className="unitbox">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          placeholder="—"
          onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ''))}
          onBlur={() => {
            const v = Number(text.replace(',', '.'));
            onCommit(text.trim() && Number.isFinite(v) && v > 0 ? v : undefined);
          }}
        />
        <small>{unit}</small>
      </span>
    </label>
  );
}

function Energy({ p }: { p: Profile }) {
  const save = (patch: Partial<Profile>) => db.profiles.update(p.id, patch);
  const body = p.body;
  const setBody = (patch: Partial<NonNullable<Profile['body']>>) => {
    // Il sesso resta vuoto finché non lo scegli: serve alla formula, non lo indoviniamo.
    const next = { age: 0, weightKg: 0, heightCm: 0, ...body, ...patch } as NonNullable<Profile['body']>;
    void save({ body: next });
  };
  const complete = !!body && !!body.sex && body.age > 0 && body.weightKg > 0 && body.heightCm > 0;
  const activity = p.activity ?? 'leggero';
  const goal = p.goal ?? 'mantenere';
  const kcal = dailyKcalOf(p);

  return (
    <>
      <h3 className="h3">Fabbisogno</h3>
      <div className="seg seg--inline" role="radiogroup" aria-label="Sesso">
        {(['m', 'f'] as Sex[]).map((x) => (
          <button
            key={x}
            role="radio"
            aria-checked={body?.sex === x}
            className={`seg__btn ${body?.sex === x ? 'is-on' : ''}`}
            onClick={() => setBody({ sex: x })}
          >
            {x === 'm' ? 'Uomo' : 'Donna'}
          </button>
        ))}
      </div>
      <div className="grid3">
        <NumText id={`${p.id}-age`} label="Età" unit="anni" value={body?.age || undefined} onCommit={(v) => setBody({ age: v ?? 0 })} />
        <NumText id={`${p.id}-w`} label="Peso" unit="kg" value={body?.weightKg || undefined} onCommit={(v) => setBody({ weightKg: v ?? 0 })} />
        <NumText id={`${p.id}-h`} label="Altezza" unit="cm" value={body?.heightCm || undefined} onCommit={(v) => setBody({ heightCm: v ?? 0 })} />
      </div>
      <label className="field">
        <span>Attività</span>
        <select value={activity} onChange={(e) => save({ activity: e.target.value as Activity })}>
          {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
            <option key={a} value={a}>
              {ACTIVITY[a].label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Obiettivo</span>
        <select value={goal} onChange={(e) => save({ goal: e.target.value as Goal })}>
          {(Object.keys(GOAL) as Goal[]).map((g) => (
            <option key={g} value={g}>
              {GOAL[g].label}
            </option>
          ))}
        </select>
      </label>
      {complete && (
        <p className="calc">
          Metabolismo basale <strong>{n0(bmr(body!))} kcal</strong> · con l’attività <strong>{n0(tdee(body!, activity))} kcal</strong>
          {goal !== 'mantenere' && (
            <>
              {' '}
              · obiettivo <strong>{n0(tdee(body!, activity) * GOAL[goal].factor)} kcal</strong>
            </>
          )}
        </p>
      )}
      <NumText
        id={`${p.id}-kcal`}
        label="Oppure calorie al giorno, a mano (hanno la precedenza)"
        unit="kcal"
        value={p.dailyKcal}
        onCommit={(v) => save({ dailyKcal: v })}
      />
      <p className="calc">
        {kcal ? (
          <>
            Budget: <strong>{n0(kcal)} kcal = {n1(dayBudget(p))} blocchi</strong> al giorno (1 blocco = 91 kcal).
          </>
        ) : (
          <>Inserisci età, peso e altezza, oppure le calorie a mano.</>
        )}
      </p>
      <div className="nums">
        <Num label="Pasti al giorno" value={p.mealsPerDay} min={1} onChange={(v) => save({ mealsPerDay: v })} />
        <Num label="Spuntini al giorno" value={p.snacksPerDay} onChange={(v) => save({ snacksPerDay: v })} />
      </div>
      <p className="muted small">Servono solo a dimensionare i suggerimenti: puoi mangiare quando vuoi.</p>
    </>
  );
}

function ProfileCard({ p }: { p: Profile }) {
  const foods = useFoods() ?? [];
  const [adding, setAdding] = useState('');
  const [name, setName] = useState(p.name);
  const save = (patch: Partial<Profile>) => db.profiles.update(p.id, patch);
  const excluded = p.excludedFoodIds.map((id) => foods.find((f) => f.id === id)).filter(Boolean);

  return (
    <section className="card">
      <div className="card__head">
        <input
          className="card__name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== p.name && save({ name: name.trim() })}
          aria-label="Nome profilo"
        />
        <span className="card__total">
          <strong>{n1(dayBudget(p))}</strong> blocchi/giorno
        </span>
      </div>

      <label className="field">
        <span>Alimentazione</span>
        <select value={p.diet} onChange={(e) => save({ diet: e.target.value as Diet })}>
          {(Object.keys(DIET_LABEL) as Diet[]).map((d) => (
            <option key={d} value={d}>
              {DIET_LABEL[d]}
            </option>
          ))}
        </select>
      </label>

      <Energy p={p} />

      <h3 className="h3">Tolleranza per pasto (± blocchi; sulla giornata vale il doppio)</h3>
      <div className="nums">
        <Num label="Proteine" value={p.tolerance.protein} step={0.25} onChange={(v) => save({ tolerance: { ...p.tolerance, protein: v } })} />
        <Num label="Carboidrati" value={p.tolerance.carbs} step={0.25} onChange={(v) => save({ tolerance: { ...p.tolerance, carbs: v } })} />
        <Num label="Grassi" value={p.tolerance.fat} step={0.25} onChange={(v) => save({ tolerance: { ...p.tolerance, fat: v } })} />
      </div>
      <p className="muted small">
        ±{n1(p.tolerance.fat)} blocchi di grassi = ±{n1(p.tolerance.fat * 3)} g.
      </p>

      <h3 className="h3">Alimenti esclusi</h3>
      <ul className="tags">
        {excluded.map((f) => (
          <li key={f!.id} className="tag">
            {f!.name}
            <button
              className="x"
              aria-label={`Riammetti ${f!.name}`}
              onClick={() => save({ excludedFoodIds: p.excludedFoodIds.filter((x) => x !== f!.id) })}
            >
              ×
            </button>
          </li>
        ))}
        {excluded.length === 0 && <li className="muted small">Nessuno.</li>}
      </ul>
      <select
        value={adding}
        onChange={(e) => {
          const id = e.target.value;
          if (id) void save({ excludedFoodIds: [...p.excludedFoodIds, id] });
          setAdding('');
        }}
        aria-label="Escludi un alimento"
      >
        <option value="">Escludi un alimento…</option>
        {sortByName(foods.filter((f) => !p.excludedFoodIds.includes(f.id))).map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </section>
  );
}

function BackupSection() {
  const [msg, setMsg] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const doExport = async () => {
    const data = await exportBackup(db);
    const text = JSON.stringify(data);
    const name = `zone-planner-${data.exportedAt.slice(0, 10)}.json`;
    const file = new File([text], name, { type: 'application/json' });
    // Su telefono: condividi (AirDrop, WhatsApp, mail).
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Backup Zone Planner' });
        setMsg('Backup condiviso.');
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    // Altrimenti copia il testo: incollalo in una nota o in un messaggio.
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Backup copiato negli appunti. Incollalo in una nota o mandalo all’altro telefono.');
    } catch {
      setMsg('Non riesco né a condividere né a copiare il backup da qui.');
    }
  };

  const readBackup = (text: string) => {
    try {
      setPending(parseBackup(JSON.parse(text)));
      setMsg(null);
    } catch (e) {
      setPending(null);
      setMsg(e instanceof SyntaxError ? 'Il testo non è un backup valido (JSON).' : (e as Error).message);
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    await restoreBackup(db, pending);
    setPending(null);
    setPasting(false);
    setPasted('');
    setMsg('Backup importato.');
  };

  const restoreSeed = async () => {
    const existing = new Set(await db.foods.toCollection().primaryKeys());
    const missing = SEED_FOODS.filter((f) => !existing.has(f.id));
    await db.foods.bulkAdd(missing);
    setMsg(missing.length ? `${missing.length} alimenti ripristinati.` : 'Archivio iniziale già completo.');
  };

  return (
    <section className="card">
      <h2 className="card__title">Dati e backup.</h2>
      <p className="small">
        I dati stanno solo su questo telefono. Per passarli all’altro telefono: esporta qui, importa di là.
        L’import sostituisce tutto.
      </p>
      <p className="small muted">
        {persisted === true
          ? 'Archiviazione persistente attiva.'
          : 'Archiviazione non garantita: fai backup regolari.'}
      </p>
      <div className="form__actions">
        <button className="btn btn--primary" onClick={doExport}>
          Esporta backup
        </button>
        <label className="btn">
          Importa da file
          <input
            id="backup-file"
            type="file"
            accept="application/json,.json,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) readBackup(await f.text());
            }}
          />
        </label>
        <button className="btn" onClick={() => setPasting((x) => !x)}>
          Incolla backup
        </button>
        <button className="btn btn--ghost" onClick={restoreSeed}>
          Ripristina alimenti iniziali
        </button>
      </div>
      {pasting && (
        <div className="inline-form">
          <textarea
            id="backup-paste"
            className="paste"
            placeholder="Incolla qui il testo del backup"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button className="btn" disabled={!pasted.trim()} onClick={() => readBackup(pasted)}>
            Leggi
          </button>
        </div>
      )}
      {pending && (
        <div className="confirm">
          <p className="small">
            Sostituire tutti i dati con questo backup? {pending.foods.length} alimenti, {pending.profiles.length} profili
            {pending.exportedAt && `, del ${new Date(pending.exportedAt).toLocaleString('it-IT')}`}.
          </p>
          <div className="form__actions">
            <button className="btn btn--primary" onClick={confirmImport}>
              Sostituisci i dati
            </button>
            <button className="btn btn--ghost" onClick={() => setPending(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {msg && <p className="note">{msg}</p>}
    </section>
  );
}

export function ProfilesScreen() {
  const profiles = useProfiles();
  if (!profiles) return <div className="loading">Carico…</div>;
  return (
    <div className="screen">
      <header className="head">
        <h1 className="head__title">Profili.</h1>
        <p className="head__sub">Blocchi, tolleranze, backup.</p>
      </header>
      {profiles.map((p) => (
        <ProfileCard key={p.id} p={p} />
      ))}
      <BackupSection />
      <p className="muted small">
        Il budget è una stima (Mifflin–St Jeor): verifica dopo due o tre settimane con il peso reale e correggi.
      </p>
    </div>
  );
}
