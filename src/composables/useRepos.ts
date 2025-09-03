import { inject } from 'vue';
import { TRAILS_REPO_KEY, WAYPOINTS_REPO_KEY, COLLECTIONS_REPO_KEY, AUTO_WAYPOINTS_REPO_KEY } from '@/plugins/repositories';
import type { TrailsRepo } from '@/data/repositories/trails.repo';
import type { WaypointsRepo } from '@/data/repositories/waypoints.repo';
import type { CollectionsRepo } from '@/data/repositories/collections.repo';
import type { AutoWaypointsRepo } from '@/data/repositories/auto-waypoints.repo';

export function useRepos() {
  const trails = inject<TrailsRepo>(TRAILS_REPO_KEY);
  const waypoints = inject<WaypointsRepo>(WAYPOINTS_REPO_KEY);
  const collections = inject<CollectionsRepo>(COLLECTIONS_REPO_KEY);
  const autoWaypoints = inject<AutoWaypointsRepo>(AUTO_WAYPOINTS_REPO_KEY);
  if (!trails || !waypoints || !collections || !autoWaypoints) {
    throw new Error('Repositories not provided');
  }
  return { trails, waypoints, collections, autoWaypoints };
}
