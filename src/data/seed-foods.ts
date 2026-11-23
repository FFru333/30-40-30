import type { DietTag, Food, Portion } from '../domain/food/types';

/**
 * Archivio iniziale. Valori per 100 g, carboidrati in formato UE (già al netto delle fibre).
 *
 * Solo planted.kebab è verificato da scheda produttore. Tutto il resto è una STIMA
 * da valori medi tipici: va verificato sull'etichetta del prodotto che comprate
 * e poi marcato come "etichetta" nell'app.
 */
type Row = [
  id: string,
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fiber: number,
  fat: number,
  diet: DietTag,
  portion?: Portion,
];

const ROWS: Row[] = [
  // Cereali, pane, amidi
  ['pasta-secca', 'Pasta di semola (cruda)', 359, 13, 71, 3, 1.5, 'vegano', { label: 'porzione', grams: 80 }],
  ['pasta-cotta', 'Pasta di semola (cotta)', 158, 5.8, 31, 1.8, 0.9, 'vegano'],
  ['pasta-integrale', 'Pasta integrale (cruda)', 352, 14, 64, 8, 2.5, 'vegano', { label: 'porzione', grams: 80 }],
  ['riso-crudo', 'Riso bianco (crudo)', 350, 7, 78, 1.4, 0.6, 'vegano', { label: 'porzione', grams: 70 }],
  ['riso-cotto', 'Riso bianco (cotto)', 130, 2.7, 28, 0.4, 0.3, 'vegano'],
  ['riso-integrale', 'Riso integrale (crudo)', 350, 7.5, 72, 3.5, 2.7, 'vegano', { label: 'porzione', grams: 70 }],
  ['couscous', 'Couscous (crudo)', 360, 12.5, 72, 3.5, 1.5, 'vegano', { label: 'porzione', grams: 70 }],
  ['quinoa', 'Quinoa (cruda)', 368, 14, 58, 7, 6, 'vegano', { label: 'porzione', grams: 60 }],
  ['avena', "Fiocchi d'avena", 372, 13.5, 58.7, 10, 7, 'vegano', { label: 'porzione', grams: 40 }],
  ['pane-comune', 'Pane comune', 270, 9, 53, 3, 1.5, 'vegano', { label: 'fetta', grams: 40 }],
  ['pane-integrale', 'Pane integrale (Vollkornbrot)', 215, 7, 38, 7.5, 1.5, 'vegano', { label: 'fetta', grams: 50 }],
  ['pane-segale', 'Pane di segale (Roggenbrot)', 210, 6.5, 40, 6.5, 1.2, 'vegano', { label: 'fetta', grams: 50 }],
  ['tortilla', 'Tortilla di frumento (wrap)', 310, 8.5, 50, 3, 7.5, 'vegano', { label: 'tortilla', grams: 62 }],
  ['gallette-riso', 'Gallette di riso', 380, 8, 80, 3, 2.8, 'vegano', { label: 'galletta', grams: 8 }],
  ['gnocchi', 'Gnocchi di patate', 150, 3.5, 32, 1.5, 0.4, 'vegano', { label: 'porzione', grams: 200 }],
  ['patate', 'Patate', 77, 2, 16, 2, 0.1, 'vegano', { label: 'patata media', grams: 150 }],
  ['patate-dolci', 'Patate dolci', 86, 1.6, 17, 3, 0.1, 'vegano'],
  ['mais', 'Mais in scatola (sgocciolato)', 80, 2.9, 14, 2.4, 1.2, 'vegano'],

  // Legumi
  ['ceci', 'Ceci in scatola (sgocciolati)', 125, 7, 14, 5, 2.6, 'vegano'],
  ['lenticchie', 'Lenticchie cotte', 112, 9, 12, 8, 0.4, 'vegano'],
  ['fagioli', 'Fagioli in scatola (sgocciolati)', 100, 7, 13, 6, 0.5, 'vegano'],
  ['piselli', 'Piselli surgelati', 70, 5, 9, 5, 0.4, 'vegano'],
  ['edamame', 'Edamame surgelati', 120, 11, 3.5, 5, 5, 'vegano'],
  ['hummus', 'Hummus', 280, 7, 12, 5, 22, 'vegano', { label: 'cucchiaio', grams: 15 }],

  // Proteine vegetali
  ['tofu', 'Tofu naturale', 130, 14, 1.5, 1, 7.5, 'vegano'],
  ['tempeh', 'Tempeh', 190, 19, 4, 5, 11, 'vegano'],
  ['seitan', 'Seitan', 140, 25, 5, 0.5, 2, 'vegano'],

  // Uova e latticini
  ['uovo', 'Uova intere', 143, 12.6, 0.7, 0, 9.5, 'vegetariano', { label: 'uovo', grams: 55 }],
  ['albume', "Albume d'uovo", 52, 11, 0.7, 0, 0.2, 'vegetariano'],
  ['feta', 'Feta', 264, 16, 0.5, 0, 21, 'vegetariano'],
  ['mozzarella', 'Mozzarella', 253, 18.7, 0.7, 0, 19.5, 'vegetariano', { label: 'mozzarella', grams: 125 }],
  ['mozzarella-light', 'Mozzarella light', 165, 19, 1, 0, 9.5, 'vegetariano', { label: 'mozzarella', grams: 125 }],
  ['parmigiano', 'Parmigiano', 392, 33, 0, 0, 28, 'vegetariano', { label: 'cucchiaio', grams: 10 }],
  ['ricotta', 'Ricotta', 140, 9, 3.5, 0, 10, 'vegetariano'],
  ['fiocchi-latte', 'Fiocchi di latte (Hüttenkäse)', 98, 12, 2.7, 0, 4.3, 'vegetariano'],
  ['quark', 'Quark magro (Magerquark)', 67, 12, 4, 0, 0.3, 'vegetariano'],
  ['skyr', 'Skyr', 63, 11, 4, 0, 0.2, 'vegetariano'],
  ['yogurt-greco', 'Yogurt greco 0%', 57, 10, 3.5, 0, 0.2, 'vegetariano', { label: 'vasetto', grams: 170 }],
  ['latte', 'Latte parzialmente scremato', 46, 3.4, 4.9, 0, 1.5, 'vegetariano'],
  ['bevanda-soia', 'Bevanda di soia (senza zucchero)', 33, 3.3, 0.2, 0.6, 1.8, 'vegano'],

  // Pesce
  ['tonno-naturale', 'Tonno al naturale (sgocciolato)', 105, 24, 0, 0, 1, 'pesce', { label: 'scatoletta', grams: 60 }],
  ['tonno-olio', "Tonno sott'olio (sgocciolato)", 190, 25, 0, 0, 10, 'pesce', { label: 'scatoletta', grams: 60 }],
  ['salmone', 'Salmone fresco', 200, 20, 0, 0, 13, 'pesce'],
  ['salmone-affumicato', 'Salmone affumicato', 180, 22, 0, 0, 10, 'pesce'],
  ['merluzzo', 'Merluzzo (Kabeljau)', 82, 18, 0, 0, 0.7, 'pesce'],
  ['gamberi', 'Gamberi', 85, 19, 0.5, 0, 1, 'pesce'],

  // Carne
  ['pollo', 'Petto di pollo (crudo)', 110, 23, 0, 0, 1.5, 'carne'],
  ['tacchino', 'Petto di tacchino (crudo)', 107, 24, 0, 0, 1, 'carne'],
  ['manzo-magro', 'Macinato di manzo 5%', 125, 21, 0, 0, 5, 'carne'],
  ['prosciutto-cotto', 'Prosciutto cotto magro', 120, 18, 1, 0, 4.5, 'carne', { label: 'fetta', grams: 20 }],
  ['bresaola', 'Bresaola', 151, 32, 0.5, 0, 2.6, 'carne'],

  // Grassi
  ['olio-evo', 'Olio extravergine di oliva', 899, 0, 0, 0, 99.9, 'vegano', { label: 'cucchiaino', grams: 4 }],
  ['burro', 'Burro', 740, 0.7, 0.6, 0, 82, 'vegetariano'],
  ['avocado', 'Avocado', 160, 2, 1.9, 6.7, 14.7, 'vegano', { label: 'mezzo avocado', grams: 70 }],
  ['mandorle', 'Mandorle', 600, 21, 6, 12, 52, 'vegano', { label: 'manciata', grams: 15 }],
  ['noci', 'Noci', 680, 15, 7, 6.7, 65, 'vegano', { label: 'noce', grams: 5 }],
  ['burro-arachidi', 'Burro di arachidi 100%', 610, 26, 9, 8, 50, 'vegano', { label: 'cucchiaino', grams: 8 }],
  ['olive', 'Olive verdi', 145, 1, 0.5, 3.3, 15, 'vegano'],

  // Verdure
  ['zucchine', 'Zucchine', 17, 1.2, 1.8, 1.1, 0.3, 'vegano'],
  ['pomodori', 'Pomodori', 18, 0.9, 2.6, 1.2, 0.2, 'vegano'],
  ['passata', 'Passata di pomodoro', 30, 1.4, 4.5, 1.5, 0.2, 'vegano'],
  ['spinaci', 'Spinaci', 23, 2.9, 0.6, 2.2, 0.4, 'vegano'],
  ['broccoli', 'Broccoli', 34, 2.8, 2.7, 3, 0.4, 'vegano'],
  ['peperoni', 'Peperoni rossi', 31, 1, 4.6, 2.1, 0.3, 'vegano'],
  ['insalata', 'Insalata verde', 15, 1.3, 1.5, 1.2, 0.2, 'vegano'],
  ['cipolla', 'Cipolla', 40, 1.1, 7.6, 1.7, 0.1, 'vegano'],
  ['carote', 'Carote', 41, 0.9, 6.8, 2.8, 0.2, 'vegano'],
  ['funghi', 'Funghi champignon', 22, 3.1, 0.6, 1, 0.3, 'vegano'],
  ['melanzane', 'Melanzane', 25, 1, 2.9, 3, 0.2, 'vegano'],
  ['cetriolo', 'Cetriolo', 15, 0.6, 2.2, 0.5, 0.1, 'vegano'],

  // Frutta
  ['mela', 'Mela', 52, 0.3, 11.4, 2.4, 0.2, 'vegano', { label: 'mela media', grams: 150 }],
  ['banana', 'Banana', 89, 1.1, 20, 2.6, 0.3, 'vegano', { label: 'banana media', grams: 120 }],
  ['arancia', 'Arancia', 47, 0.9, 9, 2.4, 0.1, 'vegano', { label: 'arancia media', grams: 150 }],
  ['kiwi', 'Kiwi', 61, 1.1, 10, 3, 0.5, 'vegano', { label: 'kiwi', grams: 75 }],
  ['frutti-bosco', 'Frutti di bosco surgelati', 45, 1, 7, 4, 0.4, 'vegano'],

  // Piatti pronti
  ['pizza-tonno', 'Pizza al tonno (pizzeria)', 240, 11.5, 29, 2, 8.5, 'pesce', { label: 'pizza intera', grams: 380 }],
];

export const PLANTED_KEBAB: Food = {
  id: 'planted-kebab',
  name: 'planted.kebab Original',
  per100: { kcal: 197, protein: 22, carbs: 2.7, fiber: 4.2, fat: 10 },
  carbBasis: 'eu',
  diet: 'vegano',
  portion: { label: 'confezione', grams: 160 },
  source: 'etichetta',
  sourceNote: 'Scheda produttore',
  seed: true,
};

export const SEED_FOODS: Food[] = [
  PLANTED_KEBAB,
  ...ROWS.map(([id, name, kcal, protein, carbs, fiber, fat, diet, portion]): Food => ({
    id,
    name,
    per100: { kcal, protein, carbs, fiber, fat },
    carbBasis: 'eu',
    diet,
    ...(portion ? { portion } : {}),
    source: 'stima',
    sourceNote: 'Valore medio tipico: verificare in etichetta',
    seed: true,
  })),
];
