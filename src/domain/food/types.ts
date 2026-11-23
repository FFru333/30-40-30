/** Provenienza del dato nutrizionale. */
export type Source = 'etichetta' | 'off' | 'stima';

/**
 * Come è espresso il valore "carboidrati".
 * - `eu`: etichette UE (DE/IT). I carboidrati sono già al netto delle fibre.
 * - `us_total`: carboidrati totali (etichette USA). Le fibre vanno sottratte.
 */
export type CarbBasis = 'eu' | 'us_total';

export type DietTag = 'vegano' | 'vegetariano' | 'pesce' | 'carne';

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
}

export interface Portion {
  label: string;
  grams: number;
}

export interface Ingredient {
  foodId: string;
  grams: number;
}

export interface Food {
  id: string;
  name: string;
  /** Altri nomi per la ricerca (es. tedesco, sinonimi). */
  aliases?: string[];
  /** Valori per 100 g. */
  per100: Nutrients;
  carbBasis: CarbBasis;
  /** Il tag più restrittivo che descrive l'alimento. */
  diet: DietTag;
  portion?: Portion;
  source: Source;
  sourceNote?: string;
  /** Presente se l'alimento è un piatto composto da altri alimenti. */
  ingredients?: Ingredient[];
  /** Alimento dell'archivio iniziale (non creato dall'utente). */
  seed?: boolean;
}
