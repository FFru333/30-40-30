import { useEffect, useState } from 'react';
import { db } from '../../db/schema';
import { exportBackup, parseBackup, restoreBackup, type Backup } from '../../db/backup';
import { SEED_FOODS } from '../../data/seed-foods';
import { DIET_LABEL, dailyBlocks, type Diet, type Profile } from '../../domain/profile/types';
import { targetGrams } from '../../domain/zone/blocks';
import { sortByName, useFoods, useProfiles } from '../../app/data';
import { n1 } from '../../ui/format';

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

function ProfileCard({ p }: { p: Profile }) {
  const foods = useFoods() ?? [];
  const [adding, setAdding] = useState('');
  const [name, setName] = useState(p.name);
  const save = (patch: Partial<Profile>) => db.profiles.update(p.id, patch);
  const meal = targetGrams(p.blocksPerMeal);
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
          <strong>{n1(dailyBlocks(p))}</strong> blocchi/giorno
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

      <div className="nums">
        <Num label="Blocchi per pasto" value={p.blocksPerMeal} step={0.5} min={0.5} onChange={(v) => save({ blocksPerMeal: v })} />
        <Num label="Pasti al giorno" value={p.mealsPerDay} min={1} onChange={(v) => save({ mealsPerDay: v })} />
        <Num label="Blocchi per spuntino" value={p.blocksPerSnack} step={0.5} onChange={(v) => save({ blocksPerSnack: v })} />
        <Num label="Spuntini al giorno" value={p.snacksPerDay} onChange={(v) => save({ snacksPerDay: v })} />
      </div>
      <p className="muted small">
        Un pasto da {n1(p.blocksPerMeal)} blocchi = {n1(meal.protein)} g proteine, {n1(meal.carbs)} g carboidrati,{' '}
        {n1(meal.fat)} g grassi.
      </p>

      <h3 className="h3">Tolleranza (± blocchi)</h3>
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
      <h2 className="h2">Dati e backup</h2>
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
      <h1 className="h1">Profili</h1>
      {profiles.map((p) => (
        <ProfileCard key={p.id} p={p} />
      ))}
      <BackupSection />
      <p className="muted small">
        Blocchi di partenza (4 e 3 per pasto) da correggere: dipendono da massa magra, attività e obiettivo.
      </p>
    </div>
  );
}
