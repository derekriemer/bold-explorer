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
                  <div style="color: var(--ion-color-medium);">Record waypoints as you move. The + button adds points to this trail.</div>
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
import { locationStream } from '@/data/streams/location';
import { useFollowTrail } from '@/composables/useFollowTrail';
import { haversineDistanceMeters, initialBearingDeg } from '@/utils/geo';
import { usePrefsStore } from '@/stores/usePrefs';
import { useActions } from '@/composables/useActions';
import PositionReadout from '@/components/PositionReadout.vue';
import PageHeaderToolbar from '@/components/PageHeaderToolbar.vue';
import { Heading } from '@/plugins/heading';
import { Subject, type Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

type Scope = 'waypoint' | 'trail';

const scope = ref<Scope>('waypoint');
const trails = useTrails();
const wps = useWaypoints();
const waypointsAll = computed(() => wps.all);

const selectedWaypointId = ref<number | null>(null);
const selectedTrailId = ref<number | null>(null);

type Fix = { lat: number; lon: number; accuracy?: number; altitude?: number | null; heading?: number | null; speed?: number | null; ts?: number };
const gps = ref<Fix | null>(null);

const trailWaypoints = computed(() => (selectedTrailId.value ? (wps.byTrail[selectedTrailId.value] ?? []) : []).map(w => ({ id: w.id as number, name: w.name, lat: w.lat, lon: w.lon })));
const { active, currentIndex, next, start: startFollow, stop: stopFollow, announcement } =
  useFollowTrail(trailWaypoints, computed(() => gps.value ? { lat: gps.value.lat, lon: gps.value.lon } : null));

const prefs = usePrefsStore();
const actions = useActions();

const isWeb = Capacitor.getPlatform() === 'web';
// Compass plugin state
const headingMag = ref<number | null>(null);
const headingTrue = ref<number | null>(null);
let removeHeadingListener: (() => void) | null = null;
// RxJS stream to throttle compass updates to 1 Hz
const headingEvents$ = new Subject<import('@/plugins/heading').HeadingReading>();
let headingThrottleSub: Subscription | null = null;

const targetCoord = computed(() =>
{
  if (!gps.value) return null;
  if (scope.value === 'waypoint')
  {
    const t = waypointsAll.value.find(w => w.id === selectedWaypointId.value);
    return t ? { lat: t.lat, lon: t.lon } : null;
  }
  if (scope.value === 'trail')
  {
    const t = next.value;
    return t ? { lat: t.lat, lon: t.lon } : null;
  }
  return null;
});

// Bearing to target from GPS position (not compass heading)
const bearingDeg = computed(() =>
  (gps.value && targetCoord.value)
    ? initialBearingDeg({ lat: gps.value.lat, lon: gps.value.lon }, targetCoord.value)
    : null
);
const distanceM = computed(() => (gps.value && targetCoord.value) ? haversineDistanceMeters({ lat: gps.value.lat, lon: gps.value.lon }, targetCoord.value) : null);

const bearingDisplay = computed(() => bearingDeg.value != null ? `${ bearingDeg.value.toFixed(0) }°` : '—');
// Heading used for compass display, from native plugin when available
const compassHeadingDeg = computed(() =>
{
  if (prefs.compassMode === 'true') return headingTrue.value;
  return headingMag.value;
});
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

async function recenter ()
{
  // Snapshot current position to prime UI without waiting for next stream tick
  const opts: PositionOptions = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 };
  try
  {
    const pos = await Geolocation.getCurrentPosition(opts);
    gps.value = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
      altitude: pos.coords.altitude ?? null,
      heading: pos.coords.heading ?? null,
      speed: pos.coords.speed ?? null,
      ts: (pos as any).timestamp ?? Date.now()
    };
  } catch (e)
  {
    console.warn('[GpsPage] recenter failed', e);
  }
}

function clearWaypoint ()
{
  selectedWaypointId.value = null;
}

async function recordNewTrail ()
{
  const ts = new Date();
  const name = `Trail ${ ts.toLocaleDateString() } ${ ts.toLocaleTimeString() }`;
  const id = await trails.create({ name, description: null });
  selectedTrailId.value = id;
  actions.show('New trail ready. Tap + to record waypoints.', { kind: 'success' });
}

async function toggleCompassMode ()
{
  const next = prefs.compassMode === 'true' ? 'magnetic' : 'true';
  await prefs.setCompassMode(next);
}


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
    if (scope.value === 'trail' && selectedTrailId.value)
    {
      await wps.addToTrail(selectedTrailId.value, point);
      await wps.loadForTrail(selectedTrailId.value);
      actions.show('Waypoint added to trail', { kind: 'success' });
    } else
    {
      await wps.create(point);
      actions.show('Waypoint created', { kind: 'success' });
    }
  } catch (err: any)
  {
    console.error('Mark waypoint failed', err);
    actions.show(`Failed to save waypoint: ${ err?.message ?? String(err) }`, { kind: 'error', placement: 'banner-top', durationMs: null });
  }
}



onMounted(async () =>
{
  await Promise.all([trails.refresh(), wps.refreshAll()]);
  // Start the unified location stream
  try
  {
    const ok = await ensurePermissions();
    if (ok)
    {
      await locationStream.start();
      // Subscribe for updates
      gpsSub = locationStream.updates.subscribe((s) =>
      {
        gps.value = { lat: s.lat, lon: s.lon, accuracy: s.accuracy, altitude: s.altitude ?? null, heading: s.heading ?? null, speed: s.speed ?? null, ts: s.timestamp };
      });
      // Seed a fast snapshot for UI
      await recenter();
    } else
    {
      actions.show('Location permission denied. Enable it in Settings to use GPS features.', { kind: 'error', placement: 'banner-top', durationMs: null, dismissLabel: 'Dismiss' });
    }
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
      // Listen to native heading events and push through RxJS subject
      const sub = await Heading.addListener('heading', (evt) => { headingEvents$.next(evt); });

      // Throttle to at most one event per second for UI readout
      headingThrottleSub = headingEvents$
        .pipe(throttleTime(1000))
        .subscribe((evt) =>
        {
          const mag = typeof (evt as any)?.magnetic === 'number' ? (evt as any).magnetic : null;
          const tru = typeof (evt as any)?.true === 'number' ? (evt as any).true : null;
          headingMag.value = mag;
          headingTrue.value = tru;
        });
      console.info('[Heading] addListener attached; calling start');
      await Heading.start({ useTrueNorth: true });
      console.info('[Heading] start called');
      removeHeadingListener = () => { sub.remove(); void Heading.stop(); };
    } catch (e)
    {
      console.error('[Heading] init error', e);
    }
  }
});

onBeforeUnmount(() =>
{
  try { removeHeadingListener?.(); }
  catch (e) { console.warn('[GpsPage] removeHeadingListener failed', e); }
  removeHeadingListener = null;
  try { headingThrottleSub?.unsubscribe(); }
  catch (e) { console.warn('[GpsPage] headingThrottleSub unsubscribe failed', e); }
  headingThrottleSub = null;
  try { gpsSub?.unsubscribe(); } catch {}
  gpsSub = null;
  // Do not stop the global stream here; other tabs may use it concurrently.
});

// compassMode persists via prefs store actions

watch(selectedTrailId, async (id) =>
{
  if (id != null) await wps.loadForTrail(id);
});

// Feed location to native Heading plugin for true north declination
watch(gps, async (pos) =>
{
  if (!pos) return;
  if (isWeb) return;
  try
  {
    console.info('[Heading] setLocation ->', pos.lat, pos.lon, pos.altitude ?? undefined);
    await Heading.setLocation?.({ lat: pos.lat, lon: pos.lon, alt: pos.altitude ?? undefined });
  }
  catch (e) { console.warn('[Heading] setLocation error', e); }
});

// --- Permissions helper and local subscription handle ---
async function ensurePermissions (): Promise<boolean>
{
  try
  {
    const status = await Geolocation.checkPermissions();
    const granted = (status as any).location === 'granted' || (status as any).coarseLocation === 'granted' || (status as any).fineLocation === 'granted';
    if (granted) return true;
    const req = await Geolocation.requestPermissions();
    return (req as any).location === 'granted' || (req as any).coarseLocation === 'granted' || (req as any).fineLocation === 'granted';
  } catch
  {
    return true; // allow in dev web
  }
}

import type { Subscription } from 'rxjs';
let gpsSub: Subscription | null = null;
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
