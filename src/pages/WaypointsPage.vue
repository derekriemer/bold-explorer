<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Waypoints</ion-title>
        <ion-buttons slot="end">
          <ion-button @click=" onImport ">Import</ion-button>
          <ion-button @click=" onExport ">Export</ion-button>
          <ion-button color="primary" @click=" onAdd ">Add</ion-button>
        </ion-buttons>
        <PageHeaderToolbar />
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model=" query " placeholder="Search by name" aria-label="Search waypoints" />
      </ion-toolbar>
      <ion-toolbar>
        <ion-item lines="none">
          <ion-label>Live Location Updates</ion-label>
          <ion-toggle v-model=" liveUpdates " @ionChange=" onToggleLive " />
        </ion-item>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <div v-for="wp in filtered" :key=" wp.id ">
          <ion-item button :detail=" true " @click=" toggleExpand(wp.id)"
            :aria-expanded=" expandedId === wp.id ? 'true' : 'false' ">
            <ion-label>
              <h2>{{ wp.name }}</h2>
              <p>
                <span v-if="wp.distance_m != null">{{ formatDistance(wp.distance_m, units) }}</span>
                <span v-else>—</span>
              </p>
            </ion-label>
          </ion-item>
          <div class="wp-details" v-if="expandedId === wp.id" :id=" `wpd-${ wp.id }` ">
            <div class="row"><span class="k">Latitude:</span> <span class="v">{{ wp.lat.toFixed(5) }}</span></div>
            <div class="row"><span class="k">Longitude:</span> <span class="v">{{ wp.lon.toFixed(5) }}</span></div>
            <div class="row" v-if="wp.elev_m != null"><span class="k">Elevation:</span> <span class="v">{{ wp.elev_m }}
                m</span></div>
            <div class="row" v-if="wp.description"><span class="k">Description:</span> <span class="v">{{ wp.description
            }}</span></div>
            <div class="actions">
              <ion-button size="small" fill="outline" @click=" onAttach(wp.id)">Attach</ion-button>
              <ion-button size="small" fill="outline" @click=" onEdit(wp.id)">Edit</ion-button>
              <ion-button size="small" color="danger" fill="clear" @click=" onDelete(wp.id)">Delete</ion-button>
            </div>
          </div>
        </div>
      </ion-list>

      <ion-toast :is-open=" toastOpen " :message=" toastMessage " :duration=" 1800 " @didDismiss="toastOpen = false" />

      <ion-alert v-if=" waypointAlertView " :is-open=" waypointAlertOpen " :header=" waypointAlertView.header "
        :message=" waypointAlertView.message " :sub-header=" waypointAlertView.subHeader "
        :inputs=" waypointAlertView.inputs " :buttons=" waypointAlertView.buttons "
        :css-class=" waypointAlertView.cssClass " :backdrop-dismiss=" waypointAlertView.backdropDismiss "
        :translucent=" waypointAlertView.translucent " :animated=" waypointAlertView.animated " :id=" waypointAlertView.id "
        @didDismiss=" waypointAlerts.onDidDismiss " />
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import
{
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonSearchbar, IonList, IonItem, IonLabel,
  IonToast, IonAlert, IonToggle,
  onIonViewWillEnter
} from '@ionic/vue';
import PageHeaderToolbar from '@/components/PageHeaderToolbar.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useWaypoints } from '@/stores/useWaypoints';
import { useTrails } from '@/stores/useTrails';
import { useLocation } from '@/stores/useLocation';
import { useWaypointDistances } from '@/composables/useWaypointDistances';
import { formatDistance as fmtDistance } from '@/composables/useDistance';
import { usePrefsStore } from '@/stores/usePrefs';
import type { Selectable } from 'kysely';
import { parseCenterParam } from '@/utils/locationParam';
import { useActions } from '@/composables/useActions';
import type { Waypoint } from '@/db/schema';
import { actionsService } from '@/services/actions.service';
import { toLatLng, tryParseLatLng, type LatLng } from '@/types';
import { locationStream } from '@/data/streams/location';
import { useAlertController } from '@/composables/useAlertController';

const wps = useWaypoints();
const trails = useTrails();
const loc = useLocation();
const route = useRoute();
const actions = useActions();

const query = ref('');
const prefs = usePrefsStore();
const units = computed(() => prefs.units);
const liveUpdates = ref(true);
const expandedId = ref<number | null>(null);

const formatDistance = (d: number, u: 'metric' | 'imperial') => fmtDistance(d, u);

function toggleExpand (id: number)
{
  expandedId.value = expandedId.value === id ? null : id;
}

// Distances composable: derive distance overlay & sort when active
const centerOnRoute = computed<LatLng | null>(() => getCenterFromRoute());
const { distances, byDistance, refresh: refreshDistances } = useWaypointDistances({
  waypoints: computed(() => wps.all as Selectable<Waypoint>[]),
  gps: computed(() => (loc.current ? toLatLng(loc.current.lat, loc.current.lon) : null)),
  throttleMs: 800,
  initialCenter: centerOnRoute.value
});

type WpWithDistance = Selectable<Waypoint> & { distance_m?: number };
const baseList = computed<WpWithDistance[]>(() =>
{
  if (liveUpdates.value || Object.keys(distances.value).length > 0)
  {
    return byDistance.value as WpWithDistance[];
  }
  return (wps.all as Selectable<Waypoint>[]).map(w => ({ ...w }));
});
const filtered = computed<WpWithDistance[]>(() =>
{
  const q = query.value.trim().toLowerCase();
  const list = baseList.value;
  if (!q) return list;
  return list.filter((w) => w.name.toLowerCase().includes(q));
});

async function onToggleLive ()
{
  if (liveUpdates.value)
  {
    const ok = await ensurePermissions();
    if (!ok) { liveUpdates.value = false; return; }
    await loc.start();
    await recenterFast();
    await refreshDistances();
  } else
  {
    loc.detach();
  }
}

const toastOpen = ref(false);
const toastMessage = ref('');
function showTodo (msg = 'Will implement later')
{
  toastMessage.value = msg;
  toastOpen.value = true;
}

const waypointAlerts = useAlertController<'add' | 'edit' | 'delete' | 'attach'>();
const waypointAlertView = waypointAlerts.current;
const waypointAlertOpen = waypointAlerts.isOpen;

interface EditAlertPayload
{
  id: number;
  prevSnapshot: Selectable<Waypoint> | null;
  defaults: {
    name: string;
    lat: number;
    lon: number;
    elev_m: number | null;
  };
}

interface DeleteAlertPayload
{
  id: number;
  snapshot: Selectable<Waypoint> | null;
}

interface AttachAlertPayload
{
  id: number;
}

function buildAddInputs ()
{
  return [
    { name: 'name', type: 'text', placeholder: 'Name', attributes: { 'aria-label': 'Name' } },
    { name: 'lat', type: 'number', placeholder: 'Latitude', attributes: { step: 'any', min: '-90', max: '90', 'aria-label': 'Latitude' } },
    { name: 'lon', type: 'number', placeholder: 'Longitude', attributes: { step: 'any', min: '-180', max: '180', 'aria-label': 'Longitude' } },
    { name: 'elev_m', type: 'number', placeholder: 'Elevation (m, optional)', attributes: { step: 'any', 'aria-label': 'Elevation in meters' } }
  ];
}

function buildEditInputs (payload?: EditAlertPayload)
{
  return [
    { name: 'name', type: 'text', value: payload?.defaults.name ?? '', attributes: { 'aria-label': 'Name' } },
    {
      name: 'lat',
      type: 'number',
      value: payload?.defaults.lat ?? '',
      attributes: { step: 'any', min: '-90', max: '90', 'aria-label': 'Latitude' }
    },
    {
      name: 'lon',
      type: 'number',
      value: payload?.defaults.lon ?? '',
      attributes: { step: 'any', min: '-180', max: '180', 'aria-label': 'Longitude' }
    },
    {
      name: 'elev_m',
      type: 'number',
      value: payload?.defaults.elev_m ?? '',
      placeholder: 'Elevation (m, optional)',
      attributes: { step: 'any', 'aria-label': 'Elevation in meters' }
    }
  ];
}

function onAdd ()
{
  void waypointAlerts.open('add');
}
function isValidLat (lat: number): boolean { return Number.isFinite(lat) && lat >= -90 && lat <= 90; }
function isValidLon (lon: number): boolean { return Number.isFinite(lon) && lon >= -180 && lon <= 180; }
function handleAddConfirm (data: any): boolean
{
  const name = String(data?.name ?? '').trim();
  const lat = Number(data?.lat);
  const lon = Number(data?.lon);
  const elev = data?.elev_m != null && data.elev_m !== '' ? Number(data.elev_m) : null;
  if (!name || !isValidLat(lat) || !isValidLon(lon))
  {
    actions.show('Enter a valid name, lat (-90..90), and lon (-180..180)', { kind: 'error', placement: 'banner-top' });
    return false; // keep alert open
  }
  // Fire async creation and allow alert to close immediately
  (async () =>
  {
    const id = await wps.create({ name, latLng: toLatLng(lat, lon), elev_m: elev });
    await wps.refreshAll();
    if (liveUpdates.value || Object.keys(distances.value).length > 0) { await refreshDistances(); }
    actionsService.show('Waypoint added', {
      kind: 'success',
      canUndo: true,
      onUndo: async () => { await wps.remove(id); await wps.refreshAll(); }
    });
  })();
  return true;
}

// Edit (name, lat, lon, elevation)
function onEdit (id: number)
{
  const wp = (wps.all as Selectable<Waypoint>[]).find(w => w.id === id) ?? null;
  if (!wp) return;
  const payload: EditAlertPayload = {
    id,
    prevSnapshot: { ...wp },
    defaults: {
      name: wp.name,
      lat: wp.lat,
      lon: wp.lon,
      elev_m: wp.elev_m ?? null
    }
  };
  void waypointAlerts.open('edit', payload);
}

function handleEditConfirm (data: any, payload?: EditAlertPayload): boolean
{
  if (!payload) return true;
  const name = String((data?.name ?? payload.defaults.name) ?? '').trim();
  const lat = Number(data?.lat ?? payload.defaults.lat);
  const lon = Number(data?.lon ?? payload.defaults.lon);
  const elev = data?.elev_m != null && data.elev_m !== '' ? Number(data.elev_m) : null;
  if (!name || !isValidLat(lat) || !isValidLon(lon))
  {
    actions.show('Enter a valid name, lat (-90..90), and lon (-180..180)', { kind: 'error', placement: 'banner-top' });
    return false;
  }
  (async () =>
  {
    const id = payload.id;
    const prev = payload.prevSnapshot ? { ...payload.prevSnapshot } : null;
    await wps.update(id, { name, latLng: toLatLng(lat, lon), elev_m: elev });
    await wps.refreshAll();
    if (liveUpdates.value || Object.keys(distances.value).length > 0)
    {
      await refreshDistances();
    }
    actionsService.show('Waypoint updated', {
      kind: 'success',
      canUndo: !!prev,
      onUndo: prev ? async () =>
      {
        await wps.update(id, {
          name: prev.name,
          latLng: toLatLng(prev.lat, prev.lon),
          elev_m: prev.elev_m ?? null
        });
        await wps.refreshAll();
      } : undefined
    });
  })();
  return true;
}

// Delete
function onDelete (id: number)
{
  const snapshot = (wps.all as Selectable<Waypoint>[]).find(w => w.id === id) ?? null;
  const payload: DeleteAlertPayload = {
    id,
    snapshot: snapshot ? { ...snapshot } : null
  };
  void waypointAlerts.open('delete', payload);
}

function handleDeleteConfirm (payload?: DeleteAlertPayload): boolean
{
  if (!payload) return true;
  const snap = payload.snapshot ? { ...payload.snapshot } : null;
  (async () =>
  {
    await wps.remove(payload.id);
    await wps.refreshAll();
    if (liveUpdates.value || Object.keys(distances.value).length > 0)
    {
      await refreshDistances();
    }
    actions.show('Waypoint deleted', {
      kind: 'success',
      canUndo: !!snap,
      onUndo: snap ? async () =>
      {
        await wps.create({
          name: snap.name,
          latLng: toLatLng(snap.lat, snap.lon),
          elev_m: snap.elev_m ?? null
        });
        await wps.refreshAll();
      } : undefined
    });
  })();
  return true;
}

// Attach to trail
const trailInputs = computed(() => trails.list.map(t => ({
  name: 'trailId',
  type: 'radio',
  label: t.name,
  value: String(t.id)
})));

function onAttach (id: number)
{
  const payload: AttachAlertPayload = { id };
  void waypointAlerts.open('attach', payload);
}

function handleAttachConfirm (data: any, payload?: AttachAlertPayload): boolean
{
  if (!payload) return true;
  const trailId = Number(data?.trailId);
  if (!Number.isFinite(trailId))
  {
    return false;
  }
  (async () =>
  {
    await wps.attach(trailId, payload.id);
    showTodo('Attached to trail');
  })();
  return true;
}

waypointAlerts.register('add', () => ({
  header: 'Add Waypoint',
  inputs: buildAddInputs(),
  buttons: [
    { text: 'Cancel', role: 'cancel' },
    {
      text: 'Add',
      role: 'confirm',
      handler: ({ data }) => handleAddConfirm(data)
    }
  ]
}));

waypointAlerts.register('edit', (payload?: EditAlertPayload) => ({
  header: 'Edit Waypoint',
  inputs: buildEditInputs(payload),
  buttons: [
    { text: 'Cancel', role: 'cancel' },
    {
      text: 'Save',
      role: 'confirm',
      handler: ({ data }) => handleEditConfirm(data, payload)
    }
  ]
}));

waypointAlerts.register('delete', (payload?: DeleteAlertPayload) => ({
  header: 'Delete Waypoint?',
  message: 'This cannot be undone.',
  buttons: [
    { text: 'Cancel', role: 'cancel' },
    {
      text: 'Delete',
      role: 'destructive',
      handler: () => handleDeleteConfirm(payload)
    }
  ]
}));

waypointAlerts.register('attach', (payload?: AttachAlertPayload) => ({
  header: 'Attach to Trail',
  inputs: trailInputs.value.map(input => ({ ...input })),
  buttons: [
    { text: 'Cancel', role: 'cancel' },
    {
      text: 'Attach',
      role: 'confirm',
      handler: ({ data }) => handleAttachConfirm(data, payload)
    }
  ]
}));

// Import/Export placeholders
function onImport () { showTodo('Import GPX — will implement later'); }
function onExport () { showTodo('Export — will implement later'); }

onMounted(async () =>
{
  await Promise.all([wps.refreshAll(), trails.refresh()]);
  // If a center is explicitly provided, pre-sort using it once during initial mount.
  const center = getCenterFromRoute();
  if (center)
  {
    const list = await wps.withDistanceFrom(center);
    const map: Record<number, number> = {};
    for (const r of list as any[]) { map[Number((r as any).id)] = Number((r as any).distance_m); }
    distances.value = map;
  }
});

function getCenterFromRoute (): LatLng | null
{
  const fromParam = parseCenterParam(route.query.center as (string | string[] | undefined));
  const fromQuery = route.query.lat != null && route.query.lon != null
    ? { lat: Number(route.query.lat), lon: Number(route.query.lon) }
    : null;
  const candidate = fromParam ?? fromQuery;
  if (!candidate) return null;
  return tryParseLatLng(candidate);
}

onIonViewWillEnter(async () =>
{
  // If no explicit center provided, automatically request location and sort by distance.
  const explicitCenter = getCenterFromRoute();
  if (explicitCenter) return; // Respect explicit location passed from previous page
  const ok = await ensurePermissions();
  if (!ok) return;
  await recenterFast();
  await refreshDistances();
});

// --- Permissions and snapshot helpers ---
async function ensurePermissions (): Promise<boolean>
{
  return await locationStream.ensureProviderPermissions();
}

async function recenterFast ()
{
  try
  {
    const sample = await locationStream.getCurrentSnapshot({ timeoutMs: 5000 });
    if (sample)
    {
      loc.current = sample;
    }
  } catch (e)
  {
    console.warn('[Waypoints] recenter snapshot failed', e);
  }
}
</script>
<style scoped>
h2 {
  margin: 0 0 4px;
  font-weight: 600;
}

p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.wp-details {
  padding: 6px 16px 12px 16px;
  font-size: 0.9rem;
}

.wp-details .row {
  margin: 2px 0;
}

.wp-details .k {
  color: var(--ion-color-medium);
  margin-right: 6px;
}

.wp-details .v {
  color: var(--ion-color-dark, #222);
}

.wp-details .actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
</style>
