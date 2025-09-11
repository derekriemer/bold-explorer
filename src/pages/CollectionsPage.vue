<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Collections</ion-title>
        <ion-buttons slot="end">
          <ion-button color="primary" @click="onAdd">Add</ion-button>
        </ion-buttons>
        <PageHeaderToolbar />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <template v-if="collections.list.length > 0">
          <ion-item v-for="c in collections.list" :key="c.id" button :detail="true" @click="toggleOpen(c.id as number)">
            <ion-label>
              <h2>{{ c.name }}</h2>
              <p v-if="c.description">{{ c.description }}</p>
            </ion-label>
          </ion-item>
        </template>
        <ion-item v-else>
          <ion-label color="medium">No collections yet</ion-label>
        </ion-item>
      </ion-list>

      <div v-for="c in collections.list" :key="`open-${c.id}`" v-show="openId === (c.id as number)" class="ion-padding">
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ c.name }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="section-actions">
              <ion-button size="small" fill="outline" @click="onExport(c.id as number)">Export GPX</ion-button>
            </div>
            <h3>Waypoints</h3>
            <ion-list>
              <ion-item v-for="w in (collections.contents[c.id as number]?.waypoints ?? [])" :key="w.id">
                <ion-label>
                  <div class="row">
                    <span>{{ w.name }}</span>
                    <span class="sub">{{ w.lat.toFixed(5) }}, {{ w.lon.toFixed(5) }}</span>
                  </div>
                </ion-label>
                <ion-button size="small" fill="clear" color="danger"
                  @click="removeWp(c.id as number, w.id as number)">
                  Remove
                </ion-button>
              </ion-item>
              <ion-item v-if="(collections.contents[c.id as number]?.waypoints ?? []).length === 0">
                <ion-label color="medium">No waypoints</ion-label>
              </ion-item>
            </ion-list>

            <h3>Trails</h3>
            <ion-list>
              <ion-item v-for="t in (collections.contents[c.id as number]?.trails ?? [])" :key="t.id">
                <ion-label>
                  <div class="row">
                    <span>{{ t.name }}</span>
                    <span class="sub">Trail</span>
                  </div>
                </ion-label>
                <ion-button size="small" fill="clear" color="danger"
                  @click="removeTrail(c.id as number, t.id as number)">
                  Remove
                </ion-button>
              </ion-item>
              <ion-item v-if="(collections.contents[c.id as number]?.trails ?? []).length === 0">
                <ion-label color="medium">No trails</ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>
      </div>

      <ion-alert :is-open="addOpen" header="New Collection"
        :inputs="[
          { name: 'name', type: 'text', placeholder: 'Name', attributes: { 'aria-label': 'Name' } },
          { name: 'description', type: 'text', placeholder: 'Description (optional)', attributes: { 'aria-label': 'Description' } }
        ]"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Create', role: 'confirm', handler: (data: any) => handleAdd(data) }
        ]" @didDismiss="addOpen = false" />

      <ion-toast :is-open="toastOpen" :message="toastMessage" :duration="1800" @didDismiss="toastOpen = false" />
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonList, IonItem, IonLabel, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonAlert, IonToast
} from '@ionic/vue';
import { onMounted, ref } from 'vue';
import PageHeaderToolbar from '@/components/PageHeaderToolbar.vue';
import { useCollections } from '@/stores/useCollections';
import { exportCollectionToGpx } from '@/data/storage/gpx/gpx.service';
import { useActions } from '@/composables/useActions';

const collections = useCollections();
const actions = useActions();

const openId = ref<number | null>(null);
const addOpen = ref(false);
const toastOpen = ref(false);
const toastMessage = ref('');

function onAdd() { addOpen.value = true; }

function handleAdd(data: any): boolean {
  const name = String(data?.name ?? '').trim();
  const description = String(data?.description ?? '').trim();
  if (!name) { showToast('Enter a name'); return false; }
  (async () => {
    const id = await collections.create({ name, description: description || null });
    showToast('Collection created');
    openId.value = id;
    await collections.loadContents(id);
  })();
  return true;
}

async function onExport(id: number) {
  try {
    const res = await exportCollectionToGpx(id);
    actions.show(`Exported to ${res.path}`, { kind: 'success' });
  } catch (e: any) {
    actions.show(`Export failed: ${e?.message ?? String(e)}`, { kind: 'error' });
  }
}

async function toggleOpen(id: number) {
  if (openId.value === id) { openId.value = null; return; }
  openId.value = id;
  if (!collections.contents[id]) await collections.loadContents(id);
}

async function removeWp(collectionId: number, waypointId: number) {
  await collections.removeWaypoint(collectionId, waypointId);
  actions.show('Removed waypoint', { kind: 'success' });
}

async function removeTrail(collectionId: number, trailId: number) {
  await collections.removeTrail(collectionId, trailId);
  actions.show('Removed trail', { kind: 'success' });
}

function showToast(msg: string) { toastMessage.value = msg; toastOpen.value = true; }

onMounted(async () => {
  await collections.refresh();
});
</script>
<style scoped>
h2 { margin: 0 0 4px; font-weight: 600; }
p { margin: 0; color: var(--ion-color-medium); }
h3 { margin: 12px 0 6px; font-size: 1rem; font-weight: 600; }
.row { display: flex; gap: 8px; align-items: baseline; }
.row .sub { color: var(--ion-color-medium); font-size: 0.9rem; }
.section-actions { display: flex; justify-content: flex-end; margin-bottom: 6px; }
</style>
