import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ZoneDB } from './schema';
import { exportBackup, parseBackup, restoreBackup } from './backup';
import { SEED_FOODS } from '../data/seed-foods';

describe('backup', () => {
  it('il database nuovo contiene archivio e due profili', async () => {
    const db = new ZoneDB('t1');
    expect(await db.foods.count()).toBe(SEED_FOODS.length);
    expect((await db.profiles.toArray()).map((p) => p.name)).toEqual(['Luca', 'Marina']);
    db.close();
  });

  it('export → JSON → import ripristina gli stessi dati', async () => {
    const a = new ZoneDB('t2');
    await a.profiles.update('luca', { blocksPerMeal: 5 });
    const json = JSON.stringify(await exportBackup(a));

    const b = new ZoneDB('t3');
    await b.foods.clear();
    await restoreBackup(b, parseBackup(JSON.parse(json)));
    expect(await b.foods.count()).toBe(SEED_FOODS.length);
    expect((await b.profiles.get('luca'))?.blocksPerMeal).toBe(5);
    a.close();
    b.close();
  });

  it('rifiuta file estranei o corrotti', () => {
    expect(() => parseBackup({ hello: 1 })).toThrow(/non è un backup/);
    expect(() =>
      parseBackup({ format: 'zone-planner-backup', version: 1, foods: [{ id: 'x' }], profiles: [] }),
    ).toThrow(/Alimento n. 1/);
  });
});
