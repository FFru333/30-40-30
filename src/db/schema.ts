import Dexie, { type EntityTable } from 'dexie';
import type { Food, Ingredient } from '../domain/food/types';
import { DEFAULT_TOLERANCE, type Profile } from '../domain/profile/types';
import { SEED_FOODS } from '../data/seed-foods';

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

  constructor(name = 'zone-planner') {
    super(name);
    this.version(1).stores({
      foods: 'id, name, diet, source',
      profiles: 'id',
      drafts: 'id',
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
