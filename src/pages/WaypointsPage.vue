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
          <ion-item button :detail=" true " @click=" toggleExpand(wp.id as number) "
            :aria-expanded=" expandedId === (wp.id as number) ? 'true' : 'false' "
          >
            <ion-label>
              <h2>{{ wp.name }}</h2>
              <p>
                <span v-if="(wp as any).distance_m != null">{{ formatDistance((wp as any).distance_m, units) }}</span>
                <span v-else>—</span>
              </p>
            </ion-label>
          </ion-item>
          <div class="wp-details" v-if=" expandedId === (wp.id as number) " :id=" `wpd-${ wp.id }` ">
            <div class="row"><span class="k">Latitude:</span> <span class="v">{{ wp.lat.toFixed(5) }}</span></div>
            <div class="row"><span class="k">Longitude:</span> <span class="v">{{ wp.lon.toFixed(5) }}</span></div>
            <div class="row" v-if="wp.elev_m != null"><span class="k">Elevation:</span> <span class="v">{{ wp.elev_m }} m</span></div>
            <div class="row" v-if="wp.description"><span class="k">Description:</span> <span class="v">{{ wp.description }}</span></div>
            <div class="actions">
              <ion-button size="small" fill="outline" @click=" onAttach(wp.id as number) ">Attach</ion-button>
              <ion-button size="small" fill="outline" @click=" onRename(wp.id as number, wp.name) ">Rename</ion-button>
              <ion-button size="small" color="danger" fill="clear" @click=" onDelete(wp.id as number) ">Delete</ion-button>
            </div>
          </div>
        </div>
      </ion-list>

      <ion-toast :is-open=" toastOpen " :message=" toastMessage " :duration=" 1800 " @didDismiss="toastOpen = false" />

      <ion-alert :is-open=" renameOpen " header="Rename Waypoint"
        :inputs=" [{ name: 'name', type: 'text', value: renameDraft, attributes: { 'aria-label': 'Name' } }] " :buttons=" [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Save', role: 'confirm', handler: (data: any) => doRename(data?.name) }
        ] " @didDismiss="renameOpen = false" />

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
import type { Selectable } from 'kysely';
import { useRoute } from 'vue-router';
import { useWaypoints } from '@/stores/useWaypoints';
import { useTrails } from '@/stores/useTrails';
import { useGeolocation } from '@/composables/useGeolocation';
import { formatDistance as fmtDistance } from '@/composables/useDistance';
import { usePrefsStore } from '@/stores/usePrefs';
import { parseCenterParam } from '@/utils/locationParam';
import { useActions } from '@/composables/useActions';
import type { Waypoint } from '@/db/schema';
import { actionsService } from '@/services/actions.service';

const wps = useWaypoints();
const trails = useTrails();
const { current: gps, start, stop, recenter, ensurePermissions } = useGeolocation();
const route = useRoute();
const actions = useActions();

const query = ref('');
type WpWithDistance = Selectable<Waypoint> & { distance_m: number };
const prefs = usePrefsStore();
const units = computed(() => prefs.units);
const nearby = ref<WpWithDistance[] | null>(null);
const liveUpdates = ref(false);
const expandedId = ref<number | null>(null);

const formatDistance = (d: number, u: 'metric' | 'imperial') => fmtDistance(d, u);

function toggleExpand(id: number)
{
  expandedId.value = expandedId.value === id ? null : id;
}

const baseList = computed(() => nearby.value ?? wps.all);
const filtered = computed(() =>
{
  const q = query.value.trim().toLowerCase();
  const list = baseList.value;
  if (!q) return list as any;
  return (list as any).filter((w: any) => w.name.toLowerCase().includes(q));
});

async function refreshByDistance ()
{
  if (!gps.value) return;
  nearby.value = await wps.withDistanceFrom({ lat: gps.value.lat, lon: gps.value.lon });
}

async function onToggleLive ()
{
  if (liveUpdates.value)
  {
    const ok = await ensurePermissions();
    if (!ok) { liveUpdates.value = false; return; }
    await start();
    await recenter();
    await refreshByDistance();
  } else
  {
    await stop();
  }
}

watch(gps, async (pos) =>
{
  if (!liveUpdates.value) return;
  if (pos) await refreshByDistance();
});

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
    await wps.create({ name, lat, lon, elev_m: elev });
    await wps.refreshAll();
    await actionsService.show("Weypoint added!", {
      canUndo: true,
    })
  })();
  return true;
}

// Rename
const renameOpen = ref(false);
const renameId = ref<number | null>(null);
const renameDraft = ref('');
const renamePrevName = ref<string>('');
function onRename (id: number, currentName: string)
{
  renameId.value = id;
  renameDraft.value = currentName;
  renamePrevName.value = currentName;
  renameOpen.value = true;
}
async function doRename (name: string)
{
  if (!renameId.value) return;
  const v = String(name ?? '').trim();
  if (!v) return;
  const id = renameId.value;
  const oldName = renamePrevName.value;
  await wps.rename(id, v);
  await wps.refreshAll();
  actions.show(`Renamed "${ oldName }" → "${ v }"`, {
    kind: 'success',
    canUndo: true,
    onUndo: async () =>
    {
      await wps.rename(id, oldName);
      await wps.refreshAll();
    }
  });
}

// Delete
const deleteOpen = ref(false);
const deleteId = ref<number | null>(null);
const deleteSnapshot = ref<Waypoint | null>(null);
function onDelete (id: number)
{
  deleteId.value = id;
  deleteSnapshot.value = (wps.all as any as Waypoint[]).find(w => (w.id as any) === id) ?? null;
  deleteOpen.value = true;
}
async function doDelete ()
{
  if (!deleteId.value) return;
  const snap = deleteSnapshot.value;
  await wps.remove(deleteId.value);
  await wps.refreshAll();
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
    nearby.value = await wps.withDistanceFrom(center);
  }
});

function getCenterFromRoute (): { lat: number; lon: number } | null
{
  const center = parseCenterParam(route.query.center as any) ?? (
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
  await recenter({ enableHighAccuracy: true });
  await refreshByDistance();
});
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
.wp-details .row { margin: 2px 0; }
.wp-details .k { color: var(--ion-color-medium); margin-right: 6px; }
.wp-details .v { color: var(--ion-color-dark, #222); }
.wp-details .actions { margin-top: 8px; display: flex; gap: 8px; }
</style>
