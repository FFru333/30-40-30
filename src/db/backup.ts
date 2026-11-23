import type { Food } from '../domain/food/types';
import type { Profile } from '../domain/profile/types';
import type { Draft, ZoneDB } from './schema';

export const BACKUP_FORMAT = 'zone-planner-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  foods: Food[];
  profiles: Profile[];
  drafts: Draft[];
}

export async function exportBackup(db: ZoneDB): Promise<Backup> {
  const [foods, profiles, drafts] = await Promise.all([
    db.foods.toArray(),
    db.profiles.toArray(),
    db.drafts.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    foods,
    profiles,
    drafts,
  };
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;

function validFood(f: unknown): f is Food {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  const p = o.per100 as Record<string, unknown> | undefined;
  return (
    isStr(o.id) &&
    isStr(o.name) &&
    !!p &&
    ['kcal', 'protein', 'carbs', 'fiber', 'fat'].every((k) => isNum(p[k])) &&
    (o.carbBasis === 'eu' || o.carbBasis === 'us_total') &&
    ['vegano', 'vegetariano', 'pesce', 'carne'].includes(o.diet as string) &&
    ['etichetta', 'off', 'stima'].includes(o.source as string)
  );
}

function validProfile(p: unknown): p is Profile {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  const t = o.tolerance as Record<string, unknown> | undefined;
  return (
    isStr(o.id) &&
    isStr(o.name) &&
    isNum(o.blocksPerMeal) &&
    isNum(o.mealsPerDay) &&
    isNum(o.blocksPerSnack) &&
    isNum(o.snacksPerDay) &&
    !!t &&
    isNum(t.protein) &&
    isNum(t.carbs) &&
    isNum(t.fat) &&
    Array.isArray(o.excludedFoodIds)
  );
}

/** Controlla un backup letto da file. Lancia un errore leggibile se non è valido. */
export function parseBackup(raw: unknown): Backup {
  if (!raw || typeof raw !== 'object') throw new Error('Il file non è un backup valido.');
  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) throw new Error('Il file non è un backup di Zone Planner.');
  if (!isNum(o.version) || o.version > BACKUP_VERSION)
    throw new Error('Backup creato da una versione più recente dell’app.');
  if (!Array.isArray(o.foods) || !Array.isArray(o.profiles))
    throw new Error('Backup incompleto: mancano alimenti o profili.');
  const badFood = o.foods.findIndex((f) => !validFood(f));
  if (badFood >= 0) throw new Error(`Alimento n. ${badFood + 1} non valido.`);
  const badProfile = o.profiles.findIndex((p) => !validProfile(p));
  if (badProfile >= 0) throw new Error(`Profilo n. ${badProfile + 1} non valido.`);
  return {
    format: BACKUP_FORMAT,
    version: o.version,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
    foods: o.foods as Food[],
    profiles: o.profiles as Profile[],
    drafts: Array.isArray(o.drafts) ? (o.drafts as Draft[]) : [],
  };
}

/** Sostituisce tutti i dati con quelli del backup. */
export async function restoreBackup(db: ZoneDB, b: Backup): Promise<void> {
  await db.transaction('rw', db.foods, db.profiles, db.drafts, async () => {
    await Promise.all([db.foods.clear(), db.profiles.clear(), db.drafts.clear()]);
    await db.foods.bulkPut(b.foods);
    await db.profiles.bulkPut(b.profiles);
    if (b.drafts.length) await db.drafts.bulkPut(b.drafts);
  });
}
