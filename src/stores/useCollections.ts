import { defineStore } from 'pinia';
import type { Collection, Waypoint, Trail } from '@/db/schema';

export const useCollections = defineStore('collections', {
  state: () => ({ list: [] as Collection[], contents: {} as Record<number, { waypoints: Waypoint[]; trails: Trail[] }> }),
  actions: {
    async refresh() {
      this.list = await this.$repos.collections.all();
    },
    async create(input: { name: string; description?: string | null }) {
      const id = await this.$repos.collections.create(input);
      await this.refresh();
      return id;
    },
    async addWaypoint(collectionId: number, waypointId: number) {
      await this.$repos.collections.addWaypoint(collectionId, waypointId);
      await this.loadContents(collectionId);
    },
    async removeWaypoint(collectionId: number, waypointId: number) {
      await this.$repos.collections.removeWaypoint(collectionId, waypointId);
      await this.loadContents(collectionId);
    },
    async addTrail(collectionId: number, trailId: number) {
      await this.$repos.collections.addTrail(collectionId, trailId);
      await this.loadContents(collectionId);
    },
    async removeTrail(collectionId: number, trailId: number) {
      await this.$repos.collections.removeTrail(collectionId, trailId);
      await this.loadContents(collectionId);
    },
    async loadContents(collectionId: number) {
      this.contents[collectionId] = await this.$repos.collections.contents(collectionId);
    }
  }
});
