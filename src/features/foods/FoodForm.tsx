import { useState } from 'react';
import type { CarbBasis, DietTag, Food, Source } from '../../domain/food/types';
import { netCarbs } from '../../domain/zone/blocks';
import { n1 } from '../../ui/format';

type NumKey = 'kcal' | 'protein' | 'carbs' | 'fiber' | 'fat';
const NUM_FIELDS: { key: NumKey; label: string }[] = [
  { key: 'kcal', label: 'kcal' },
  { key: 'protein', label: 'Proteine g' },
  { key: 'carbs', label: 'Carboidrati g' },
  { key: 'fiber', label: 'Fibre g' },
  { key: 'fat', label: 'Grassi g' },
];

const toNum = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? v : NaN;
};

export function FoodForm({
  initial,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: Food;
  onSave: (f: Food) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [nums, setNums] = useState<Record<NumKey, string>>(() => {
    const o = {} as Record<NumKey, string>;
    for (const { key } of NUM_FIELDS) o[key] = String(Math.round(initial.per100[key] * 100) / 100).replace('.', ',');
    return o;
  });
  const [carbBasis, setCarbBasis] = useState<CarbBasis>(initial.carbBasis);
  const [diet, setDiet] = useState<DietTag>(initial.diet);
  const [source, setSource] = useState<Source>(initial.source);
  const [note, setNote] = useState(initial.sourceNote ?? '');
  const [pLabel, setPLabel] = useState(initial.portion?.label ?? '');
  const [pGrams, setPGrams] = useState(initial.portion ? String(initial.portion.grams) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parsed = Object.fromEntries(NUM_FIELDS.map(({ key }) => [key, toNum(nums[key])])) as Record<NumKey, number>;
  const invalid = NUM_FIELDS.filter(({ key }) => Number.isNaN(parsed[key])).map((f) => f.label);
  const macroSum = parsed.protein + parsed.carbs + parsed.fiber + parsed.fat;
  const tooMuch = macroSum > 100.5;
  const portionGrams = toNum(pGrams);
  const canSave = name.trim() && invalid.length === 0 && !tooMuch;
  const isComposite = !!initial.ingredients;

  const submit = () => {
    if (!canSave) return;
    onSave({
      ...initial,
      name: name.trim(),
      per100: parsed,
      carbBasis,
      diet,
      source,
      sourceNote: note.trim() || undefined,
      portion: pLabel.trim() && portionGrams > 0 ? { label: pLabel.trim(), grams: portionGrams } : undefined,
    });
  };

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="field">
        <span>Nome</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <fieldset className="field-group">
        <legend>Valori per 100 g</legend>
        <div className="grid5">
          {NUM_FIELDS.map(({ key, label }) => (
            <label key={key} className="field field--num">
              <span>{label}</span>
              <input
                inputMode="decimal"
                value={nums[key]}
                onChange={(e) => setNums((s) => ({ ...s, [key]: e.target.value }))}
                aria-invalid={Number.isNaN(parsed[key])}
                disabled={isComposite}
              />
            </label>
          ))}
        </div>
        {isComposite && <p className="muted small">Piatto composto: i valori sono calcolati dagli ingredienti.</p>}
        {tooMuch && <p className="warn small">P + C + fibre + G superano 100 g: controlla i valori.</p>}
      </fieldset>

      <fieldset className="field-group">
        <legend>I carboidrati in etichetta sono…</legend>
        <label className="radio">
          <input type="radio" checked={carbBasis === 'eu'} onChange={() => setCarbBasis('eu')} disabled={isComposite} />
          <span>
            <strong>Già senza fibre</strong> (etichette UE: Germania, Italia)
          </span>
        </label>
        <label className="radio">
          <input type="radio" checked={carbBasis === 'us_total'} onChange={() => setCarbBasis('us_total')} disabled={isComposite} />
          <span>
            <strong>Totali, fibre incluse</strong> (etichette USA)
          </span>
        </label>
        {!Number.isNaN(parsed.carbs) && !Number.isNaN(parsed.fiber) && (
          <p className="muted small">
            Carboidrati netti usati nei calcoli: {n1(netCarbs(parsed, carbBasis))} g / 100 g
          </p>
        )}
      </fieldset>

      <div className="grid2">
        <label className="field">
          <span>Tipo</span>
          <select value={diet} onChange={(e) => setDiet(e.target.value as DietTag)}>
            <option value="vegano">Vegano</option>
            <option value="vegetariano">Vegetariano (latticini, uova)</option>
            <option value="pesce">Pesce</option>
            <option value="carne">Carne</option>
          </select>
        </label>
        <label className="field">
          <span>Fonte</span>
          <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
            <option value="etichetta">Etichetta (verificato)</option>
            <option value="off">Open Food Facts</option>
            <option value="stima">Stima</option>
          </select>
        </label>
      </div>

      <div className="grid2">
        <label className="field">
          <span>Porzione tipica</span>
          <input placeholder="es. tortilla" value={pLabel} onChange={(e) => setPLabel(e.target.value)} />
        </label>
        <label className="field field--num">
          <span>Grammi porzione</span>
          <input inputMode="decimal" value={pGrams} onChange={(e) => setPGrams(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Nota sulla fonte</span>
        <input placeholder="es. Lidl, confezione 2025" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="form__actions">
        <button className="btn btn--primary" type="submit" disabled={!canSave}>
          Salva
        </button>
        <button className="btn btn--ghost" type="button" onClick={onCancel}>
          Annulla
        </button>
        {onDelete && (
          <button
            className="btn btn--danger"
            type="button"
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          >
            {confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
          </button>
        )}
      </div>
    </form>
  );
}
