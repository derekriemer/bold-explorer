import { defineStore } from 'pinia';
import type { Waypoint } from '@/db/schema';

export const useWaypoints = defineStore('waypoints', {
  state: () => ({ byTrail: {} as Record<number, Waypoint[]> }),
  actions: {
    async loadForTrail(trailId: number) {
      this.byTrail[trailId] = await this.$repos.waypoints.forTrail(trailId);
    },
    async addToTrail(trailId: number, input: { name: string; lat: number; lon: number; elev_m?: number | null; position?: number }) {
      const { waypointId } = await this.$repos.waypoints.addToTrail({ trailId, ...input });
      await this.loadForTrail(trailId);
      return waypointId;
    },
    async detach(trailId: number, waypointId: number) {
      await this.$repos.waypoints.detach(trailId, waypointId);
      await this.loadForTrail(trailId);
    },
    async setPosition(trailId: number, waypointId: number, position: number) {
      await this.$repos.waypoints.setPosition(trailId, waypointId, position);
      await this.loadForTrail(trailId);
    },
    async rename(id: number, name: string) {
      await this.$repos.waypoints.rename(id, name);
    },
    async remove(id: number) {
      await this.$repos.waypoints.remove(id);
    }
  }
});
