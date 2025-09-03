import { defineStore } from 'pinia';
import type { Waypoint } from '@/db/schema';
import { useRepos } from '@/composables/useRepos';

export const useWaypoints = defineStore('waypoints', {
  state: () => ({ byTrail: {} as Record<number, Waypoint[]> }),
  actions: {
    async loadForTrail(trailId: number) {
      this.byTrail[trailId] = await useRepos().waypoints.forTrail(trailId);
    },
    async addToTrail(trailId: number, input: { name: string; lat: number; lon: number; elev_m?: number | null; position?: number }) {
      const { waypointId } = await useRepos().waypoints.addToTrail({ trailId, ...input });
      await this.loadForTrail(trailId);
      return waypointId;
    },
    async detach(trailId: number, waypointId: number) {
      await useRepos().waypoints.detach(trailId, waypointId);
      await this.loadForTrail(trailId);
    },
    async setPosition(trailId: number, waypointId: number, position: number) {
      await useRepos().waypoints.setPosition(trailId, waypointId, position);
      await this.loadForTrail(trailId);
    },
    async rename(id: number, name: string) {
      await useRepos().waypoints.rename(id, name);
    },
    async remove(id: number) {
      await useRepos().waypoints.remove(id);
    }
  }
});
