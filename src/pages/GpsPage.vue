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
          <ion-segment-button value="collection">
            <ion-label>Collection</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-padding">
        <GpsScopePanel :scope=" scope " :waypoint=" { selectedId: selectedWaypointId, options: waypointOptions } "
          :trail=" {
            selectedId: selectedTrailId,
            options: trailOptions,
            followState: trailFollowState
          } " :collection=" {
            selectedId: selectedCollectionId,
            options: collectionOptions,
            isEmpty: collectionWaypoints.length === 0
          } " @update:waypoint-id=" id => selectedWaypointId = id " @update:trail-id=" id => selectedTrailId = id "
          @update:collection-id=" id => selectedCollectionId = id " @record-new-trail=" recordNewTrail "
          @toggle-follow=" toggleFollow " />

        <ion-card>
          <ion-card-content>
            <div class="telemetry">
              <div v-if="!isWeb" class="telemetry-item telemetry-item--compass" role="region"
                :aria-labelledby="compassRegionLabelId">
                <div class="label">
                  <span :id="compassRegionLabelId" class="telemetry-label">Compass</span>
                  <ion-button fill="clear" size="small" class="compass-toggle" @click=" toggleCompassMode ">
                    {{ compassModeLabel }}
                  </ion-button>
                  <ion-button fill="clear" size="small" class="alignment-button" @click=" openAlignment ">
                    Align bearing
                  </ion-button>
                  <span v-if="alignmentLastBearingLabel" class="alignment-badge">{{ alignmentLastBearingLabel }}</span>
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

        <PositionReadout :lat=" gps?.lat ?? null " :lon=" gps?.lon ?? null " :elev_m=" gps?.altitude ?? null "
          :accuracy=" gps?.accuracy ?? null " :units=" prefs.units " />

        <div class="controls">
          <ion-button @click=" recenter ">Recenter/Calibrate</ion-button>
        </div>

        <div class="sr-only" aria-live="polite">{{ combinedAnnouncement }}</div>
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button @click=" markWaypoint " aria-label="Mark waypoint">+</ion-fab-button>
      </ion-fab>
    </ion-content>

    <ion-modal :is-open=" alignmentActive " @didDismiss=" closeAlignment ">
      <ion-header>
        <ion-toolbar>
          <ion-title>Align to Bearing</ion-title>
          <ion-buttons slot="end">
            <ion-button @click=" closeAlignment ">Done</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div class="alignment-modal">
          <div class="alignment-hero" aria-live="polite">
            <div class="alignment-target">{{ alignmentBearingText }}</div>
            <div v-if="alignmentStatusText" class="alignment-status">{{ alignmentStatusText }}</div>
          </div>

          <ion-item class="alignment-input">
            <ion-label position="stacked">Target bearing (degrees)</ion-label>
            <ion-input ref="alignmentInputRef" type="number" inputmode="numeric" min="0" max="359"
              :value=" alignmentBearingField " @ionInput=" onAlignmentInput " @ionChange=" commitAlignmentField "
              @ionBlur=" () => commitAlignmentField() " />
          </ion-item>

          <div class="alignment-controls">
            <ion-button fill="outline" size="large" @mousedown.prevent="startAdjust(-1)" @mouseup=" stopAdjust "
              @mouseleave=" stopAdjust " @touchstart.prevent="startAdjust(-1)" @touchend=" stopAdjust "
              @touchcancel=" stopAdjust ">
              −1°
            </ion-button>
            <ion-button fill="outline" size="large" @mousedown.prevent="startAdjust(1)" @mouseup=" stopAdjust "
              @mouseleave=" stopAdjust " @touchstart.prevent="startAdjust(1)" @touchend=" stopAdjust "
              @touchcancel=" stopAdjust ">
              +1°
            </ion-button>
          </div>

          <ion-button expand="block" color="primary" :disabled=" targetBearingDeg == null "
            @click=" setAlignmentToWaypointBearing ">
            Match bearing to waypoint
          </ion-button>
          <ion-button expand="block" fill="clear" :disabled=" !compass.headingDeg " @click=" resetAlignmentToCurrent ">
            Reset to current heading
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import
{
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
  IonModal,
  IonButtons,
  IonItem,
  IonInput,
} from '@ionic/vue';
import { computed, onMounted, onBeforeUnmount, watch, ref, nextTick } from 'vue';
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
import { useBearingAlignment } from '@/composables/useBearingAlignment';
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
const compassRegionLabelId = 'gps-compass-label';

type AlignmentInputElement = HTMLElement & { setFocus?: () => Promise<void> };
type AlignmentInputEvent = CustomEvent<{ value?: string | null }>;

const { scope, selectedWaypointId, selectedTrailId, selectedCollectionId, alignmentActive, alignmentBearingDeg, alignmentLastBearingDeg } =
  storeToRefs(gpsUi);

gpsUi.hydrateFromRoute(route);

const waypointsAll = computed(() => waypointsStore.all);
const waypointOptions = computed(() =>
{
  return waypointsAll.value.map((w) => ({ id: Number(w.id), name: w.name }));
});
const waypointItems = computed(() => waypointsAll.value.map((w) => ({ id: Number(w.id), name: w.name, lat: w.lat, lon: w.lon })));

const trailOptions = computed(() => trails.list.map(t => ({ id: Number(t.id), name: t.name })));
const trailWaypoints = computed(() =>
{
  const id = selectedTrailId.value;
  if (!id) return [] as { id: number; name: string; lat: number; lon: number }[];
  const cached = waypointsStore.byTrail[id] ?? [];
  return cached.map(w => ({ id: Number(w.id), name: w.name, lat: w.lat, lon: w.lon }));
});

const collectionsList = computed(() => collections.list);
const collectionOptions = computed(() => collectionsList.value.map(c => ({ id: Number(c.id), name: c.name })));
const collectionWaypoints = computed(() =>
{
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

const { trueNorthBearingDeg: targetBearingDeg, userBearingText, distanceM } = useBearingDistance({
  gps,
  target: targetCoord,
  units: computed(() => prefs.units),
  bearingDisplayMode: computed(() => prefs.bearingDisplayMode),
});

const bearingDisplay = computed(() => userBearingText.value);
const bearingLabel = computed(() => targetName.value ? `Bearing to ${ targetName.value }` : 'Bearing');

const distanceDisplay = computed(() =>
{
  if (distanceM.value == null) return '—';
  if (prefs.units === 'imperial')
  {
    const feet = distanceM.value * 3.28084;
    return feet >= 528 ? `${ (feet / 5280).toFixed(2) } mi` : `${ feet.toFixed(0) } ft`;
  }
  return distanceM.value >= 1000 ? `${ (distanceM.value / 1000).toFixed(2) } km` : `${ distanceM.value.toFixed(0) } m`;
});

const isWeb = Capacitor.getPlatform() === 'web';
const compass = useCompass({ throttleMs: 1000, initialMode: prefs.compassMode, autoStart: false });
const compassModeLabel = compass.modeLabel;
const compassHeadingText = compass.headingText;
const alignmentAnnouncement = ref('');
const alignmentInputRef = ref<AlignmentInputElement | null>(null);
const alignmentBearingField = ref('');
const adjustTimeout = ref<number | null>(null);
const adjustInterval = ref<number | null>(null);

const { differenceAbs, differenceSign } = useBearingAlignment();

/** Display text for the active or last bearing in the modal header. */
const alignmentBearingText = computed(() =>
{
  const current = alignmentBearingDeg.value ?? alignmentLastBearingDeg.value;
  return current == null ? 'Target —' : `Target ${ formatBearing(current) }`;
});

/** Spoken guidance string describing relative alignment progress. */
const alignmentStatusText = computed(() =>
{
  if (!alignmentActive.value) return '';
  const diff = differenceAbs.value;
  if (diff == null) return 'Waiting for compass…';
  if (diff <= 3) return 'Aligned within 3° of target.';
  const direction = differenceSign.value > 0 ? 'right' : 'left';
  return `${ diff.toFixed(0) }° ${ direction } of target.`;
});

/** Badge string surfaced beside the compass toggle when alignment history exists. */
const alignmentLastBearingLabel = computed(() =>
{
  if (alignmentLastBearingDeg.value == null) return '';
  return `Last ${ formatBearing(alignmentLastBearingDeg.value) }`;
});

/** Merge follow-trail and modal announcements into a single polite live region. */
const combinedAnnouncement = computed(() =>
{
  return [announcement.value, alignmentAnnouncement.value].filter(Boolean).join(' ');
});

/** Format a numeric bearing as a zero-padded degrees string. */
function formatBearing (value: number): string
{
  return `${ Math.round(value).toString().padStart(3, '0') }°`;
}

/** Normalize arbitrary angles to [0, 360) or null. */
function normalizeBearing (value: number | null | undefined): number | null
{
  if (value == null || !Number.isFinite(value)) return null;
  const mod = ((value % 360) + 360) % 360;
  return Number.isFinite(mod) ? mod : null;
}

/** Keep the editable field in sync with the store state. */
function updateFieldFromStore (value: number | null)
{
  alignmentBearingField.value = value == null ? '' : String(Math.round(value));
}

/** Surface a screen-reader announcement for the current bearing delta. */
function announceBearingUpdate (target: number | null)
{
  if (target == null) return;
  const diff = differenceAbs.value;
  if (diff == null)
  {
    alignmentAnnouncement.value = `Bearing set to ${ formatBearing(target) }. Compass signal unavailable.`;
    return;
  }
  if (diff <= 3)
  {
    alignmentAnnouncement.value = `Bearing set to ${ formatBearing(target) }. Aligned within 3 degrees.`;
    return;
  }
  const direction = differenceSign.value > 0 ? 'right' : 'left';
  alignmentAnnouncement.value = `Bearing set to ${ formatBearing(target) }, ${ diff.toFixed(0) } degrees ${ direction } of target.`;
}

/** Open the alignment modal, seeding with the latest compass or stored bearing. */
function openAlignment ()
{
  if (isWeb) return;
  if (alignmentActive.value) return;
  const seed = compass.headingDeg.value ?? alignmentLastBearingDeg.value ?? 0;
  gpsUi.beginAlignment(seed);
  updateFieldFromStore(alignmentBearingDeg.value);
  alignmentAnnouncement.value = `Alignment guidance on. Target ${ formatBearing((alignmentBearingDeg.value ?? seed) ?? 0) }.`;
  void nextTick(() => { alignmentInputRef.value?.setFocus?.(); });
}

/** Close the modal and tear down timers/subscriptions. */
function closeAlignment ()
{
  if (!alignmentActive.value) return;
  stopAdjust();
  gpsUi.endAlignment();
  alignmentAnnouncement.value = 'Alignment guidance off.';
}

/** Apply an incremental delta to the current bearing. */
function adjustBearing (delta: number)
{
  const current = alignmentBearingDeg.value ?? alignmentLastBearingDeg.value ?? 0;
  const next = normalizeBearing(current + delta);
  if (next == null) return;
  gpsUi.setAlignmentBearing(next);
  updateFieldFromStore(next);
  announceBearingUpdate(next);
}

/** Begin a press-to-repeat adjustment, accelerating after a short hold. */
function startAdjust (direction: -1 | 1)
{
  adjustBearing(direction);
  if (adjustTimeout.value != null) window.clearTimeout(adjustTimeout.value);
  adjustTimeout.value = window.setTimeout(() =>
  {
    if (adjustInterval.value != null) window.clearInterval(adjustInterval.value);
    adjustInterval.value = window.setInterval(() =>
    {
      adjustBearing(direction * 5);
    }, 180);
  }, 500);
}

/** Cancel any pending timer/interval for the step adjustments. */
function stopAdjust ()
{
  if (adjustTimeout.value != null)
  {
    window.clearTimeout(adjustTimeout.value);
    adjustTimeout.value = null;
  }
  if (adjustInterval.value != null)
  {
    window.clearInterval(adjustInterval.value);
    adjustInterval.value = null;
  }
}

/** Re-seed alignment using the live compass heading. */
function resetAlignmentToCurrent ()
{
  const heading = compass.headingDeg.value;
  if (heading == null) return;
  gpsUi.setAlignmentBearing(heading);
  updateFieldFromStore(heading);
  announceBearingUpdate(heading);
}

/** Align to the GPS-derived waypoint bearing for straight-line guidance. */
function setAlignmentToWaypointBearing ()
{
  const bearing = targetBearingDeg.value;
  if (bearing == null)
  {
    alignmentAnnouncement.value = 'Waypoint bearing unavailable.';
    return;
  }
  gpsUi.setAlignmentBearing(bearing);
  updateFieldFromStore(bearing);
  announceBearingUpdate(bearing);
}

/** Track raw input changes before validation. */
function onAlignmentInput (event: AlignmentInputEvent)
{
  const raw = event?.detail?.value;
  alignmentBearingField.value = raw == null ? '' : String(raw);
}

/** Commit the numeric field, normalizing angles and announcing results. */
function commitAlignmentField (event?: AlignmentInputEvent)
{
  const raw = event?.detail?.value ?? alignmentBearingField.value;
  const parsed = Number.parseFloat(String(raw));
  if (!Number.isFinite(parsed))
  {
    updateFieldFromStore(alignmentBearingDeg.value ?? alignmentLastBearingDeg.value);
    return;
  }
  const normalized = normalizeBearing(parsed);
  if (normalized == null) return;
  gpsUi.setAlignmentBearing(normalized);
  updateFieldFromStore(normalized);
  announceBearingUpdate(normalized);
}

watch(alignmentActive, (active) =>
{
  if (active)
  {
    updateFieldFromStore(alignmentBearingDeg.value ?? alignmentLastBearingDeg.value);
    void nextTick(() => { alignmentInputRef.value?.setFocus?.(); });
  } else
  {
    alignmentBearingField.value = '';
  }
});

watch(alignmentBearingDeg, (value) =>
{
  if (!alignmentActive.value) return;
  updateFieldFromStore(value);
});

async function toggleFollow ()
{
  if (!selectedTrailId.value) return;
  if (active.value) stopFollow();
  else startFollow(0);
}

async function recenter ()
{
  const opts: PositionOptions = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 };
  try
  {
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
  } catch (e)
  {
    console.warn('[GpsPage] recenter failed', e);
  }
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
  const nextMode = await compass.toggleMode();
  await prefs.setCompassMode(nextMode);
}

async function markWaypoint ()
{
  if (!gps.value)
  {
    actions.show('No GPS fix yet. Tap Recenter and allow location access.', {
      kind: 'warning',
      placement: 'banner-top',
      durationMs: 2500,
    });
    return;
  }
  const point = {
    name: `WP ${ new Date().toLocaleTimeString() }`,
    lat: gps.value.lat,
    lon: gps.value.lon,
    elev_m: null,
  };
  try
  {
    const wpa = useWaypointActions();
    if (scope.value === 'trail' && selectedTrailId.value)
    {
      await wpa.addToTrail(selectedTrailId.value, point);
    } else
    {
      await wpa.createStandalone(point);
    }
  } catch (err: any)
  {
    console.error('Mark waypoint failed', err);
    actions.show(`Failed to save waypoint: ${ err?.message ?? String(err) }`, {
      kind: 'error',
      placement: 'banner-top',
      durationMs: null,
    });
  }
}

onMounted(async () =>
{
  await Promise.all([trails.refresh(), waypointsStore.refreshAll(), collections.refresh()]);
  try
  {
    const ok = await ensureLocationGranted();
    if (ok)
    {
      await loc.start();
      await recenter();
    } else
    {
      actions.show('Location permission denied. Enable it in Settings to use GPS features.', {
        kind: 'error',
        placement: 'banner-top',
        durationMs: null,
        dismissLabel: 'Dismiss',
      });
    }
  } catch (e)
  {
    console.warn('[GpsPage] start stream failed', e);
  }

  if (!isWeb)
  {
    try
    {
      await compass.start();
    } catch (e)
    {
      console.error('[Heading] init error', e);
    }
  }
});

onBeforeUnmount(() =>
{
  stopAdjust();
  try { void compass.stop(); } catch { }
  try { loc.detach(); } catch { }
});

watch(() => prefs.compassMode, (mode) => { void compass.setMode(mode); });
watch(selectedTrailId, async (id) => { if (id != null) await waypointsStore.loadForTrail(id); }, { immediate: true });
watch(selectedCollectionId, async (id) =>
{
  if (id == null) return;
  if (!collections.contents[id]) await collections.loadContents(id);
}, { immediate: true });
watch(() => gps.value, async (pos) =>
{
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

.telemetry-item--compass {
  grid-column: span 2;
  border-radius: 8px;
  padding: 4px 8px;
}

.telemetry-item--compass .label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.telemetry-label {
  font-weight: 600;
}

.alignment-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
  font-size: 0.7rem;
  font-weight: 600;
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

.compass-toggle,
.alignment-button {
  --padding-start: 0;
  --padding-end: 0;
  --min-height: auto;
  height: auto;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.alignment-modal {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.alignment-hero {
  text-align: center;
}

.alignment-target {
  font-size: 2.5rem;
  font-weight: 700;
}

.alignment-status {
  margin-top: 4px;
  color: var(--ion-color-medium);
  font-size: 0.95rem;
}

.alignment-controls {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.alignment-input {
  --inner-padding-end: 0;
}
</style>
