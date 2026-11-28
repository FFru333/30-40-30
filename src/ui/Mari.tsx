import { useEffect, useState } from 'react';

const KEY = 'mari-last';
const GAP_MS = 3 * 60 * 60 * 1000; // al massimo una volta ogni 3 ore
const LINES = [
  'La Mari è stupenda.',
  'Promemoria del giorno: la Mari è stupenda.',
  'Dato verificato, fonte: etichetta. La Mari è stupenda.',
  'In Zona o no, la Mari è stupenda.',
  'Blocchi di stupore: 100% Mari.',
];

function lastShown(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0);
  } catch {
    return 0;
  }
}

function markShown() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* senza storage pazienza: al massimo compare un po' più spesso */
  }
}

/** Ogni tanto, a caso, ricorda una verità. Evento esterno: window.dispatchEvent(new Event('mari-maybe')). */
export function MariPopup() {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    const maybe = (chance: number) => {
      if (Date.now() - lastShown() < GAP_MS || Math.random() > chance) return;
      markShown();
      setLine(LINES[Math.floor(Math.random() * LINES.length)]!);
    };
    const t = window.setTimeout(() => maybe(0.25), 2500 + Math.random() * 6000);
    const onEvent = () => maybe(0.35);
    window.addEventListener('mari-maybe', onEvent);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('mari-maybe', onEvent);
    };
  }, []);

  useEffect(() => {
    if (!line) return;
    const t = window.setTimeout(() => setLine(null), 6000);
    return () => window.clearTimeout(t);
  }, [line]);

  if (!line) return null;
  return (
    <div className="mari" role="status" onClick={() => setLine(null)}>
      <span className="mari__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <p>{line}</p>
      <button className="mari__x" aria-label="Chiudi">
        ×
      </button>
    </div>
  );
}
