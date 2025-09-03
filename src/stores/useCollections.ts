import { defineStore } from 'pinia';
import type { Collection, Waypoint, Trail } from '@/db/schema';
import { useRepos } from '@/composables/useRepos';

export const useCollections = defineStore('collections', {
  state: () => ({ list: [] as Collection[], contents: {} as Record<number, { waypoints: Waypoint[]; trails: Trail[] }> }),
  actions: {
    async refresh() {
      this.list = await useRepos().collections.all();
    },
    async create(input: { name: string; description?: string | null }) {
      const id = await useRepos().collections.create(input);
      await this.refresh();
      return id;
    },
    async addWaypoint(collectionId: number, waypointId: number) {
      await useRepos().collections.addWaypoint(collectionId, waypointId);
      await this.loadContents(collectionId);
    },
    async removeWaypoint(collectionId: number, waypointId: number) {
      await useRepos().collections.removeWaypoint(collectionId, waypointId);
      await this.loadContents(collectionId);
    },
    async addTrail(collectionId: number, trailId: number) {
      await useRepos().collections.addTrail(collectionId, trailId);
      await this.loadContents(collectionId);
    },
    async removeTrail(collectionId: number, trailId: number) {
      await useRepos().collections.removeTrail(collectionId, trailId);
      await this.loadContents(collectionId);
    },
    async loadContents(collectionId: number) {
      this.contents[collectionId] = await useRepos().collections.contents(collectionId);
    }
  }
});
