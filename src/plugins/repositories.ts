import type { Pinia } from 'pinia';
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
  const repos: Repos = {
    trails: new TrailsRepo(db),
    waypoints: new WaypointsRepo(db),
    collections: new CollectionsRepo(db),
    autoWaypoints: new AutoWaypointsRepo(db)
  };
  pinia.use(() => ({ $repos: repos }));
}
