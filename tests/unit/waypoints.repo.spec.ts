import { describe, it, expect } from 'vitest';
import { WaypointsRepo } from '@/data/repositories/waypoints.repo';
import { webDbAvailable, defineDbLifecycle } from './fixtures/test-db';

describe('WaypointsRepo.create validation', () => {
  it('rejects latitude outside [-90, 90]', async () => {
    const repo = new WaypointsRepo({} as any);
    await expect(repo.create({ name: 'WP', lat: 100, lon: 0 })).rejects.toThrow(
      /Invalid coordinates/
    );
    await expect(repo.create({ name: 'WP', lat: -91, lon: 0 })).rejects.toThrow(
      /Invalid coordinates/
    );
  });

  it('rejects longitude outside [-180, 180]', async () => {
    const repo = new WaypointsRepo({} as any);
    await expect(repo.create({ name: 'WP', lat: 0, lon: 181 })).rejects.toThrow(
      /Invalid coordinates/
    );
    await expect(repo.create({ name: 'WP', lat: 0, lon: -181 })).rejects.toThrow(
      /Invalid coordinates/
    );
  });
});

// DB-backed tests (skipped unless DB_NATIVE=1)
describe.skipIf(!webDbAvailable())('WaypointsRepo DB (web jeep-sqlite)', () => {
  const getDb = defineDbLifecycle();

  it('creates and lists a waypoint (timed)', async () => {
    const start = Date.now();
    const db = getDb();
    const repo = new WaypointsRepo(db as any);
    const id = await repo.create({ name: 'Valid', lat: 12.34, lon: 56.78 });
    expect(id).toBeGreaterThan(0);
    const all = await db.selectFrom('waypoint').selectAll().execute();
    const end = Date.now();
    // eslint-disable-next-line no-console
    console.log(`[web] create+list took ${end - start} ms`);
    expect(all.length).toBe(1);
    expect(all[0]?.name).toBe('Valid');
  });
});
