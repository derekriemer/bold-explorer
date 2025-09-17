<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>GPS</ion-title>
        <PageHeaderToolbar />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model=" scope " aria-label="Selection scope">
          <ion-segment-button value="waypoint">
            <ion-label>Waypoint</ion-label>
          </ion-segment-button>
          <ion-segment-button value="trail">
            <ion-label>Trail</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-padding">
        <ion-item v-if="scope === 'waypoint'">
          <ion-label>Waypoint</ion-label>
          <ion-select v-model=" selectedWaypointId " interface="popover" placeholder="None selected">
            <ion-select-option v-for="wp in waypointsAll" :key=" wp.id " :value=" wp.id ">{{ wp.name
            }}</ion-select-option>
          </ion-select>
          <ion-button slot="end" fill="clear" color="medium" v-if="selectedWaypointId != null"
            @click=" clearWaypoint ">Clear</ion-button>
        </ion-item>

        <template v-else>
          <ion-item>
            <ion-label>Trail</ion-label>
            <ion-select v-model=" selectedTrailId " interface="popover">
              <ion-select-option v-for="t in trails.list" :key=" t.id " :value=" t.id ">{{ t.name }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-card v-if="!selectedTrailId" class="ion-margin-top">
            <ion-card-content>
              <div style="display:flex; align-items:center; justify-content: space-between; gap: 12px;">
                <div>
                  <div style="font-weight:600; margin-bottom:4px;">Start a new trail</div>
                  <div style="color: var(--ion-color-medium);">Record waypoints as you move. The + button adds points to
                    this trail.</div>
                </div>
                <ion-button color="primary" @click=" recordNewTrail ">Record New Trail</ion-button>
              </div>
            </ion-card-content>
          </ion-card>
          <ion-item v-if="selectedTrailId">
            <ion-label>
              <div>Current: {{ active && next ? currentIndex + 1 : '-' }}</div>
              <div>Next: {{ next?.name ?? '-' }}</div>
            </ion-label>
            <ion-button fill="outline" size="small" @click=" toggleFollow ">
              {{ active ? 'Stop' : 'Start' }}
            </ion-button>
          </ion-item>
        </template>

        <ion-card>
          <ion-card-content>
            <div class="telemetry">
              <div v-if="!isWeb" class="telemetry-item">
                <div class="label">
                  <ion-button fill="clear" size="small" class="compass-toggle" @click=" toggleCompassMode ">
                    {{ compassLabel }}
                  </ion-button>
                </div>
                <div class="value">{{ compassText }}</div>
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

        <PositionReadout :lat=" gps?.lat ?? null " :lon=" gps?.lon ?? null " :elev_m=" gps?.altitude ?? null "
          :accuracy=" gps?.accuracy ?? null " :units=" prefs.units " />

        <div class="controls">
          <ion-button @click=" recenter ">Recenter/Calibrate</ion-button>
        </div>

        <div class="sr-only" aria-live="polite">{{ announcement }}</div>


      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button @click=" markWaypoint " aria-label="Mark waypoint">+</ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
/**
 * GPS Page script layout
 * 1) Imports
 * 2) Types
 * 3) Stores/services and platform flags
 * 4) UI state (refs)
 * 5) Derived state (computed)
 * 6) Actions/handlers
 * 7) Lifecycle
 * 8) Watches
 * 9) Helpers
 */
import
{
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonSegment, IonSegmentButton, IonLabel, IonItem, IonSelect, IonSelectOption,
  IonCard, IonCardContent, IonButton, IonFab, IonFabButton
} from '@ionic/vue';
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import { useTrails } from '@/stores/useTrails';
import { useWaypoints } from '@/stores/useWaypoints';
import { Geolocation, type PositionOptions } from '@capacitor/geolocation';
import { useLocation } from '@/stores/useLocation';
import { compassStream } from '@/data/streams/compass';
import { useCompass } from '@/composables/useCompass';
import { useTarget } from '@/composables/useTarget';
import { useBearingDistance } from '@/composables/useBearingDistance';
import { useWaypointActions } from '@/composables/useWaypointActions';
import { ensureLocationGranted } from '@/composables/usePermissions';
import { useFollowTrail } from '@/composables/useFollowTrail';
import { haversineDistanceMeters, initialBearingDeg } from '@/utils/geo';
import { usePrefsStore } from '@/stores/usePrefs';
import { useActions } from '@/composables/useActions';
import PositionReadout from '@/components/PositionReadout.vue';
import PageHeaderToolbar from '@/components/PageHeaderToolbar.vue';
import { Heading } from '@/plugins/heading';

/** Page scope selection: operate on a waypoint or a trail. */
type Scope = 'waypoint' | 'trail';
const trails = useTrails();
const wps = useWaypoints();
/** Shortcut to all waypoints managed by the Waypoints store. */
const waypointsAll = computed(() => wps.all);

/** Trail selection when in trail scope. */
const selectedTrailId = ref<number | null>(null);

// Target selection (waypoint vs trail)
const waypointsNamed = computed(() => (wps.all as any[]).map((w) => ({ id: Number(w.id), name: w.name, lat: w.lat, lon: w.lon })));
const trailWaypoints = computed(() => (selectedTrailId.value ? (wps.byTrail[selectedTrailId.value] ?? []) : []).map(w => ({ id: w.id as number, name: w.name, lat: w.lat, lon: w.lon })));
const target = useTarget({ waypoints: waypointsNamed, trailWaypoints });
const scope = target.scope;
const selectedWaypointId = target.selectedWaypointId;
const targetCoord = target.targetCoord;
const targetName = target.targetName;

const loc = useLocation();
/** Latest location sample exposed in a convenient shape for the UI. */
const gps = computed(() => loc.current ? {
  lat: loc.current.lat,
  lon: loc.current.lon,
  accuracy: loc.current.accuracy,
  altitude: loc.current.altitude ?? null,
  heading: loc.current.heading ?? null,
  speed: loc.current.speed ?? null,
  ts: (loc.current as any).timestamp ?? null
} : null);

/** Current trail’s waypoints in a minimal form for Follow‑Trail logic. */
const { active, currentIndex, next, start: startFollow, stop: stopFollow, announcement } =
  //codex: brace function
  useFollowTrail(trailWaypoints, computed(() => gps.value ? { lat: gps.value.lat, lon: gps.value.lon } : null));

const prefs = usePrefsStore();
const actions = useActions();

const isWeb = Capacitor.getPlatform() === 'web';
// Compass via composable (throttled to 1 Hz)
const compass = useCompass({ throttleMs: 1000, initialMode: prefs.compassMode, autoStart: false });

// Derived UI values via composables
const { trueNorthBearingDeg, userBearingText, distanceM, distanceText } = useBearingDistance({
  gps: computed(() => (gps.value ? { lat: gps.value.lat, lon: gps.value.lon } : null)),
  target: computed(() => targetCoord.value),
  headingDeg: computed(() => compass.headingDeg.value),
  units: computed(() => prefs.units)
});
const bearingDisplay = computed(() => userBearingText.value);
const compassHeadingDeg = computed(() => compass.headingDeg.value);
/** Human‑readable target name for bearing label. */
const targetName = computed(() =>
{
  if (scope.value === 'waypoint')
  {
    const t = waypointsAll.value.find(w => w.id === selectedWaypointId.value);
    return t?.name ?? null;
  }
  if (scope.value === 'trail')
  {
    return next.value?.name ?? null;
  }
  return null;
});
const bearingLabel = computed(() => targetName.value ? `Bearing to ${ targetName.value }` : 'Bearing');
/** UI display string for heading. */
const compassText = computed(() =>
{
  const h = compassHeadingDeg.value;
  if (h == null) return '—';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(h / 22.5) % 16;
  return `${ dirs[idx] } ${ h.toFixed(0) }°`;
});
const compassLabel = computed(() => `Compass: ${ prefs.compassMode.toLocaleUpperCase() } North`);
// Distance formatting inline (feet/miles thresholds: 5280 ft = 1 mi)
/** UI display string for distance using selected units. */
const distanceDisplay = computed(() =>
{
  if (distanceM.value == null) return '—';
  if (prefs.units === 'imperial')
  {
    const feet = distanceM.value * 3.28084; // meters → feet
    return feet >= 528 ? `${ (feet / 5280).toFixed(2) } mi` : `${ feet.toFixed(0) } ft`;
  }
  return distanceM.value >= 1000 ? `${ (distanceM.value / 1000).toFixed(2) } km` : `${ distanceM.value.toFixed(0) } m`;
});

/** Start/stop Follow‑Trail for the selected trail. */
async function toggleFollow ()
{
  if (!selectedTrailId.value) return;
  if (active.value)
  {
    stopFollow();
  } else
  {
    startFollow(0);
  }
}

/** One‑shot position to prime UI; does not manage stream lifecycle. */
async function recenter ()
{
  // Snapshot current position to prime UI without waiting for next stream tick
  const opts: PositionOptions = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 };
  try
  {
    const pos = await Geolocation.getCurrentPosition(opts);
    // Seed store for immediate UI without waiting for next stream tick
    loc.current = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
      altitude: pos.coords.altitude ?? null,
      heading: pos.coords.heading ?? null,
      speed: pos.coords.speed ?? null,
      timestamp: (pos as any).timestamp ?? Date.now(),
      provider: 'geolocation',
      raw: pos
    } as any;
  } catch (e)
  {
    console.warn('[GpsPage] recenter failed', e);
  }
}

function clearWaypoint ()
{
  selectedWaypointId.value = null;
}

/** Create and select a new trail for recording waypoints. */
async function recordNewTrail ()
{
  const ts = new Date();
  const name = `Trail ${ ts.toLocaleDateString() } ${ ts.toLocaleTimeString() }`;
  const id = await trails.create({ name, description: null });
  selectedTrailId.value = id;
  actions.show('New trail ready. Tap + to record waypoints.', { kind: 'success' });
}

/** Toggle true vs magnetic north without restarting the compass stream. */
async function toggleCompassMode ()
{
  const next = prefs.compassMode === 'true' ? 'magnetic' : 'true';
  await prefs.setCompassMode(next);
  try { await compassStream.setTrueNorth(next === 'true'); } catch (e) { console.warn('[GpsPage] setTrueNorth failed', e); }
}


/** Record a waypoint at the current GPS fix; attach when in trail scope. */
async function markWaypoint ()
{
  if (!gps.value)
  {
    actions.show('No GPS fix yet. Tap Recenter and allow location access.', {
      kind: 'warning', placement: 'banner-top', durationMs: 2500
    });
    return;
  }
  const point = { name: `WP ${ new Date().toLocaleTimeString() }`, lat: gps.value.lat, lon: gps.value.lon, elev_m: null };
  try
  {
    const wpa = useWaypointActions();
    if (scope.value === 'trail' && selectedTrailId.value) { await wpa.addToTrail(selectedTrailId.value, point); }
    else { await wpa.createStandalone(point); }
  } catch (err: any)
  {
    console.error('Mark waypoint failed', err);
    actions.show(`Failed to save waypoint: ${ err?.message ?? String(err) }`, { kind: 'error', placement: 'banner-top', durationMs: null });
  }
}



// Lifecycle — mount: start streams and seed fast snapshot
onMounted(async () =>
{
  await Promise.all([trails.refresh(), wps.refreshAll()]);
  // Start the unified location store
  try
  {
    const ok = await ensureLocationGranted();
    if (ok) { await loc.start(); await recenter(); }
    else { actions.show('Location permission denied. Enable it in Settings to use GPS features.', { kind: 'error', placement: 'banner-top', durationMs: null, dismissLabel: 'Dismiss' }); }
  } catch (e)
  {
    console.warn('[GpsPage] start stream failed', e);
  }

  // prefs store is hydrated on app startup; values are reactive
  if (!isWeb)
  {
    try
    {
      console.info('[Heading] init: platform', Capacitor.getPlatform());
      console.info('[Heading] has start:', typeof (Heading as any)?.start);
      await compass.start();
    } catch (e)
    {
      console.error('[Heading] init error', e);
    }
  }
});

// Lifecycle — unmount: detach page‑level subscriptions only
onBeforeUnmount(() =>
{
  try { void compass.stop(); } catch {}
  try { loc.detach(); } catch { }
  // Do not stop the global stream here; other tabs may use it concurrently.
});

// compassMode persists via prefs store actions

/** Watch selected trail and load its waypoints when it changes. */
watch(selectedTrailId, async (id) => { if (id != null) await wps.loadForTrail(id); });

// Feed location to native Heading plugin for true north declination
/** Provide latest position to the compass plugin for declination (true north). */
watch(() => gps.value, async (pos) =>
{
  if (!pos || isWeb) return;
  try { await compassStream.setLocation({ lat: pos.lat, lon: pos.lon, alt: pos.altitude ?? undefined }); }
  catch (e) { console.warn('[Heading] setLocation error', e); }
});

// no gpsSub; store handles subscription lifecycle
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
