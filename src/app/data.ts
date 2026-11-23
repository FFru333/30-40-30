import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/schema';
import type { Food } from '../domain/food/types';
import { dietAllows, type Profile } from '../domain/profile/types';

export function useFoods(): Food[] | undefined {
  return useLiveQuery(() => db.foods.orderBy('name').toArray(), []);
}

export function useFoodMap(foods: Food[] | undefined): Map<string, Food> {
  return useMemo(() => new Map((foods ?? []).map((f) => [f.id, f])), [foods]);
}

export function useProfiles(): Profile[] | undefined {
  return useLiveQuery(() => db.profiles.toArray(), []);
}

/** Alimenti che il profilo può mangiare. */
export function allowedFoods(foods: Food[], p: Profile): Food[] {
  const excluded = new Set(p.excludedFoodIds);
  return foods.filter((f) => dietAllows(p.diet, f.diet) && !excluded.has(f.id));
}

export function whyNotAllowed(f: Food, p: Profile): string | null {
  if (p.excludedFoodIds.includes(f.id)) return `escluso per ${p.name}`;
  if (!dietAllows(p.diet, f.diet)) return `${f.diet}: non per ${p.name}`;
  return null;
}

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function sortByName<T extends { name: string }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
