import { defineStore } from 'pinia';
import type { Selectable } from 'kysely';
import type { Waypoint } from '@/db/schema';
import type { LatLng } from '@/types/latlng';

export const useWaypoints = defineStore('waypoints', {
  state: () => ({
    byTrail: {} as Record<number, Selectable<Waypoint>[]>,
    all: [] as Selectable<Waypoint>[],
  }),
  actions: {
    async refreshAll() {
      this.all = await this.$repos.waypoints.all();
    },
    async create(input: { name: string; latLng: LatLng; elev_m?: number | null }) {
      const id = await this.$repos.waypoints.create(input);
      await this.refreshAll();
      return id;
    },
    async loadForTrail(trailId: number) {
      this.byTrail[trailId] = await this.$repos.waypoints.forTrail(trailId);
    },
    async addToTrail(
      trailId: number,
      input: { name: string; latLng: LatLng; elev_m?: number | null; position?: number }
    ) {
      const { waypointId } = await this.$repos.waypoints.addToTrail({ trailId, ...input });
      await this.loadForTrail(trailId);
      return waypointId;
    },
    async attach(trailId: number, waypointId: number, position?: number) {
      await this.$repos.waypoints.attach(trailId, waypointId, position);
      await this.loadForTrail(trailId);
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
    async update(
      id: number,
      patch: { name?: string; latLng?: LatLng; elev_m?: number | null; description?: string | null }
    ) {
      await this.$repos.waypoints.update(id, patch);
    },
    async remove(id: number) {
      await this.$repos.waypoints.remove(id);
    },
    async withDistanceFrom(center: LatLng, opts?: { trailId?: number; limit?: number }) {
      return this.$repos.waypoints.withDistanceFrom(center, opts);
    },
  },
});
