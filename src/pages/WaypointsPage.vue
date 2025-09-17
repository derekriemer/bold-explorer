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
              <ion-item button :detail=" true " @click=" toggleExpand(wp.id )"
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
              <ion-button size="small" fill="outline" @click=" onEdit(wp.id, wp.name)">Edit</ion-button>
              <ion-button size="small" color="danger" fill="clear" @click=" onDelete(wp.id)">Delete</ion-button>
            </div>
          </div>
        </div>
      </ion-list>

      <ion-toast :is-open=" toastOpen " :message=" toastMessage " :duration=" 1800 " @didDismiss="toastOpen = false" />

      <ion-alert :is-open=" editOpen " header="Edit Waypoint" :inputs=" [
        { name: 'name', type: 'text', value: editName, attributes: { 'aria-label': 'Name' } },
        { name: 'lat', type: 'number', value: editLat, attributes: { step: 'any', min: '-90', max: '90', 'aria-label': 'Latitude' } },
        { name: 'lon', type: 'number', value: editLon, attributes: { step: 'any', min: '-180', max: '180', 'aria-label': 'Longitude' } },
        { name: 'elev_m', type: 'number', value: editElev, placeholder: 'Elevation (m, optional)', attributes: { step: 'any', 'aria-label': 'Elevation in meters' } }
      ] " :buttons=" [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Save', role: 'confirm', handler: (data: any) => { doEdit(data); } }
        ] " @didDismiss="editOpen = false" />

      <ion-alert :is-open=" deleteOpen " header="Delete Waypoint?" message="This cannot be undone." :buttons=" [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => doDelete() }
      ] " @didDismiss="deleteOpen = false" />

      <ion-alert :is-open=" addOpen " header="Add Waypoint" :inputs=" addInputs " :buttons=" [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Add', role: 'confirm', handler: (data: any) => handleAddConfirm(data) }
      ] " @didDismiss="addOpen = false" />

      <ion-alert :is-open=" attachOpen " header="Attach to Trail" :inputs=" trailInputs " :buttons=" [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Attach', role: 'confirm', handler: (data: any) => doAttach(Number(data?.trailId)) }
      ] " @didDismiss="attachOpen = false" />
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
import { Geolocation, type PositionOptions } from '@capacitor/geolocation';
import { useLocation } from '@/stores/useLocation';
import { useWaypointDistances } from '@/composables/useWaypointDistances';
import { formatDistance as fmtDistance } from '@/composables/useDistance';
import { usePrefsStore } from '@/stores/usePrefs';
import type { Selectable } from 'kysely';
import { parseCenterParam } from '@/utils/locationParam';
import { useActions } from '@/composables/useActions';
import type { Waypoint } from '@/db/schema';
import { actionsService } from '@/services/actions.service';

const wps = useWaypoints();
const trails = useTrails();
const loc = useLocation();
const route = useRoute();
const actions = useActions();

const query = ref('');
const prefs = usePrefsStore();
const units = computed(() => prefs.units);
const liveUpdates = ref(false);
const expandedId = ref<number | null>(null);

const formatDistance = (d: number, u: 'metric' | 'imperial') => fmtDistance(d, u);

function toggleExpand (id: number)
{
  expandedId.value = expandedId.value === id ? null : id;
}

// Distances composable: derive distance overlay & sort when active
const centerOnRoute = computed<{ lat: number; lon: number } | null>(() => getCenterFromRoute());
const { distances, byDistance, refresh: refreshDistances } = useWaypointDistances({
  waypoints: computed(() => wps.all as Selectable<Waypoint>[]),
  gps: computed(() => loc.current ? { lat: loc.current.lat, lon: loc.current.lon } : null),
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

// Add waypoint
const addOpen = ref(false);
const addInputs = [
  { name: 'name', type: 'text', placeholder: 'Name', attributes: { 'aria-label': 'Name' } },
  { name: 'lat', type: 'number', placeholder: 'Latitude', attributes: { step: 'any', min: '-90', max: '90', 'aria-label': 'Latitude' } },
  { name: 'lon', type: 'number', placeholder: 'Longitude', attributes: { step: 'any', min: '-180', max: '180', 'aria-label': 'Longitude' } },
  { name: 'elev_m', type: 'number', placeholder: 'Elevation (m, optional)', attributes: { step: 'any', 'aria-label': 'Elevation in meters' } }
];
function onAdd () { addOpen.value = true; }
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
    const id = await wps.create({ name, lat, lon, elev_m: elev });
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
const editOpen = ref(false);
const editId = ref<number | null>(null);
const editName = ref('');
const editLat = ref<number | null>(null);
const editLon = ref<number | null>(null);
const editElev = ref<number | null>(null);
const prevSnapshot = ref<Selectable<Waypoint> | null>(null);
function onEdit (id: number, currentName: string)
{
  const wp = (wps.all as Selectable<Waypoint>[]).find(w => w.id === id) ?? null;
  if (!wp) return;
  editId.value = id;
  editName.value = currentName;
  editLat.value = wp.lat;
  editLon.value = wp.lon;
  editElev.value = wp.elev_m ?? null;
  prevSnapshot.value = { ...wp };
  editOpen.value = true;
}
async function doEdit (data: any)
{
  if (!editId.value) return;
  const name = String((data?.name ?? editName.value) ?? '').trim();
  const lat = Number(data?.lat ?? editLat.value);
  const lon = Number(data?.lon ?? editLon.value);
  const elev = data?.elev_m != null && data.elev_m !== '' ? Number(data.elev_m) : null;
  if (!name || !isValidLat(lat) || !isValidLon(lon))
  {
    actions.show('Enter a valid name, lat (-90..90), and lon (-180..180)', { kind: 'error', placement: 'banner-top' });
    return;
  }
  const id = editId.value;
  const prev = prevSnapshot.value;
  await wps.update(id, { name, lat, lon, elev_m: elev });
  await wps.refreshAll();
  // If showing nearby distances, recompute to keep overlay in sync
  if (liveUpdates.value || Object.keys(distances.value).length > 0) { await refreshDistances(); }
  actionsService.show('Waypoint updated', {
    kind: 'success',
    canUndo: !!prev,
    onUndo: prev ? async () =>
    {
      await wps.update(id, { name: prev.name, lat: prev.lat, lon: prev.lon, elev_m: prev.elev_m ?? null });
      await wps.refreshAll();
    } : undefined
  });
}

// Delete
const deleteOpen = ref(false);
const deleteId = ref<number | null>(null);
const deleteSnapshot = ref<Selectable<Waypoint> | null>(null);
function onDelete (id: number)
{
  deleteId.value = id;
  deleteSnapshot.value = (wps.all as Selectable<Waypoint>[]).find(w => w.id === id) ?? null;
  deleteOpen.value = true;
}
async function doDelete ()
{
  if (!deleteId.value) return;
  const snap = deleteSnapshot.value;
  await wps.remove(deleteId.value);
  await wps.refreshAll();
  if (liveUpdates.value || Object.keys(distances.value).length > 0) { await refreshDistances(); }
  actions.show('Waypoint deleted', {
    kind: 'success',
    canUndo: !!snap,
    onUndo: snap ? async () =>
    {
      await wps.create({ name: snap.name, lat: snap.lat, lon: snap.lon, elev_m: snap.elev_m ?? null });
      await wps.refreshAll();
    } : undefined
  });
}

// Attach to trail
const attachOpen = ref(false);
const attachId = ref<number | null>(null);
const trailInputs = computed(() => trails.list.map(t => ({
  name: 'trailId', type: 'radio', label: t.name, value: String(t.id)
})));
function onAttach (id: number)
{
  attachId.value = id;
  attachOpen.value = true;
}
async function doAttach (trailId: number)
{
  if (!attachId.value || !Number.isFinite(trailId)) return;
  await wps.attach(trailId, attachId.value);
  showTodo('Attached to trail');
}

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

function getCenterFromRoute (): { lat: number; lon: number } | null
{
  const center = parseCenterParam(route.query.center as (string | string[] | undefined)) ?? (
    route.query.lat != null && route.query.lon != null
      ? { lat: Number(route.query.lat), lon: Number(route.query.lon) }
      : null
  );
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) return center;
  return null;
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
  try
  {
    const status = await Geolocation.checkPermissions();
    const granted = (status as any).location === 'granted' || (status as any).coarseLocation === 'granted' || (status as any).fineLocation === 'granted';
    if (granted) return true;
    const req = await Geolocation.requestPermissions();
    return (req as any).location === 'granted' || (req as any).coarseLocation === 'granted' || (req as any).fineLocation === 'granted';
  } catch { return true; }
}

async function recenterFast ()
{
  try
  {
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };
    const pos = await Geolocation.getCurrentPosition(opts);
    // Seed the store's current value to improve initial responsiveness
    loc.current = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
      altitude: pos.coords.altitude ?? null,
      timestamp: (pos as any).timestamp ?? Date.now(),
      provider: 'geolocation',
      raw: pos
    } as any;
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
