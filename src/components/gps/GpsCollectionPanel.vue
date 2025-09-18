<template>
  <div>
    <ion-item>
      <ion-label>Collection</ion-label>
      <ion-select
        v-model="internalSelectedId"
        interface="popover"
        placeholder="None selected"
      >
        <ion-select-option
          v-for="collection in collections"
          :key="collection.id"
          :value="collection.id"
        >
          {{ collection.name }}
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

    <ion-card v-if="internalSelectedId && collectionIsEmpty" class="ion-margin-top">
      <ion-card-content>
        <div class="info">
          <div class="headline">Empty collection</div>
          <div class="support">Add waypoints to guide navigation for this collection.</div>
        </div>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import {
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonCard,
  IonCardContent,
} from '@ionic/vue';
import { computed } from 'vue';

const props = defineProps<{
  selectedId: number | null;
  collections: Array<{ id: number; name: string }>;
  collectionIsEmpty: boolean;
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

<style scoped>
.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.headline {
  font-weight: 600;
}

.support {
  color: var(--ion-color-medium);
}
</style>
