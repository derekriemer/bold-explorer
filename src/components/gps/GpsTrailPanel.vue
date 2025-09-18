<template>
  <div>
    <ion-item>
      <ion-label>Trail</ion-label>
      <ion-select
        v-model="internalSelectedId"
        interface="popover"
        placeholder="None selected"
      >
        <ion-select-option
          v-for="trail in trails"
          :key="trail.id"
          :value="trail.id"
        >
          {{ trail.name }}
        </ion-select-option>
      </ion-select>
    </ion-item>

    <ion-card v-if="!internalSelectedId" class="ion-margin-top">
      <ion-card-content>
        <div class="cta-row">
          <div>
            <div class="headline">Start a new trail</div>
            <div class="support">Record waypoints as you move. The + button adds points to this trail.</div>
          </div>
          <ion-button color="primary" @click="$emit('recordNewTrail')">Record New Trail</ion-button>
        </div>
      </ion-card-content>
    </ion-card>

    <ion-item v-if="internalSelectedId">
      <ion-label>
        <div>Current: {{ followState.current }}</div>
        <div>Next: {{ followState.nextName ?? '-' }}</div>
      </ion-label>
      <ion-button fill="outline" size="small" @click="$emit('toggleFollow')">
        {{ followState.active ? 'Stop' : 'Start' }}
      </ion-button>
    </ion-item>
  </div>
</template>

<script setup lang="ts">
import {
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardContent,
  IonButton,
} from '@ionic/vue';
import { computed } from 'vue';

const props = defineProps<{
  selectedId: number | null;
  trails: Array<{ id: number; name: string }>;
  followState: {
    active: boolean;
    current: number | string;
    nextName: string | null;
  };
}>();

const emit = defineEmits<{
  (e: 'update:selectedId', id: number | null): void;
  (e: 'recordNewTrail'): void;
  (e: 'toggleFollow'): void;
}>();

const internalSelectedId = computed({
  get: () => props.selectedId,
  set: (value: number | null) => emit('update:selectedId', value ?? null),
});
</script>

<style scoped>
.cta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.headline {
  font-weight: 600;
  margin-bottom: 4px;
}

.support {
  color: var(--ion-color-medium);
}
</style>
