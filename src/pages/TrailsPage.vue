<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Trails</ion-title>
        <ion-buttons slot="end">
          <ion-button color="primary" @click="onAdd">Add</ion-button>
        </ion-buttons>
        <PageHeaderToolbar />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <template v-if="trails.list.length > 0">
          <ion-item-sliding v-for="t in trails.list" :key="t.id">
            <ion-item button :detail="true" @click="toggleOpen(t.id as number)">
              <ion-label>
                <h2>{{ t.name }}</h2>
                <p v-if="t.description">{{ t.description }}</p>
              </ion-label>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option color="tertiary" @click="onRename(t.id as number, t.name)">Rename</ion-item-option>
              <ion-item-option color="danger" @click="onDelete(t.id as number)">Delete</ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </template>
        <ion-item v-else>
          <ion-label color="medium">No trails yet</ion-label>
        </ion-item>
      </ion-list>

      <div v-for="t in trails.list" :key="`open-${t.id}`" v-show="openId === (t.id as number)" class="ion-padding">
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ t.name }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="section-actions">
              <ion-button size="small" fill="outline" @click="onExport(t.id as number)">Export GPX</ion-button>
              <ion-button size="small" fill="solid" color="primary" @click="openAddWaypoint(t.id as number)">Add Waypoint</ion-button>
              <ion-button size="small" fill="solid" color="tertiary" @click="openAttachExisting(t.id as number)">Attach Existing</ion-button>
            </div>

            <h3>Waypoints</h3>
            <ion-list>
              <ion-item v-for="(w, idx) in (wps.byTrail[t.id as number] ?? [])" :key="w.id">
                <ion-label>
                  <div class="row">
                    <span>{{ w.name }}</span>
                    <span class="sub">{{ formatCoords(w.lat, w.lon) }}</span>
                  </div>
                </ion-label>
                <ion-buttons slot="end">
                  <ion-button size="small" fill="clear" color="medium" :disabled="idx === 0"
                    @click="moveUp(t.id as number, w.id as number, idx)">Up</ion-button>
                  <ion-button size="small" fill="clear" color="medium" :disabled="idx >= ((wps.byTrail[t.id as number] ?? []).length - 1)"
                    @click="moveDown(t.id as number, w.id as number, idx)">Down</ion-button>
                  <ion-button size="small" fill="clear" color="danger"
                    @click="detach(t.id as number, w.id as number)">Detach</ion-button>
                </ion-buttons>
              </ion-item>
              <ion-item v-if="(wps.byTrail[t.id as number] ?? []).length === 0">
                <ion-label color="medium">No waypoints</ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>
      </div>

      <!-- Add Trail -->
      <ion-alert :is-open="addOpen" header="New Trail"
        :inputs="[
          { name: 'name', type: 'text', placeholder: 'Name', attributes: { 'aria-label': 'Name' } },
          { name: 'description', type: 'text', placeholder: 'Description (optional)', attributes: { 'aria-label': 'Description' } }
        ]"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Create', role: 'confirm', handler: (data: any) => handleAddTrail(data) }
        ]" @didDismiss="addOpen = false" />

      <!-- Rename Trail -->
      <ion-alert :is-open="renameOpen" header="Rename Trail"
        :inputs="[
          { name: 'name', type: 'text', value: renameDraft, attributes: { 'aria-label': 'Name' } }
        ]"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Save', role: 'confirm', handler: (data: any) => doRenameTrail(data?.name) }
        ]" @didDismiss="renameOpen = false" />

      <!-- Delete Trail -->
      <ion-alert :is-open="deleteOpen" header="Delete Trail?" message="This cannot be undone."
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Delete', role: 'destructive', handler: () => doDeleteTrail() }
        ]" @didDismiss="deleteOpen = false" />

      <!-- Add Waypoint to Trail -->
      <ion-alert :is-open="addWpOpen" header="Add Waypoint"
        :inputs="addWpInputs"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Add', role: 'confirm', handler: (data: any) => handleAddWaypoint(data) }
        ]" @didDismiss="addWpOpen = false" />

      <MultiSelectWizard v-if="wizardConfig" :open="wizardOpen" :config="wizardConfig"
        @update:open="(v: boolean) => wizardOpen = v"
        @done="onWizardDone" />

      <ion-toast :is-open="toastOpen" :message="toastMessage" :duration="1800" @didDismiss="toastOpen = false" />
    </ion-content>
  </ion-page>
  
</template>
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions, IonItemOption,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonAlert, IonToast
} from '@ionic/vue';
import { ref, onMounted } from 'vue';
import PageHeaderToolbar from '@/components/PageHeaderToolbar.vue';
import { useActions } from '@/composables/useActions';
import { useTrails } from '@/stores/useTrails';
import { useWaypoints } from '@/stores/useWaypoints';
import { exportTrailToGpx } from '@/data/storage/gpx/gpx.service';
import MultiSelectWizard from '@/components/MultiSelectWizard.vue';
import type { MultiSelectConfig, MultiSelectItem } from '@/types/multi-select';

const trails = useTrails();
const wps = useWaypoints();
const actions = useActions();

const openId = ref<number | null>(null);
const addOpen = ref(false);
const renameOpen = ref(false);
const deleteOpen = ref(false);
const renameId = ref<number | null>(null);
const renameDraft = ref('');
const deleteId = ref<number | null>(null);

const addWpOpen = ref(false);
const addWpTrailId = ref<number | null>(null);
const addWpInputs = [
  { name: 'name', type: 'text', placeholder: 'Name', attributes: { 'aria-label': 'Name' } },
  { name: 'lat', type: 'number', placeholder: 'Latitude', attributes: { step: 'any', min: '-90', max: '90', 'aria-label': 'Latitude' } },
  { name: 'lon', type: 'number', placeholder: 'Longitude', attributes: { step: 'any', min: '-180', max: '180', 'aria-label': 'Longitude' } },
  { name: 'elev_m', type: 'number', placeholder: 'Elevation (m, optional)', attributes: { step: 'any', 'aria-label': 'Elevation in meters' } }
];

const wizardOpen = ref(false);
const wizardConfig = ref<MultiSelectConfig | null>(null);
const wizardTrailId = ref<number | null>(null);

const toastOpen = ref(false);
const toastMessage = ref('');

function onAdd() { addOpen.value = true; }

function handleAddTrail(data: any): boolean {
  const name = String(data?.name ?? '').trim();
  const description = String(data?.description ?? '').trim();
  if (!name) { showToast('Enter a name'); return false; }
  (async () => {
    const id = await trails.create({ name, description: description || null });
    actions.show('Trail created', { kind: 'success' });
    openId.value = id;
    await wps.loadForTrail(id);
  })();
  return true;
}

function onRename(id: number, currentName: string) {
  renameId.value = id;
  renameDraft.value = currentName;
  renameOpen.value = true;
}

async function doRenameTrail(name: string) {
  if (!renameId.value) return;
  const v = String(name ?? '').trim();
  if (!v) return;
  const id = renameId.value;
  const old = (trails.list.find(t => Number(t.id) === id)?.name) || '';
  await trails.rename(id, v);
  actions.show(`Renamed "${old}" → "${v}"`, {
    kind: 'success',
    canUndo: true,
    onUndo: async () => { await trails.rename(id, old); }
  });
}

function onDelete(id: number) {
  deleteId.value = id;
  deleteOpen.value = true;
}

async function doDeleteTrail() {
  if (!deleteId.value) return;
  const id = deleteId.value;
  await trails.remove(id);
  if (openId.value === id) openId.value = null;
  actions.show('Trail deleted', { kind: 'success' });
}

async function toggleOpen(id: number) {
  if (openId.value === id) { openId.value = null; return; }
  openId.value = id;
  await wps.loadForTrail(id);
}

async function onExport(trailId: number) {
  try {
    const res = await exportTrailToGpx(trailId);
    actions.show(`Exported to ${res.path}`, { kind: 'success' });
  } catch (e: any) {
    actions.show(`Export failed: ${e?.message ?? String(e)}`, { kind: 'error' });
  }
}

function openAddWaypoint(trailId: number) {
  addWpTrailId.value = trailId;
  addWpOpen.value = true;
}

function isValidLat(lat: number): boolean { return Number.isFinite(lat) && lat >= -90 && lat <= 90; }
function isValidLon(lon: number): boolean { return Number.isFinite(lon) && lon >= -180 && lon <= 180; }

function handleAddWaypoint(data: any): boolean {
  if (!addWpTrailId.value) return true;
  const name = String(data?.name ?? '').trim();
  const lat = Number(data?.lat);
  const lon = Number(data?.lon);
  const elev = data?.elev_m != null && data.elev_m !== '' ? Number(data.elev_m) : null;
  if (!name || !isValidLat(lat) || !isValidLon(lon)) {
    actions.show('Enter a valid name, lat (-90..90), and lon (-180..180)', { kind: 'error', placement: 'banner-top' });
    return false;
  }
  (async () => {
    await wps.addToTrail(addWpTrailId.value!, { name, lat, lon, elev_m: elev ?? undefined });
    await wps.loadForTrail(addWpTrailId.value!);
    actions.show('Waypoint added', { kind: 'success' });
  })();
  return true;
}

function makeAttachConfig(trailId: number): MultiSelectConfig {
  return {
    title: 'Attach Waypoints',
    async getItems(): Promise<MultiSelectItem[]> {
      const existing = new Set((wps.byTrail[trailId] ?? []).map(w => Number(w.id)));
      return (wps.all || []).map(w => ({
        id: Number(w.id),
        label: w.name,
        sublabel: w.description ?? undefined,
        disabled: existing.has(Number(w.id))
      }));
    },
    async commit(ids: number[]) {
      for (const id of ids) {
        await wps.attach(trailId, id);
      }
      await wps.loadForTrail(trailId);
    },
    ctaLabel: 'Attach Selected'
  };
}

async function openAttachExisting(trailId: number) {
  wizardTrailId.value = trailId;
  // Ensure we have latest lists
  if (!wps.byTrail[trailId]) await wps.loadForTrail(trailId);
  if (!wps.all.length) await wps.refreshAll();
  wizardConfig.value = makeAttachConfig(trailId);
  wizardOpen.value = true;
}

function onWizardDone(count: number) {
  actions.show(`Attached ${count} waypoint${count === 1 ? '' : 's'}`, { kind: 'success' });
}

function formatCoords(lat: number, lon: number): string {
  const a = Number(lat).toFixed(5);
  const b = Number(lon).toFixed(5);
  return `${a}, ${b}`;
}

async function moveUp(trailId: number, waypointId: number, index: number) {
  if (index <= 0) return;
  // Positions are 1-based
  await wps.setPosition(trailId, waypointId, index);
  await wps.loadForTrail(trailId);
}

async function moveDown(trailId: number, waypointId: number, index: number) {
  const list = wps.byTrail[trailId] ?? [];
  if (index >= list.length - 1) return;
  await wps.setPosition(trailId, waypointId, index + 2);
  await wps.loadForTrail(trailId);
}

async function detach(trailId: number, waypointId: number) {
  await wps.detach(trailId, waypointId);
  await wps.loadForTrail(trailId);
  actions.show('Detached waypoint', { kind: 'success' });
}

function showToast(msg: string) { toastMessage.value = msg; toastOpen.value = true; }

onMounted(async () => {
  await Promise.all([trails.refresh(), wps.refreshAll()]);
});
</script>
<style scoped>
h2 { margin: 0 0 4px; font-weight: 600; }
p { margin: 0; color: var(--ion-color-medium); }
h3 { margin: 12px 0 6px; font-size: 1rem; font-weight: 600; }
.row { display: flex; gap: 8px; align-items: baseline; }
.row .sub { color: var(--ion-color-medium); font-size: 0.9rem; }
.section-actions { display: flex; justify-content: flex-end; margin-bottom: 6px; gap: 6px; }
</style>
