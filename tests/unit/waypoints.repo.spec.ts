import { describe, it, expect } from 'vitest';
import { WaypointsRepo } from '@/data/repositories/waypoints.repo';
import { toLatLng } from '@/types/latlng';
import { webDbAvailable, defineDbLifecycle } from './fixtures/test-db';

describe('WaypointsRepo.create validation', () => {
  it('rejects latitude outside [-90, 90]', async () => {
    const repo = new WaypointsRepo({} as any);
<<<<<<< HEAD
    await expect(repo.create({ name: 'WP', lat: 100, lon: 0 })).rejects.toThrow(
      /Invalid coordinates/
    );
    await expect(repo.create({ name: 'WP', lat: -91, lon: 0 })).rejects.toThrow(
      /Invalid coordinates/
    );
=======
    await expect(
      repo.create({ name: 'WP', latLng: { lat: 100, lon: 0 } as any })
    ).rejects.toThrow(/Invalid/);
    await expect(
      repo.create({ name: 'WP', latLng: { lat: -91, lon: 0 } as any })
    ).rejects.toThrow(/Invalid/);
>>>>>>> 1b25e4d900e07625a8e45c8715c7e576215cf590
  });

  it('rejects longitude outside [-180, 180]', async () => {
    const repo = new WaypointsRepo({} as any);
<<<<<<< HEAD
    await expect(repo.create({ name: 'WP', lat: 0, lon: 181 })).rejects.toThrow(
      /Invalid coordinates/
    );
    await expect(repo.create({ name: 'WP', lat: 0, lon: -181 })).rejects.toThrow(
      /Invalid coordinates/
    );
=======
    await expect(
      repo.create({ name: 'WP', latLng: { lat: 0, lon: 181 } as any })
    ).rejects.toThrow(/Invalid/);
    await expect(
      repo.create({ name: 'WP', latLng: { lat: 0, lon: -181 } as any })
    ).rejects.toThrow(/Invalid/);
>>>>>>> 1b25e4d900e07625a8e45c8715c7e576215cf590
  });
});

// DB-backed tests (skipped unless DB_NATIVE=1)
describe.skipIf(!webDbAvailable())('WaypointsRepo DB (web jeep-sqlite)', () => {
  const getDb = defineDbLifecycle();

  it('creates and lists a waypoint (timed)', async () => {
    const start = Date.now();
    const db = getDb();
    const repo = new WaypointsRepo(db as any);
    const id = await repo.create({ name: 'Valid', latLng: toLatLng(12.34, 56.78) });
    expect(id).toBeGreaterThan(0);
    const all = await db.selectFrom('waypoint').selectAll().execute();
    const end = Date.now();
    // eslint-disable-next-line no-console
    console.log(`[web] create+list took ${end - start} ms`);
    expect(all.length).toBe(1);
    expect(all[0]?.name).toBe('Valid');
  });
});
