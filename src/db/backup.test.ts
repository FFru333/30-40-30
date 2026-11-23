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

describe('aggiornamento archivio', () => {
  it('un database v1 riceve i nuovi alimenti e i sinonimi, senza perdere le modifiche', async () => {
    const Dexie = (await import('dexie')).default;
    const old = new Dexie('t-upgrade');
    old.version(1).stores({ foods: 'id, name, diet, source', profiles: 'id', drafts: 'id' });
    await old.open();
    await old.table('foods').add({ ...SEED_FOODS.find((f) => f.id === 'pollo')!, aliases: undefined, per100: { kcal: 1, protein: 99, carbs: 0, fiber: 0, fat: 0 } });
    old.close();

    const db = new ZoneDB('t-upgrade');
    const pollo = await db.foods.get('pollo');
    expect(pollo?.per100.protein).toBe(99);
    expect(pollo?.aliases).toContain('Hähnchenbrust');
    expect(await db.foods.get('taco-shells')).toBeDefined();
    db.close();
  });
});
