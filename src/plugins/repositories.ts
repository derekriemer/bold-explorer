import type { Pinia } from 'pinia';
import { markRaw } from 'vue';
import { initAppDb } from '@/db/factory';
import { TrailsRepo } from '@/data/repositories/trails.repo';
import { WaypointsRepo } from '@/data/repositories/waypoints.repo';
import { CollectionsRepo } from '@/data/repositories/collections.repo';
import { AutoWaypointsRepo } from '@/data/repositories/auto-waypoints.repo';

export interface Repos {
  trails: TrailsRepo;
  waypoints: WaypointsRepo;
  collections: CollectionsRepo;
  autoWaypoints: AutoWaypointsRepo;
}

declare module 'pinia' {
  interface PiniaCustomProperties {
    $repos: Repos;
  }
}

export async function installRepositories(pinia: Pinia) {
  const db = await initAppDb();
  // Avoid Vue proxying class instances that may use private fields internally
  const repos: Repos = markRaw({
    trails: markRaw(new TrailsRepo(db)),
    waypoints: markRaw(new WaypointsRepo(db)),
    collections: markRaw(new CollectionsRepo(db)),
    autoWaypoints: markRaw(new AutoWaypointsRepo(db))
  } as Repos);
  pinia.use(() => ({ $repos: repos }));
}
