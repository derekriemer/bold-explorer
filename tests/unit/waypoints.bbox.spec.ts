import { describe, it, expect } from 'vitest';
import { webDbAvailable, defineDbLifecycle } from './fixtures/test-db';
import { WaypointsRepo } from '@/data/repositories/waypoints.repo';

describe.skipIf(!webDbAvailable())('WaypointsRepo.withDistanceFrom bbox behavior', () => {
  const getDb = defineDbLifecycle();

  it('includes candidates across the anti-meridian (center at +179.9)', async () => {
    const db = getDb();
    const repo = new WaypointsRepo(db as any);
    // Two close points on both sides of the dateline
    const idA = await repo.create({ name: 'A_east', lat: 0.0, lon: 179.95 });
    const idB = await repo.create({ name: 'B_west', lat: 0.0, lon: -179.95 });
    // Farther point
    await repo.create({ name: 'Far', lat: 0.0, lon: 170.0 });

    const center = { lat: 0.0, lon: 179.9 };
    const res = await repo.withDistanceFrom(center, { limit: 10 });
    const names = res.map(r => r.name);
    expect(names).toContain('A_east');
    expect(names).toContain('B_west');
    // The two close points should be the first two by distance
    expect(names.slice(0, 2).sort()).toEqual(['A_east', 'B_west']);
  });

  it('includes candidates across the anti-meridian (center at -179.9)', async () => {
    const db = getDb();
    const repo = new WaypointsRepo(db as any);
    await repo.create({ name: 'A_west', lat: 0.0, lon: -179.95 });
    await repo.create({ name: 'B_east', lat: 0.0, lon: 179.95 });
    await repo.create({ name: 'Far', lat: 0.0, lon: -170.0 });

    const center = { lat: 0.0, lon: -179.9 };
    const res = await repo.withDistanceFrom(center, { limit: 10 });
    const names = res.map(r => r.name);
    expect(names).toContain('A_west');
    expect(names).toContain('B_east');
    expect(names.slice(0, 2).sort()).toEqual(['A_west', 'B_east']);
  });

  it('does not filter by longitude near the poles and still sorts by true distance', async () => {
    const db = getDb();
    const repo = new WaypointsRepo(db as any);
    // Near the pole; different longitudes should all be considered
    await repo.create({ name: 'Near1', lat: 89.95, lon: 0.0 });
    await repo.create({ name: 'Near2', lat: 89.96, lon: 180.0 });
    await repo.create({ name: 'Far', lat: 80.0, lon: 0.0 });

    const center = { lat: 89.9, lon: 45.0 };
    const res = await repo.withDistanceFrom(center, { limit: 10 });
    const names = res.map(r => r.name);
    expect(names).toContain('Near1');
    expect(names).toContain('Near2');
    expect(names[0]).toMatch(/Near/); // nearest should be one of the near points
  });
});

