import Dexie, { type EntityTable } from 'dexie';
import type { Food, Ingredient } from '../domain/food/types';
import { DEFAULT_TOLERANCE, type Profile } from '../domain/profile/types';
import { SEED_FOODS } from '../data/seed-foods';
import type { DayLog } from '../domain/zone/day';

export interface Draft {
  id: 'current';
  items: Ingredient[];
  activeProfileId: string;
  /** Blocchi scelti per il pasto corrente, per profilo. */
  blocksByProfile: Record<string, number>;
}

export class ZoneDB extends Dexie {
  foods!: EntityTable<Food, 'id'>;
  profiles!: EntityTable<Profile, 'id'>;
  drafts!: EntityTable<Draft, 'id'>;
  days!: EntityTable<DayLog, 'id'>;

  constructor(name = 'zone-planner') {
    super(name);
    this.version(1).stores({
      foods: 'id, name, diet, source',
      profiles: 'id',
      drafts: 'id',
    });
    // v2: archivio allargato (~200 alimenti, sinonimi, tacos). Aggiunge ciò che manca
    // e i sinonimi agli alimenti iniziali, senza toccare i valori che avete modificato.
    this.version(2)
      .stores({ foods: 'id, name, diet, source', profiles: 'id', drafts: 'id' })
      .upgrade(async (tx) => {
        const table = tx.table<Food, string>('foods');
        const existing = new Map((await table.toArray()).map((f) => [f.id, f]));
        for (const seed of SEED_FOODS) {
          const cur = existing.get(seed.id);
          if (!cur) await table.add(seed);
          else if (seed.aliases && !cur.aliases) await table.update(seed.id, { aliases: seed.aliases });
        }
      });
    // v3: alcuni alimenti (zucchero, alcol, salse) non vengono più proposti nei consigli.
    this.version(3)
      .stores({ foods: 'id, name, diet, source', profiles: 'id', drafts: 'id' })
      .upgrade(async (tx) => {
        const table = tx.table<Food, string>('foods');
        for (const seed of SEED_FOODS) if (seed.suggest === false) await table.update(seed.id, { suggest: false });
      });
    // v4: la giornata. Pasti registrati per profilo e data; budget dalle calorie.
    this.version(4)
      .stores({ foods: 'id, name, diet, source', profiles: 'id', drafts: 'id', days: 'id, profileId, date' })
      .upgrade(async (tx) => {
        const luca = await tx.table<Profile, string>('profiles').get('luca');
        if (luca && luca.dailyKcal === undefined) await tx.table('profiles').update('luca', { dailyKcal: 3000 });
      });
    this.on('populate', (tx) => {
      tx.table('foods').bulkAdd(SEED_FOODS);
      tx.table('profiles').bulkAdd(DEFAULT_PROFILES);
      tx.table('drafts').add(EMPTY_DRAFT);
    });
  }
}

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: 'luca',
    name: 'Luca',
    diet: 'onnivoro',
    dailyKcal: 3000,
    blocksPerMeal: 4,
    mealsPerDay: 3,
    blocksPerSnack: 1,
    snacksPerDay: 2,
    tolerance: { ...DEFAULT_TOLERANCE },
    excludedFoodIds: [],
  },
  {
    id: 'marina',
    name: 'Marina',
    diet: 'pescetariano',
    blocksPerMeal: 3,
    mealsPerDay: 3,
    blocksPerSnack: 1,
    snacksPerDay: 2,
    tolerance: { ...DEFAULT_TOLERANCE },
    excludedFoodIds: [],
  },
];

export const EMPTY_DRAFT: Draft = {
  id: 'current',
  items: [],
  activeProfileId: 'luca',
  blocksByProfile: {},
};

export const db = new ZoneDB();

/** Chiede al browser di non cancellare i dati (importante su iPhone). */
export async function requestPersistence(): Promise<boolean | undefined> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage?.persist?.();
  } catch {
    return undefined;
  }
}
