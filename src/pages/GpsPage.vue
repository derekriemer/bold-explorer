<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>GPS</ion-title>
        <PageHeaderToolbar />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model=" scope " aria-label="Selection scope">
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
          <ion-select v-model=" selectedWaypointId " interface="popover" placeholder="None selected" aria-label="Select waypoint">
            <ion-select-option v-for="wp in waypointsAll" :key=" wp.id " :value=" wp.id ">{{ wp.name
              }}</ion-select-option>
          </ion-select>
          <ion-button slot="end" fill="clear" color="medium" v-if="selectedWaypointId != null" @click=" clearWaypoint " aria-label="Clear selected waypoint">Clear</ion-button>
        </ion-item>

        <template v-else>
          <ion-item>
            <ion-label>Trail</ion-label>
            <ion-select v-model=" selectedTrailId " interface="popover" aria-label="Select trail">
              <ion-select-option v-for="t in trails.list" :key=" t.id " :value=" t.id ">{{ t.name }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item v-if="selectedTrailId">
            <ion-label>
              <div>Current: {{ active && next ? currentIndex + 1 : '-' }}</div>
              <div>Next: {{ next?.name ?? '-' }}</div>
            </ion-label>
            <ion-button fill="outline" size="small" @click=" toggleFollow "
              :aria-label=" active ? 'Stop following' : 'Start following' ">
              {{ active ? 'Stop' : 'Start' }}
            </ion-button>
          </ion-item>
        </template>

        <ion-card>
          <ion-card-content>
            <div class="telemetry">
              <div v-if="!isWeb" class="telemetry-item">
                <div class="label">{{ compassLabel }}</div>
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
          :accuracy=" gps?.accuracy ?? null " :units=" units " />

        <div class="controls">
          <ion-button @click=" recenter " aria-label="Recenter or calibrate">Recenter/Calibrate</ion-button>
          <ion-item lines="none">
            <ion-label>Show Debug</ion-label>
            <ion-toggle v-model=" debugOpen " aria-label="Toggle diagnostics panel"></ion-toggle>
          </ion-item>
          <ion-item lines="none" :button="true" :detail="false" @click=" toggleCompassMode ">
            <ion-label>Heading ({{ compassMode === 'true' ? 'True' : 'Magnetic' }})</ion-label>
          </ion-item>
          <ion-button fill="outline" size="small" @click=" runDiagnostics " aria-label="Run diagnostics">Run
            Diagnostics</ion-button>
        </div>

        <div class="sr-only" aria-live="polite">{{ announcement }}</div>

        <ion-card v-if="debugOpen">
          <ion-card-content>
            <div class="debug-grid">
              <div><span class="k">GPS:</span> <span class="v">{{ gps ? `${ gps.lat.toFixed(5) }, ${ gps.lon.toFixed(5)
                }` :
                'none'
                  }}</span></div>
              <div><span class="k">Scope:</span> <span class="v">{{ scope }}</span></div>
              <div><span class="k">TrailId:</span> <span class="v">{{ selectedTrailId ?? '-' }}</span></div>
              <div><span class="k">Waypoints(all):</span> <span class="v">{{ waypointsAll.length }}</span></div>
              <div v-if="selectedTrailId"><span class="k">Waypoints(trail):</span> <span class="v">{{
                (wps.byTrail[selectedTrailId] ?? []).length }}</span></div>
              <div><span class="k">Compass mag:</span> <span class="v">{{ headingMag != null ? `${ (headingMag).toFixed(0) }°` : '—' }}</span></div>
              <div><span class="k">Compass true:</span> <span class="v">{{ headingTrue != null ? `${ (headingTrue).toFixed(0) }°` : '—' }}</span></div>
              <div><span class="k">Declination:</span> <span class="v">{{ declinationText }}</span></div>
              
              <div><span class="k">Repos installed:</span> <span class="v">{{ diag?.repos ?? '—' }}</span></div>
              <div><span class="k">Query OK:</span> <span class="v">{{ diag?.queryOk ?? '—' }}</span></div>
              <div><span class="k">Create OK:</span> <span class="v">{{ diag?.createOk ?? '—' }}</span></div>
              <div><span class="k">Delete OK:</span> <span class="v">{{ diag?.deleteOk ?? '—' }}</span></div>
              <div v-if="diag?.error"><span class="k">Error:</span> <span class="v err">{{ diag?.error }}</span></div>
            </div>
          </ion-card-content>
        </ion-card>
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
  IonCard, IonCardContent, IonButton, IonToggle, IonFab, IonFabButton
} from '@ionic/vue';
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import { useTrails } from '@/stores/useTrails';
import { useWaypoints } from '@/stores/useWaypoints';
import { useGeolocation } from '@/composables/useGeolocation';
import { useFollowTrail } from '@/composables/useFollowTrail';
import { haversineDistanceMeters, initialBearingDeg } from '@/utils/geo';
import { getUnits, getCompassMode, setCompassMode } from '@/data/storage/prefs/preferences.service';
import { useActions } from '@/composables/useActions';
import PositionReadout from '@/components/PositionReadout.vue';
import PageHeaderToolbar from '@/components/PageHeaderToolbar.vue';
import { Heading } from '@/plugins/heading';

type Scope = 'waypoint' | 'trail';

const scope = ref<Scope>('waypoint');
const trails = useTrails();
const wps = useWaypoints();
const waypointsAll = computed(() => wps.all);

const selectedWaypointId = ref<number | null>(null);
const selectedTrailId = ref<number | null>(null);

const { current: gps, start: startGps, recenter: recenterGps, ensurePermissions, autoStartOnMounted } = useGeolocation();

const trailWaypoints = computed(() => (selectedTrailId.value ? (wps.byTrail[selectedTrailId.value] ?? []) : []).map(w => ({ id: w.id as number, name: w.name, lat: w.lat, lon: w.lon })));
const { active, currentIndex, next, start: startFollow, stop: stopFollow, announcement } =
  useFollowTrail(trailWaypoints, computed(() => gps.value ? { lat: gps.value.lat, lon: gps.value.lon } : null));

const units = ref<'metric' | 'imperial'>('metric');
const compassMode = ref<'magnetic' | 'true'>('magnetic');
// Audio cues moved to Settings page
const actions = useActions();
const debugOpen = ref(false);
const diag = ref<{ repos?: boolean; queryOk?: boolean; createOk?: boolean; deleteOk?: boolean; count?: number; error?: string } | null>(null);
const isWeb = Capacitor.getPlatform() === 'web';
// Compass plugin state
const headingMag = ref<number | null>(null);
const headingTrue = ref<number | null>(null);
let removeHeadingListener: (() => void) | null = null;

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
  if (compassMode.value === 'true') return headingTrue.value ?? headingMag.value;
  return headingMag.value ?? headingTrue.value;
});
// Magnetic declination (true - magnetic), normalized to [-180, 180]
const declinationDeg = computed(() => {
  if (headingMag.value == null || headingTrue.value == null) return null;
  let d = headingTrue.value - headingMag.value;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d;
});
const declinationText = computed(() => declinationDeg.value != null ? `${ declinationDeg.value.toFixed(1) }°` : '—');
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
const compassLabel = computed(() => `Compass (${ compassMode.value === 'true' ? 'True' : 'Magnetic' })`);
const distanceDisplay = computed(() =>
{
  if (distanceM.value == null) return '—';
  if (units.value === 'imperial')
  {
    const feet = distanceM.value * 3.28084;
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
  await recenterGps();
}

function clearWaypoint ()
{
  selectedWaypointId.value = null;
}

function toggleCompassMode ()
{
  compassMode.value = compassMode.value === 'true' ? 'magnetic' : 'true';
}

// Audio cues toggle moved to Settings page

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

async function runDiagnostics ()
{
  const out: any = {};
  try
  {
    out.repos = !!wps?.$repos?.waypoints && typeof wps.$repos.waypoints.all === 'function';
    if (!out.repos) throw new Error('Pinia repos not installed');
    const list = await wps.$repos.waypoints.all();
    out.count = list.length;
    out.queryOk = true;
  } catch (e: any)
  {
    out.error = `Query failed: ${ e?.message ?? String(e) }`;
    diag.value = out;
    actions.show(out.error, { kind: 'error', placement: 'banner-top', durationMs: null });
    return;
  }
  // Try create/delete a temp waypoint to test write path
  let tempId: number | null = null;
  try
  {
    tempId = await wps.$repos.waypoints.create({ name: `diag-${ Date.now() }`, lat: 0, lon: 0, elev_m: null } as any);
    out.createOk = Number.isFinite(tempId);
  } catch (e: any)
  {
    out.error = `Create failed: ${ e?.message ?? String(e) }`;
    diag.value = out;
    actions.show(out.error, { kind: 'error', placement: 'banner-top', durationMs: null });
    return;
  }
  try
  {
    if (tempId != null) await wps.$repos.waypoints.remove(tempId);
    out.deleteOk = true;
  } catch (e: any)
  {
    out.error = `Delete failed: ${ e?.message ?? String(e) }`;
  }
  diag.value = out;
  actions.show('Diagnostics completed', { kind: out.error ? 'warning' : 'success' });
}

onMounted(async () =>
{
  await Promise.all([trails.refresh(), wps.refreshAll()]);
  units.value = await getUnits();
  compassMode.value = await getCompassMode();
  if (!isWeb)
  {
    try
    {
      console.info('[Heading] init: platform', Capacitor.getPlatform());
      console.info('[Heading] has start:', typeof (Heading as any)?.start);
      const sub = await Heading.addListener('heading', (evt) =>
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
    } catch (e) {
      console.error('[Heading] init error', e);
    }
  }
});

autoStartOnMounted({
  recenter: true,
  onDenied: () =>
  {
    actions.show('Location permission denied. Enable it in Settings to use GPS features.', {
      kind: 'error', placement: 'banner-top', durationMs: null, dismissLabel: 'Dismiss'
    });
  }
});

onBeforeUnmount(() =>
{
  try { removeHeadingListener?.(); } catch {}
  removeHeadingListener = null;
});
  
watch(compassMode, async (m) => { try { await setCompassMode(m); } catch {} });

watch(selectedTrailId, async (id) =>
{
  if (id != null) await wps.loadForTrail(id);
});

// Feed location to native Heading plugin for true north declination
watch(gps, async (pos) =>
{
  if (!pos) return;
  if (isWeb) return;
  try {
    console.info('[Heading] setLocation ->', pos.lat, pos.lon, pos.altitude ?? undefined);
    await Heading.setLocation?.({ lat: pos.lat, lon: pos.lon, alt: pos.altitude ?? undefined });
  } catch { /* ignore */ }
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

.debug-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
}

.debug-grid .k {
  color: var(--ion-color-medium);
  margin-right: 6px;
}

.debug-grid .v.err {
  color: var(--ion-color-danger);
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
</style>
