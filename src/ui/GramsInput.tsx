import { useEffect, useState } from 'react';

const fmt = (g: number) => String(Math.round(g * 10) / 10).replace('.', ',');

/** Accetta "150", "150,5", "150.5"; restituisce null se il testo non è (ancora) un numero. */
export function parseGrams(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '' || t === '.') return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * Campo grammi: testo con tastiera decimale, così la virgola italiana funziona
 * (un input type="number" su iPhone la rifiuta e svuota il valore).
 * Mentre scrivi aggiorna il pasto a ogni cifra valida; uscendo dal campo ripulisce il testo.
 */
export function GramsInput({
  id,
  grams,
  onChange,
  label,
}: {
  id: string;
  grams: number;
  onChange: (g: number) => void;
  label: string;
}) {
  const [text, setText] = useState(fmt(grams));
  const [editing, setEditing] = useState(false);

  // Se i grammi cambiano da fuori (−/+, slider, "Applica"), mostra il nuovo valore.
  useEffect(() => {
    if (!editing) setText(fmt(grams));
  }, [grams, editing]);

  return (
    <input
      id={id}
      className="grams__in"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      value={text}
      aria-label={label}
      onFocus={(e) => {
        setEditing(true);
        e.target.select();
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.,]/g, '');
        setText(v);
        const g = parseGrams(v);
        if (g !== null) onChange(g);
      }}
      onBlur={() => {
        setEditing(false);
        setText(fmt(grams));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
