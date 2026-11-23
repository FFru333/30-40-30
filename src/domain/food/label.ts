import type { CarbBasis, DietTag, Food, Nutrients } from './types';

/** Istruzioni per leggere una tabella nutrizionale da foto. */
export const LABEL_PROMPT = `Sei un lettore di etichette alimentari. Le foto mostrano la confezione di UN prodotto:
la tabella nutrizionale e, se presente, il fronte con il nome.

Rispondi SOLO con un oggetto JSON con questa forma:
{"name": string, "brand": string|null, "per100": {"kcal": number, "protein": number, "carbs": number, "fiber": number, "fat": number},
 "carbBasis": "eu"|"us_total", "portionLabel": string|null, "portionGrams": number|null,
 "diet": "vegano"|"vegetariano"|"pesce"|"carne", "notes": string}

Regole:
- Valori per 100 g (o 100 ml). Se la tabella dà solo valori per porzione e indica il peso della porzione, convertili a 100 g.
- "carbs" è il valore della riga Carboidrati / Kohlenhydrate / Carbohydrate così com'è scritto (non sottrarre le fibre).
- "carbBasis": "eu" per etichette europee (carboidrati già senza fibre), "us_total" per etichette USA ("Total Carbohydrate").
- "fiber": riga Fibre / Ballaststoffe / Dietary Fiber; 0 se assente.
- "kcal": le kcal (non i kJ).
- "name": nome del prodotto in italiano, breve e riconoscibile; se c'è un nome commerciale usalo. Se non vedi il nome, descrivi il prodotto.
- "diet": deducilo da nome e ingredienti; nel dubbio "vegetariano".
- "portionLabel"/"portionGrams": porzione indicata in etichetta (es. "tortilla", 62), altrimenti null.
- "notes": in italiano, una frase su cosa non era leggibile o era incerto; stringa vuota se tutto chiaro.
- Usa il punto come separatore decimale. Non inventare valori: se un numero non è leggibile, metti -1.`;

export interface LabelReading {
  food: Food;
  /** Campi illeggibili (valore -1 o mancante). */
  unreadable: (keyof Nutrients)[];
  notes: string;
}

const KEYS: (keyof Nutrients)[] = ['kcal', 'protein', 'carbs', 'fiber', 'fat'];
const DIETS: DietTag[] = ['vegano', 'vegetariano', 'pesce', 'carne'];

function num(x: unknown): number | null {
  const v = typeof x === 'string' ? Number(x.replace(',', '.')) : x;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * Trasforma la risposta (non fidata) in una bozza di alimento da far controllare.
 * Lancia un errore leggibile se manca l'essenziale.
 */
export function parseLabelReading(raw: unknown): LabelReading {
  if (!raw || typeof raw !== 'object') throw new Error('Non sono riuscito a leggere l’etichetta.');
  const o = raw as Record<string, unknown>;
  const p = (o.per100 && typeof o.per100 === 'object' ? o.per100 : {}) as Record<string, unknown>;

  const per100 = {} as Nutrients;
  const unreadable: (keyof Nutrients)[] = [];
  for (const k of KEYS) {
    const v = num(p[k]);
    if (v === null) unreadable.push(k);
    per100[k] = v ?? 0;
  }
  if (unreadable.includes('protein') && unreadable.includes('carbs') && unreadable.includes('fat'))
    throw new Error('Nella foto non trovo una tabella nutrizionale leggibile.');
  // La fibra assente in etichetta è comune: non è un errore.
  const realUnreadable = unreadable.filter((k) => k !== 'fiber' || p.fiber === -1);

  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Prodotto senza nome';
  const brand = typeof o.brand === 'string' && o.brand.trim() ? o.brand.trim() : '';
  const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name;

  const carbBasis: CarbBasis = o.carbBasis === 'us_total' ? 'us_total' : 'eu';
  const diet: DietTag = DIETS.includes(o.diet as DietTag) ? (o.diet as DietTag) : 'vegetariano';
  const pg = num(o.portionGrams);
  const pl = typeof o.portionLabel === 'string' && o.portionLabel.trim() ? o.portionLabel.trim() : 'porzione';

  return {
    food: {
      id: '',
      name: fullName,
      per100,
      carbBasis,
      diet,
      ...(pg && pg > 0 ? { portion: { label: pl, grams: pg } } : {}),
      source: 'etichetta',
      sourceNote: 'Letto da foto dell’etichetta',
    },
    unreadable: realUnreadable,
    notes: typeof o.notes === 'string' ? o.notes.trim() : '',
  };
}
