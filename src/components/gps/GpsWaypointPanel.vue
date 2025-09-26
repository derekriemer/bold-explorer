<template>
  <ion-item>
    <ion-label>Waypoint</ion-label>
    <ion-select v-model="internalSelectedId" interface="popover" placeholder="None selected">
      <ion-select-option v-for="wp in waypoints" :key="wp.id" :value="wp.id">
        {{ wp.name }}
      </ion-select-option>
    </ion-select>
    <ion-button
      slot="end"
      fill="clear"
      color="medium"
      v-if="internalSelectedId != null"
      @click="clearSelection"
    >
      Clear
    </ion-button>
  </ion-item>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonSelect, IonSelectOption, IonButton } from '@ionic/vue';
import { computed } from 'vue';

const props = defineProps<{
  selectedId: number | null;
  waypoints: Array<{ id: number; name: string }>;
}>();

const emit = defineEmits<{ (e: 'update:selectedId', id: number | null): void }>();

const internalSelectedId = computed({
  get: () => props.selectedId,
  set: (value: number | null) => emit('update:selectedId', value ?? null),
});

function clearSelection() {
  emit('update:selectedId', null);
}
</script>
