<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>GPS</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="scope" aria-label="Selection scope">
          <ion-segment-button value="waypoint" aria-label="Waypoint scope">
            <ion-label>Waypoint</ion-label>
          </ion-segment-button>
          <ion-segment-button value="trail" aria-label="Trail scope">
            <ion-label>Trail</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-padding">
        <ion-item v-if="scope === 'waypoint'">
          <ion-label>Waypoint</ion-label>
          <ion-select v-model="selectedWaypointId" interface="popover" aria-label="Select waypoint">
            <ion-select-option v-for="wp in waypointsAll" :key="wp.id" :value="wp.id">{{ wp.name }}</ion-select-option>
          </ion-select>
        </ion-item>

        <template v-else>
          <ion-item>
            <ion-label>Trail</ion-label>
            <ion-select v-model="selectedTrailId" interface="popover" aria-label="Select trail">
              <ion-select-option v-for="t in trails.list" :key="t.id" :value="t.id">{{ t.name }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item v-if="selectedTrailId">
            <ion-label>
              <div>Current: {{ active && next ? currentIndex + 1 : '-' }}</div>
              <div>Next: {{ next?.name ?? '-' }}</div>
            </ion-label>
            <ion-button fill="outline" size="small" @click="toggleFollow" :aria-label="active ? 'Stop following' : 'Start following'">
              {{ active ? 'Stop' : 'Start' }}
            </ion-button>
          </ion-item>
        </template>

        <ion-card>
          <ion-card-content>
            <div class="telemetry">
              <div class="telemetry-item"><div class="label">Heading</div><div class="value">{{ headingDisplay }}</div></div>
              <div class="telemetry-item"><div class="label">Compass</div><div class="value">{{ compassText }}</div></div>
              <div class="telemetry-item"><div class="label">Distance</div><div class="value">{{ distanceDisplay }}</div></div>
            </div>
          </ion-card-content>
        </ion-card>

        <PositionReadout :lat="gps?.lat ?? null" :lon="gps?.lon ?? null" :elev_m="gps?.altitude ?? null" :accuracy="gps?.accuracy ?? null" :units="units" />

        <div class="controls">
          <ion-button @click="recenter" aria-label="Recenter or calibrate">Recenter/Calibrate</ion-button>
          <ion-item lines="none">
            <ion-label>Audio Cues</ion-label>
            <ion-toggle v-model="audioCues" @ionChange="saveAudioCues" aria-label="Toggle audio cues"></ion-toggle>
          </ion-item>
        </div>

        <div class="sr-only" aria-live="polite">{{ announcement }}</div>
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button @click="markWaypoint" aria-label="Mark waypoint">+</ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonSegment, IonSegmentButton, IonLabel, IonItem, IonSelect, IonSelectOption,
  IonCard, IonCardContent, IonButton, IonToggle, IonFab, IonFabButton
} from '@ionic/vue';
import { ref, computed, onMounted, watch } from 'vue';
import { useTrails } from '@/stores/useTrails';
import { useWaypoints } from '@/stores/useWaypoints';
import { useGeolocation } from '@/composables/useGeolocation';
import { useCompass } from '@/composables/useCompass';
import { useFollowTrail } from '@/composables/useFollowTrail';
import { haversineDistanceMeters } from '@/utils/geo';
import { getUnits, getAudioCuesEnabled, setAudioCuesEnabled } from '@/data/storage/prefs/preferences.service';
import { useActions } from '@/composables/useActions';
import PositionReadout from '@/components/PositionReadout.vue';

type Scope = 'waypoint' | 'trail';

const scope = ref<Scope>('waypoint');
const trails = useTrails();
const wps = useWaypoints();
const waypointsAll = computed(() => wps.all);

const selectedWaypointId = ref<number | null>(null);
const selectedTrailId = ref<number | null>(null);

const { current: gps, start: startGps, recenter: recenterGps, ensurePermissions, autoStartOnMounted } = useGeolocation();
const { reading: compass, autoStartOnMounted: autoStartCompass } = useCompass();

const trailWaypoints = computed(() => (selectedTrailId.value ? (wps.byTrail[selectedTrailId.value] ?? []) : []).map(w => ({ id: w.id as number, name: w.name, lat: w.lat, lon: w.lon })));
const { active, currentIndex, next, start: startFollow, stop: stopFollow, announcement } =
  useFollowTrail(trailWaypoints, computed(() => gps.value ? { lat: gps.value.lat, lon: gps.value.lon } : null));

const units = ref<'metric' | 'imperial'>('metric');
const audioCues = ref(false);
const actions = useActions();

const targetCoord = computed(() => {
  if (!gps.value) return null;
  if (scope.value === 'waypoint') {
    const t = waypointsAll.value.find(w => w.id === selectedWaypointId.value);
    return t ? { lat: t.lat, lon: t.lon } : null;
  }
  if (scope.value === 'trail') {
    const t = next.value;
    return t ? { lat: t.lat, lon: t.lon } : null;
  }
  return null;
});

// Use magnetic heading from device orientation (Motion)
const headingDeg = computed(() => compass.value.heading ?? null);
const distanceM = computed(() => (gps.value && targetCoord.value) ? haversineDistanceMeters({ lat: gps.value.lat, lon: gps.value.lon }, targetCoord.value) : null);

const headingDisplay = computed(() => headingDeg.value != null ? `${headingDeg.value.toFixed(0)}°` : '—');
const compassText = computed(() => {
  const h = headingDeg.value;
  if (h == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(h / 22.5) % 16;
  return `${dirs[idx]} ${h.toFixed(0)}°`;
});
const distanceDisplay = computed(() => {
  if (distanceM.value == null) return '—';
  if (units.value === 'imperial') {
    const feet = distanceM.value * 3.28084;
    return feet >= 528 ? `${(feet / 5280).toFixed(2)} mi` : `${feet.toFixed(0)} ft`;
  }
  return distanceM.value >= 1000 ? `${(distanceM.value / 1000).toFixed(2)} km` : `${distanceM.value.toFixed(0)} m`;
});

async function toggleFollow() {
  if (!selectedTrailId.value) return;
  if (active.value) {
    stopFollow();
  } else {
    startFollow(0);
  }
}

async function recenter() {
  await recenterGps();
}

async function saveAudioCues() {
  await setAudioCuesEnabled(audioCues.value);
}

async function markWaypoint() {
  if (!gps.value) return;
  const point = { name: `WP ${new Date().toLocaleTimeString()}`, lat: gps.value.lat, lon: gps.value.lon, elev_m: null };
  if (scope.value === 'trail' && selectedTrailId.value) {
    await wps.addToTrail(selectedTrailId.value, point);
    await wps.loadForTrail(selectedTrailId.value);
  } else {
    await wps.$repos.waypoints.create(point as any);
    await wps.refreshAll();
  }
}

onMounted(async () => {
  await Promise.all([trails.refresh(), wps.refreshAll()]);
  units.value = await getUnits();
  audioCues.value = await getAudioCuesEnabled();
});

autoStartOnMounted({
  recenter: true,
  onDenied: () => {
    actions.show('Location permission denied. Enable it in Settings to use GPS features.', {
      kind: 'error', placement: 'banner-top', durationMs: null, dismissLabel: 'Dismiss'
    });
  }
});

// Start compass listener on mount
autoStartCompass();

watch(selectedTrailId, async (id) => {
  if (id != null) await wps.loadForTrail(id);
});
</script>
<style scoped>
.telemetry {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.telemetry-item .label { color: var(--ion-color-medium); font-size: 0.85rem; }
.telemetry-item .value { font-size: 1.5rem; font-weight: 600; }
.controls { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 12px; margin-top: 8px; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
</style>
