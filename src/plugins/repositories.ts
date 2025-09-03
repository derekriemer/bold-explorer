import type { App } from 'vue';
import { initAppDb } from '@/db/factory';
import { TrailsRepo } from '@/data/repositories/trails.repo';
import { WaypointsRepo } from '@/data/repositories/waypoints.repo';
import { CollectionsRepo } from '@/data/repositories/collections.repo';
import { AutoWaypointsRepo } from '@/data/repositories/auto-waypoints.repo';

export const TRAILS_REPO_KEY = Symbol('TRAILS_REPO');
export const WAYPOINTS_REPO_KEY = Symbol('WAYPOINTS_REPO');
export const COLLECTIONS_REPO_KEY = Symbol('COLLECTIONS_REPO');
export const AUTO_WAYPOINTS_REPO_KEY = Symbol('AUTO_WAYPOINTS_REPO');

export async function installRepositories(app: App) {
  const db = await initAppDb();
  app.provide(TRAILS_REPO_KEY, new TrailsRepo(db));
  app.provide(WAYPOINTS_REPO_KEY, new WaypointsRepo(db));
  app.provide(COLLECTIONS_REPO_KEY, new CollectionsRepo(db));
  app.provide(AUTO_WAYPOINTS_REPO_KEY, new AutoWaypointsRepo(db));
}
