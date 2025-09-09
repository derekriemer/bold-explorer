import { describe, it, expect } from 'vitest';
import { createTestDb } from '@/db/factory';
import { TrailsRepo } from '@/data/repositories/trails.repo';
import { WaypointsRepo } from '@/data/repositories/waypoints.repo';

// Temporarily disabled due to better-sqlite3 native binding constraints in sandbox/CI
describe.skip('TrailsRepo', () => {
  it('creates and removes trail with cascade', async () => {
    const db = await createTestDb();
    const trails = new TrailsRepo(db);
    const waypoints = new WaypointsRepo(db);
    const trailId = await trails.create({ name: 'Test' });
    await waypoints.addToTrail({ trailId, name: 'WP', lat: 0, lon: 0 });
    expect((await trails.all()).length).toBe(1);
    await trails.remove(trailId);
    expect((await trails.all()).length).toBe(0);
    expect((await waypoints.forTrail(trailId)).length).toBe(0);
  });
});
