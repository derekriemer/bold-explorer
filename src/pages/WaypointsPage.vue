<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Waypoints</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onImport" aria-label="Import GPX">Import</ion-button>
          <ion-button @click="onExport" aria-label="Export selected">Export</ion-button>
          <ion-button color="primary" @click="onAdd" aria-label="Add waypoint">Add</ion-button>
        </ion-buttons>
        <PageHeaderToolbar />
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="query" placeholder="Search by name" aria-label="Search waypoints" />
      </ion-toolbar>
      <ion-toolbar>
        <ion-item lines="none">
          <ion-label>Live Location Updates</ion-label>
          <ion-toggle v-model="liveUpdates" @ionChange="onToggleLive" aria-label="Toggle live location updates" />
        </ion-item>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item-sliding v-for="wp in filtered" :key="wp.id">
          <ion-item>
            <ion-label>
              <h2>{{ wp.name }}</h2>
              <p>
                {{ wp.lat.toFixed(5) }}, {{ wp.lon.toFixed(5) }}
                <span v-if="wp.elev_m != null"> · {{ wp.elev_m }} m</span>
                <span v-if="'distance_m' in wp"> · {{ formatDistance((wp as any).distance_m, units) }}</span>
              </p>
            </ion-label>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="medium" @click="onAttach(wp.id as number)" aria-label="Attach to trail">Attach</ion-item-option>
            <ion-item-option color="tertiary" @click="onRename(wp.id as number, wp.name)" aria-label="Rename waypoint">Rename</ion-item-option>
            <ion-item-option color="danger" @click="onDelete(wp.id as number)" aria-label="Delete waypoint">Delete</ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <ion-toast :is-open="toastOpen" :message="toastMessage" :duration="1800" @didDismiss="toastOpen = false" />

      <ion-alert
        :is-open="renameOpen"
        header="Rename Waypoint"
        :inputs="[{ name: 'name', type: 'text', value: renameDraft, attributes: { 'aria-label': 'Name' } }]"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Save', role: 'confirm', handler: (data: any) => doRename(data?.name) }
        ]"
        @didDismiss="renameOpen = false"
      />

      <ion-alert
        :is-open="deleteOpen"
        header="Delete Waypoint?"
        message="This cannot be undone."
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Delete', role: 'destructive', handler: () => doDelete() }
        ]"
        @didDismiss="deleteOpen = false"
      />

      <ion-alert
        :is-open="addOpen"
        header="Add Waypoint"
        :inputs="addInputs"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Add', role: 'confirm', handler: (data: any) => doAdd(data) }
        ]"
        @didDismiss="addOpen = false"
      />

      <ion-alert
        :is-open="attachOpen"
        header="Attach to Trail"
        :inputs="trailInputs"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Attach', role: 'confirm', handler: (data: any) => doAttach(Number(data?.trailId)) }
        ]"
        @didDismiss="attachOpen = false"
      />
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonSearchbar, IonList, IonItem, IonLabel,
  IonItemSliding, IonItemOptions, IonItemOption, IonToast, IonAlert, IonToggle
} from '@ionic/vue';
import PageHeaderToolbar from '@/components/PageHeaderToolbar.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useWaypoints } from '@/stores/useWaypoints';
import { useTrails } from '@/stores/useTrails';
import { useGeolocation } from '@/composables/useGeolocation';
import { formatDistance as fmtDistance } from '@/composables/useDistance';
import { getUnits } from '@/data/storage/prefs/preferences.service';

const wps = useWaypoints();
const trails = useTrails();
const { current: gps, start, stop, recenter, ensurePermissions } = useGeolocation();

const query = ref('');
type WpWithDistance = ReturnType<typeof useWaypoints> extends infer T ? T extends { withDistanceFrom: any } ? (Awaited<ReturnType<T['withDistanceFrom']>>[number]) : never : never;
const units = ref<'metric' | 'imperial'>('metric');
const nearby = ref<WpWithDistance[] | null>(null);
const liveUpdates = ref(false);

const formatDistance = (d: number, u: 'metric' | 'imperial') => fmtDistance(d, u);

const baseList = computed(() => nearby.value ?? wps.all);
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = baseList.value;
  if (!q) return list as any;
  return (list as any).filter((w: any) => w.name.toLowerCase().includes(q));
});

async function refreshByDistance() {
  if (!gps.value) return;
  nearby.value = await wps.withDistanceFrom({ lat: gps.value.lat, lon: gps.value.lon });
}

async function onToggleLive() {
  if (liveUpdates.value) {
    const ok = await ensurePermissions();
    if (!ok) { liveUpdates.value = false; return; }
    await start({ enableHighAccuracy: true });
    await recenter({ enableHighAccuracy: true });
    await refreshByDistance();
  } else {
    await stop();
  }
}

watch(gps, async (pos) => {
  if (!liveUpdates.value) return;
  if (pos) await refreshByDistance();
});

const toastOpen = ref(false);
const toastMessage = ref('');
function showTodo(msg = 'Will implement later') {
  toastMessage.value = msg;
  toastOpen.value = true;
}

// Add waypoint
const addOpen = ref(false);
const addInputs = [
  { name: 'name', type: 'text', placeholder: 'Name', attributes: { 'aria-label': 'Name' } },
  { name: 'lat', type: 'number', placeholder: 'Latitude', attributes: { step: 'any', 'aria-label': 'Latitude' } },
  { name: 'lon', type: 'number', placeholder: 'Longitude', attributes: { step: 'any', 'aria-label': 'Longitude' } },
  { name: 'elev_m', type: 'number', placeholder: 'Elevation (m, optional)', attributes: { step: 'any', 'aria-label': 'Elevation in meters' } }
];
function onAdd() { addOpen.value = true; }
async function doAdd(data: any) {
  const name = String(data?.name ?? '').trim();
  const lat = Number(data?.lat);
  const lon = Number(data?.lon);
  const elev = data?.elev_m != null && data.elev_m !== '' ? Number(data.elev_m) : null;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
  await wps.create({ name, lat, lon, elev_m: elev });
  await wps.refreshAll();
}

// Rename
const renameOpen = ref(false);
const renameId = ref<number | null>(null);
const renameDraft = ref('');
function onRename(id: number, currentName: string) {
  renameId.value = id;
  renameDraft.value = currentName;
  renameOpen.value = true;
}
async function doRename(name: string) {
  if (!renameId.value) return;
  const v = String(name ?? '').trim();
  if (!v) return;
  await wps.rename(renameId.value, v);
  await wps.refreshAll();
}

// Delete
const deleteOpen = ref(false);
const deleteId = ref<number | null>(null);
function onDelete(id: number) {
  deleteId.value = id;
  deleteOpen.value = true;
}
async function doDelete() {
  if (!deleteId.value) return;
  await wps.remove(deleteId.value);
  await wps.refreshAll();
}

// Attach to trail
const attachOpen = ref(false);
const attachId = ref<number | null>(null);
const trailInputs = computed(() => trails.list.map(t => ({
  name: 'trailId', type: 'radio', label: t.name, value: String(t.id)
})));
function onAttach(id: number) {
  attachId.value = id;
  attachOpen.value = true;
}
async function doAttach(trailId: number) {
  if (!attachId.value || !Number.isFinite(trailId)) return;
  await wps.attach(trailId, attachId.value);
  showTodo('Attached to trail');
}

// Import/Export placeholders
function onImport() { showTodo('Import GPX — will implement later'); }
function onExport() { showTodo('Export — will implement later'); }

onMounted(async () => {
  await Promise.all([wps.refreshAll(), trails.refresh()]);
  units.value = await getUnits();
});
</script>
<style scoped>
h2 { margin: 0 0 4px; font-weight: 600; }
p { margin: 0; color: var(--ion-color-medium); font-size: 0.9rem; }
</style>
