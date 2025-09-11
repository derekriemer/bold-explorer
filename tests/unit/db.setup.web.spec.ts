import { describe, it, expect } from 'vitest';
import { createTestDb } from '@/db/factory';
import { webDbAvailable } from './fixtures/test-db';

describe.skipIf(!webDbAvailable())('DB Setup (web jeep-sqlite)', () => {
  it('measures createTestDb() + migrations time', async () => {
    const start = Date.now();
    const db = await createTestDb();
    const end = Date.now();
    // eslint-disable-next-line no-console
    console.log(`[web-setup] took ${end - start} ms`);
    await db.destroy();
    expect(end - start).toBeGreaterThanOrEqual(0);
  });
});

