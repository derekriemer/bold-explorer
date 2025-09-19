<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>GPS</ion-title>
        <PageHeaderToolbar />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="scope" aria-label="Selection scope">
          <ion-segment-button value="waypoint">
            <ion-label>Waypoint</ion-label>
          </ion-segment-button>
          <ion-segment-button value="trail">
            <ion-label>Trail</ion-label>
          </ion-segment-button>
          <ion-segment-button value="collection">
            <ion-label>Collection</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-padding">
        <GpsScopePanel
          :scope="scope"
          :waypoint="{ selectedId: selectedWaypointId, options: waypointOptions }"
          :trail="{
            selectedId: selectedTrailId,
            options: trailOptions,
            followState: trailFollowState
          }"
          :collection="{
            selectedId: selectedCollectionId,
            options: collectionOptions,
            isEmpty: collectionWaypoints.length === 0
          }"
          @update:waypoint-id="id => selectedWaypointId = id"
          @update:trail-id="id => selectedTrailId = id"
          @update:collection-id="id => selectedCollectionId = id"
          @record-new-trail="recordNewTrail"
          @toggle-follow="toggleFollow"
        />

        <ion-card>
          <ion-card-content>
            <div class="telemetry">
              <div v-if="!isWeb" class="telemetry-item">
                <div class="label">
                  <ion-button
                    fill="clear"
                    size="small"
                    class="compass-toggle"
                    @click="toggleCompassMode"
                  >
                    {{ compassModeLabel }}
                  </ion-button>
                </div>
                <div class="value">{{ compassHeadingText }}</div>
              </div>
              <div v-if="targetCoord" class="telemetry-item">
                <div class="label">{{ bearingLabel }}</div>
                <div class="value">{{ bearingDisplay }}</div>
              </div>
              <div v-if="targetCoord" class="telemetry-item">
                <div class="label">Distance</div>
                <div class="value">{{ distanceDisplay }}</div>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <PositionReadout
          :lat="gps?.lat ?? null"
          :lon="gps?.lon ?? null"
          :elev_m="gps?.altitude ?? null"
          :accuracy="gps?.accuracy ?? null"
          :units="prefs.units"
        />

        <div class="controls">
          <ion-button @click="recenter">Recenter/Calibrate</ion-button>
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
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonButton,
  IonFab,
  IonFabButton,
} from '@ionic/vue';
import { computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { Geolocation, type PositionOptions } from '@capacitor/geolocation';
import { useTrails } from '@/stores/useTrails';
import { useWaypoints } from '@/stores/useWaypoints';
import { useCollections } from '@/stores/useCollections';
import { useGpsUiStore } from '@/stores/useGpsUi';
import { useLocation } from '@/stores/useLocation';
import { usePrefsStore } from '@/stores/usePrefs';
import { useActions } from '@/composables/useActions';
import { useCompass } from '@/composables/useCompass';
import { useBearingDistance } from '@/composables/useBearingDistance';
import { useTarget } from '@/composables/useTarget';
import { useWaypointActions } from '@/composables/useWaypointActions';
import { useFollowTrail } from '@/composables/useFollowTrail';
import { ensureLocationGranted } from '@/composables/usePermissions';
import PositionReadout from '@/components/PositionReadout.vue';
import PageHeaderToolbar from '@/components/PageHeaderToolbar.vue';
import GpsScopePanel from '@/components/gps/GpsScopePanel.vue';
import { toLatLng } from '@/types';

const trails = useTrails();
const waypointsStore = useWaypoints();
const collections = useCollections();
const gpsUi = useGpsUiStore();
const prefs = usePrefsStore();
const actions = useActions();
const route = useRoute();

const { scope, selectedWaypointId, selectedTrailId, selectedCollectionId } = storeToRefs(gpsUi);

gpsUi.hydrateFromRoute(route);

const waypointsAll = computed(() => waypointsStore.all);
const waypointOptions = computed(() => waypointsAll.value.map((w) => ({ id: Number(w.id), name: w.name })));
const waypointItems = computed(() => waypointsAll.value.map((w) => ({ id: Number(w.id), name: w.name, lat: w.lat, lon: w.lon })));

const trailOptions = computed(() => trails.list.map(t => ({ id: Number(t.id), name: t.name })));
const trailWaypoints = computed(() => {
  const id = selectedTrailId.value;
  if (!id) return [] as { id: number; name: string; lat: number; lon: number }[];
  const cached = waypointsStore.byTrail[id] ?? [];
  return cached.map(w => ({ id: Number(w.id), name: w.name, lat: w.lat, lon: w.lon }));
});

const collectionsList = computed(() => collections.list);
const collectionOptions = computed(() => collectionsList.value.map(c => ({ id: Number(c.id), name: c.name })));
const collectionWaypoints = computed(() => {
  const id = selectedCollectionId.value;
  if (id == null) return [] as { id: number; name: string; lat: number; lon: number }[];
  const contents = collections.contents[id];
  if (!contents) return [];
  return contents.waypoints.map(w => ({ id: Number(w.id), name: w.name, lat: w.lat, lon: w.lon }));
});

const loc = useLocation();
const gps = computed(() => loc.current ? {
  lat: loc.current.lat,
  lon: loc.current.lon,
  accuracy: loc.current.accuracy,
  altitude: loc.current.altitude ?? null,
  heading: loc.current.heading ?? null,
  speed: loc.current.speed ?? null,
  ts: (loc.current as any).timestamp ?? null,
} : null);

const gpsLatLng = computed(() => (gps.value ? toLatLng(gps.value.lat, gps.value.lon) : null));

const { active, currentIndex, next, start: startFollow, stop: stopFollow, announcement } =
  useFollowTrail(trailWaypoints, gpsLatLng);

const { targetCoord, targetName } = useTarget({
  scope,
  providers: {
    waypoint: { items: waypointItems, selectedId: selectedWaypointId },
    trail: { items: trailWaypoints, currentIndex },
    collection: { items: collectionWaypoints },
  },
});

const trailFollowState = computed(() => ({
  active: active.value,
  current: active.value && next.value ? currentIndex.value + 1 : '-',
  nextName: next.value?.name ?? targetName.value,
}));

const { userBearingText, distanceM } = useBearingDistance({
  gps,
  target: targetCoord,
  units: computed(() => prefs.units),
  bearingDisplayMode: computed(() => prefs.bearingDisplayMode),
});

const bearingDisplay = computed(() => userBearingText.value);
const bearingLabel = computed(() => targetName.value ? `Bearing to ${targetName.value}` : 'Bearing');

const distanceDisplay = computed(() => {
  if (distanceM.value == null) return '—';
  if (prefs.units === 'imperial') {
    const feet = distanceM.value * 3.28084;
    return feet >= 528 ? `${(feet / 5280).toFixed(2)} mi` : `${feet.toFixed(0)} ft`;
  }
  return distanceM.value >= 1000 ? `${(distanceM.value / 1000).toFixed(2)} km` : `${distanceM.value.toFixed(0)} m`;
});

const isWeb = Capacitor.getPlatform() === 'web';
const compass = useCompass({ throttleMs: 1000, initialMode: prefs.compassMode, autoStart: false });
const compassModeLabel = compass.modeLabel;
const compassHeadingText = compass.headingText;

async function toggleFollow() {
  if (!selectedTrailId.value) return;
  if (active.value) stopFollow();
  else startFollow(0);
}

async function recenter() {
  const opts: PositionOptions = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 };
  try {
    const pos = await Geolocation.getCurrentPosition(opts);
    loc.current = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
      altitude: pos.coords.altitude ?? null,
      heading: pos.coords.heading ?? null,
      speed: pos.coords.speed ?? null,
      timestamp: (pos as any).timestamp ?? Date.now(),
      provider: 'geolocation',
      raw: pos,
    } as any;
  } catch (e) {
    console.warn('[GpsPage] recenter failed', e);
  }
}

async function recordNewTrail() {
  const ts = new Date();
  const name = `Trail ${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`;
  const id = await trails.create({ name, description: null });
  selectedTrailId.value = id;
  actions.show('New trail ready. Tap + to record waypoints.', { kind: 'success' });
}

async function toggleCompassMode() {
  const nextMode = await compass.toggleMode();
  await prefs.setCompassMode(nextMode);
}

async function markWaypoint() {
  if (!gps.value) {
    actions.show('No GPS fix yet. Tap Recenter and allow location access.', {
      kind: 'warning',
      placement: 'banner-top',
      durationMs: 2500,
    });
    return;
  }
  const point = {
    name: `WP ${new Date().toLocaleTimeString()}`,
    lat: gps.value.lat,
    lon: gps.value.lon,
    elev_m: null,
  };
  try {
    const wpa = useWaypointActions();
    if (scope.value === 'trail' && selectedTrailId.value) {
      await wpa.addToTrail(selectedTrailId.value, point);
    } else {
      await wpa.createStandalone(point);
    }
  } catch (err: any) {
    console.error('Mark waypoint failed', err);
    actions.show(`Failed to save waypoint: ${err?.message ?? String(err)}`, {
      kind: 'error',
      placement: 'banner-top',
      durationMs: null,
    });
  }
}

onMounted(async () => {
  await Promise.all([trails.refresh(), waypointsStore.refreshAll(), collections.refresh()]);
  try {
    const ok = await ensureLocationGranted();
    if (ok) {
      await loc.start();
      await recenter();
    } else {
      actions.show('Location permission denied. Enable it in Settings to use GPS features.', {
        kind: 'error',
        placement: 'banner-top',
        durationMs: null,
        dismissLabel: 'Dismiss',
      });
    }
  } catch (e) {
    console.warn('[GpsPage] start stream failed', e);
  }

  if (!isWeb) {
    try {
      await compass.start();
    } catch (e) {
      console.error('[Heading] init error', e);
    }
  }
});

onBeforeUnmount(() => {
  try { void compass.stop(); } catch { }
  try { loc.detach(); } catch { }
});

watch(() => prefs.compassMode, (mode) => { void compass.setMode(mode); });
watch(selectedTrailId, async (id) => { if (id != null) await waypointsStore.loadForTrail(id); }, { immediate: true });
watch(selectedCollectionId, async (id) => {
  if (id == null) return;
  if (!collections.contents[id]) await collections.loadContents(id);
}, { immediate: true });
watch(() => gps.value, async (pos) => {
  if (!pos || isWeb) return;
  await compass.setLocation({ lat: pos.lat, lon: pos.lon, alt: pos.altitude ?? undefined });
});
</script>

<style scoped>
.telemetry {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.telemetry-item .label {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

.telemetry-item .value {
  font-size: 1.5rem;
  font-weight: 600;
}

.controls {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.compass-toggle {
  --padding-start: 0;
  --padding-end: 0;
  --min-height: auto;
  height: auto;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}
</style>
