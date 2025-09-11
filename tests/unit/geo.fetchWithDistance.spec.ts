import { describe, it, expect } from 'vitest';
import { webDbAvailable, defineDbLifecycle } from './fixtures/test-db';
import { fetchWaypointsWithDistance } from '@/utils/geo';

describe.skipIf(!webDbAvailable())('utils.fetchWaypointsWithDistance', () => {
  const getDb = defineDbLifecycle();

  it('orders nearest first and respects limit', async () => {
    const db = getDb();
    // Seed points at 0.1°, 0.2°, 0.8° from origin along lon (~11km, 22km, 89km)
    await db.insertInto('waypoint').values({ name: 'near', lat: 0, lon: 0.1, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();
    await db.insertInto('waypoint').values({ name: 'mid', lat: 0, lon: 0.2, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();
    await db.insertInto('waypoint').values({ name: 'far', lat: 0, lon: 0.8, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();

    const res = await fetchWaypointsWithDistance(db as any, { lat: 0, lon: 0 }, { limit: 2 });
    const names = res.map(r => r.name);
    expect(names).toEqual(['near', 'mid']);
    expect(res[0].distance_m).toBeLessThan(res[1].distance_m);
  });

  it('handles anti-meridian crossing (center +179.9)', async () => {
    const db = getDb();
    await db.insertInto('waypoint').values({ name: 'east', lat: 0, lon: 179.95, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();
    await db.insertInto('waypoint').values({ name: 'west', lat: 0, lon: -179.95, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();
    await db.insertInto('waypoint').values({ name: 'far', lat: 0, lon: 170.0, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();

    const res = await fetchWaypointsWithDistance(db as any, { lat: 0, lon: 179.9 }, { limit: 2 });
    const names = res.map(r => r.name).sort();
    expect(names).toEqual(['east', 'west']);
  });

  it('skips longitude filter near poles (lat 89.9) and still sorts by true distance', async () => {
    const db = getDb();
    await db.insertInto('waypoint').values({ name: 'near1', lat: 89.95, lon: 0, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();
    await db.insertInto('waypoint').values({ name: 'near2', lat: 89.96, lon: 180, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();
    await db.insertInto('waypoint').values({ name: 'far', lat: 80, lon: 0, elev_m: null, description: null, created_at: new Date().toISOString() }).execute();

    const res = await fetchWaypointsWithDistance(db as any, { lat: 89.9, lon: 45 }, { limit: 2 });
    const names = res.map(r => r.name);
    expect(names[0]).toMatch(/near/);
    expect(names[1]).toMatch(/near/);
  });

  it('filters by trailId when provided', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    // Create trails
    const t1 = await db.insertInto('trail').values({ name: 'T1', description: null, created_at: now }).returning('id').executeTakeFirst();
    const t2 = await db.insertInto('trail').values({ name: 'T2', description: null, created_at: now }).returning('id').executeTakeFirst();
    // Create waypoints
    const w1 = await db.insertInto('waypoint').values({ name: 'W1', lat: 0, lon: 0.1, elev_m: null, description: null, created_at: now }).returning('id').executeTakeFirst();
    const w2 = await db.insertInto('waypoint').values({ name: 'W2', lat: 0, lon: 0.2, elev_m: null, description: null, created_at: now }).returning('id').executeTakeFirst();
    // Attach only to trail 2
    await db.insertInto('trail_waypoint').values({ trail_id: Number(t2!.id), waypoint_id: Number(w1!.id), position: 1, created_at: now }).execute();
    await db.insertInto('trail_waypoint').values({ trail_id: Number(t2!.id), waypoint_id: Number(w2!.id), position: 2, created_at: now }).execute();

    const res1 = await fetchWaypointsWithDistance(db as any, { lat: 0, lon: 0 }, { limit: 10, trailId: Number(t1!.id) });
    expect(res1.length).toBe(0);

    const res2 = await fetchWaypointsWithDistance(db as any, { lat: 0, lon: 0 }, { limit: 10, trailId: Number(t2!.id) });
    const names = res2.map(r => r.name);
    expect(names).toEqual(['W1', 'W2']);
  });
});
