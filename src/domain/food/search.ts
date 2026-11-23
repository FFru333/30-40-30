import type { Food } from './types';

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Cerca per nome e sinonimi. Ogni parola della ricerca deve comparire.
 * Ordine: nome che inizia con la ricerca, poi nome che la contiene, poi sinonimi.
 */
export function searchFoods(foods: Food[], query: string): Food[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return foods;
  const q = words.join(' ');
  const scored: { f: Food; rank: number }[] = [];
  for (const f of foods) {
    const name = normalize(f.name);
    const all = [name, ...(f.aliases ?? []).map(normalize)].join(' | ');
    if (!words.every((w) => all.includes(w))) continue;
    const rank = name.startsWith(q) ? 0 : words.every((w) => name.includes(w)) ? 1 : 2;
    scored.push({ f, rank });
  }
  return scored.sort((a, b) => a.rank - b.rank || a.f.name.localeCompare(b.f.name, 'it')).map((x) => x.f);
}
