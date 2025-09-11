<template>
  <ion-card>
    <ion-card-header>
      <ion-card-title>Position</ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <div class="grid">
        <div class="item"><div class="label">Latitude</div><div class="value">{{ formatLat(lat) }}</div></div>
        <div class="item"><div class="label">Longitude</div><div class="value">{{ formatLon(lon) }}</div></div>
        <div class="item"><div class="label">Elevation</div><div class="value">{{ elevationDisplay }}</div></div>
        <div class="item" v-if="accuracy != null"><div class="label">Accuracy</div><div class="value">{{ accuracyDisplay }}</div></div>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/vue';

const props = defineProps<{ lat: number | null | undefined; lon: number | null | undefined; elev_m?: number | null | undefined; units?: 'metric' | 'imperial'; accuracy?: number | null | undefined }>();

function formatLat(v?: number | null) { return v == null ? '—' : v.toFixed(6); }
function formatLon(v?: number | null) { return v == null ? '—' : v.toFixed(6); }

// 1 meter ≈ 3.28084 feet
const elevationDisplay = computed(() => {
  if (props.elev_m == null) return '—';
  return props.units === 'imperial' ? `${(props.elev_m * 3.28084).toFixed(0)} ft` : `${props.elev_m.toFixed(0)} m`;
});

// 1 meter ≈ 3.28084 feet
const accuracyDisplay = computed(() => {
  if (props.accuracy == null) return '—';
  return props.units === 'imperial' ? `${(props.accuracy * 3.28084).toFixed(0)} ft` : `${props.accuracy.toFixed(0)} m`;
});
</script>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.label { color: var(--ion-color-medium); font-size: 0.85rem; }
.value { font-size: 1.1rem; font-weight: 600; }
</style>
