import { defineStore } from 'pinia';
import type { Trail } from '@/db/schema';
import { useRepos } from '@/composables/useRepos';

export const useTrails = defineStore('trails', {
  state: () => ({ list: [] as Trail[] }),
  actions: {
    async refresh() {
      this.list = await useRepos().trails.all();
    },
    async create(input: { name: string; description?: string | null }) {
      const id = await useRepos().trails.create(input);
      await this.refresh();
      return id;
    },
    async rename(id: number, name: string) {
      await useRepos().trails.rename(id, name);
      await this.refresh();
    },
    async remove(id: number) {
      await useRepos().trails.remove(id);
      await this.refresh();
    }
  }
});
