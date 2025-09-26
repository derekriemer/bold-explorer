import { defineStore } from 'pinia';
import type { Selectable } from 'kysely';
import type { Trail } from '@/db/schema';

export const useTrails = defineStore('trails', {
  state: () => ({ list: [] as Selectable<Trail>[] }),
  actions: {
    async refresh() {
      this.list = await this.$repos.trails.all();
    },
    async create(input: { name: string; description?: string | null }) {
      const id = await this.$repos.trails.create(input);
      await this.refresh();
      return id;
    },
    async rename(id: number, name: string) {
      await this.$repos.trails.rename(id, name);
      await this.refresh();
    },
    async remove(id: number) {
      await this.$repos.trails.remove(id);
      await this.refresh();
    },
  },
});
