import { describe, it, expect } from 'vitest';
import { webDbAvailable, defineDbLifecycle } from '../fixtures/test-db';
import { fetchWaypointsWithDistance } from '@/utils/geo';

describe.skipIf(!webDbAvailable())('utils.fetchWaypointsWithDistance', () => {
  const getDb = defineDbLifecycle();

  it('orders nearest first and respects limit', async () => {
    const db = getDb();
    await db
      .insertInto('waypoint')
      .values({
        name: 'near',
        lat: 0,
        lon: 0.1,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db
      .insertInto('waypoint')
      .values({
        name: 'mid',
        lat: 0,
        lon: 0.2,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db
      .insertInto('waypoint')
      .values({
        name: 'far',
        lat: 0,
        lon: 0.8,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();

    const res = await fetchWaypointsWithDistance(db as any, { lat: 0, lon: 0 }, { limit: 2 });
    const names = res.map((r) => r.name);
    expect(names).toEqual(['near', 'mid']);
    expect(res[0].distance_m).toBeLessThan(res[1].distance_m);
  });

  it('handles anti-meridian crossing (center +179.9)', async () => {
    const db = getDb();
    await db
      .insertInto('waypoint')
      .values({
        name: 'east',
        lat: 0,
        lon: 179.95,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db
      .insertInto('waypoint')
      .values({
        name: 'west',
        lat: 0,
        lon: -179.95,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db
      .insertInto('waypoint')
      .values({
        name: 'far',
        lat: 0,
        lon: 170.0,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();

    const res = await fetchWaypointsWithDistance(db as any, { lat: 0, lon: 179.9 }, { limit: 2 });
    const names = res.map((r) => r.name).sort();
    expect(names).toEqual(['east', 'west']);
  });

  it('handles anti-meridian crossing (center -179.9)', async () => {
    const db = getDb();
    await db
      .insertInto('waypoint')
      .values({
        name: 'west',
        lat: 0,
        lon: -179.95,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db
      .insertInto('waypoint')
      .values({
        name: 'east',
        lat: 0,
        lon: 179.95,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db
      .insertInto('waypoint')
      .values({
        name: 'far',
        lat: 0,
        lon: -170.0,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();

    const res = await fetchWaypointsWithDistance(db as any, { lat: 0, lon: -179.9 }, { limit: 2 });
    const names = res.map((r) => r.name).sort();
    expect(names).toEqual(['east', 'west']);
  });

  it('works at equator/prime meridian (0°,0°)', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .insertInto('waypoint')
      .values({ name: 'N', lat: 0.05, lon: 0, elev_m: null, description: null, created_at: now })
      .execute();
    await db
      .insertInto('waypoint')
      .values({ name: 'E', lat: 0, lon: 0.05, elev_m: null, description: null, created_at: now })
      .execute();
    await db
      .insertInto('waypoint')
      .values({ name: 'S', lat: -0.1, lon: 0, elev_m: null, description: null, created_at: now })
      .execute();
    await db
      .insertInto('waypoint')
      .values({ name: 'W', lat: 0, lon: -0.1, elev_m: null, description: null, created_at: now })
      .execute();

    const res = await fetchWaypointsWithDistance(db as any, { lat: 0, lon: 0 }, { limit: 3 });
    const names = res.map((r) => r.name);
    const firstTwo = new Set(names.slice(0, 2));
    expect(firstTwo).toEqual(new Set(['N', 'E']));
    expect(['S', 'W']).toContain(names[2]);
    expect(res[0].distance_m).toBeLessThanOrEqual(res[1].distance_m);
    expect(res[1].distance_m).toBeLessThan(res[2].distance_m);
  });

  it('skips longitude filter near poles (lat 89.9) and still sorts by true distance', async () => {
    const db = getDb();
    await db
      .insertInto('waypoint')
      .values({
        name: 'near1',
        lat: 89.95,
        lon: 0,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db
      .insertInto('waypoint')
      .values({
        name: 'near2',
        lat: 89.96,
        lon: 180,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db
      .insertInto('waypoint')
      .values({
        name: 'far',
        lat: 80,
        lon: 0,
        elev_m: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .execute();

    const res = await fetchWaypointsWithDistance(db as any, { lat: 89.9, lon: 45 }, { limit: 2 });
    const names = res.map((r) => r.name);
    expect(names[0]).toMatch(/near/);
    expect(names[1]).toMatch(/near/);
  });

  it('filters by trailId when provided', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const t1 = await db
      .insertInto('trail')
      .values({ name: 'T1', description: null, created_at: now })
      .returning('id')
      .executeTakeFirst();
    const t2 = await db
      .insertInto('trail')
      .values({ name: 'T2', description: null, created_at: now })
      .returning('id')
      .executeTakeFirst();
    const w1 = await db
      .insertInto('waypoint')
      .values({ name: 'W1', lat: 0, lon: 0.1, elev_m: null, description: null, created_at: now })
      .returning('id')
      .executeTakeFirst();
    const w2 = await db
      .insertInto('waypoint')
      .values({ name: 'W2', lat: 0, lon: 0.2, elev_m: null, description: null, created_at: now })
      .returning('id')
      .executeTakeFirst();
    await db
      .insertInto('trail_waypoint')
      .values({
        trail_id: Number(t2!.id),
        waypoint_id: Number(w1!.id),
        position: 1,
        created_at: now,
      })
      .execute();
    await db
      .insertInto('trail_waypoint')
      .values({
        trail_id: Number(t2!.id),
        waypoint_id: Number(w2!.id),
        position: 2,
        created_at: now,
      })
      .execute();

    const res1 = await fetchWaypointsWithDistance(
      db as any,
      { lat: 0, lon: 0 },
      { limit: 10, trailId: Number(t1!.id) }
    );
    expect(res1.length).toBe(0);

    const res2 = await fetchWaypointsWithDistance(
      db as any,
      { lat: 0, lon: 0 },
      { limit: 10, trailId: Number(t2!.id) }
    );
    const names = res2.map((r) => r.name);
    expect(names).toEqual(['W1', 'W2']);
  });
});
