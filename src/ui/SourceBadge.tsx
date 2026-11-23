import type { Food } from '../domain/food/types';

const TITLE: Record<Food['source'], string> = {
  etichetta: 'Verificato da etichetta',
  off: 'Da Open Food Facts',
  stima: 'Stima: dato non verificato',
};

/** Mostra la fonte solo quando non è un'etichetta verificata. */
export function SourceBadge({ food, always = false }: { food: Food; always?: boolean }) {
  if (food.source === 'etichetta' && !always) return null;
  const text = food.source === 'stima' ? 'stima' : food.source === 'off' ? 'OFF' : 'etichetta';
  return (
    <span className={`badge badge--${food.source}`} title={TITLE[food.source]}>
      {text}
    </span>
  );
}
