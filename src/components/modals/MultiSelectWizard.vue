<template>
  <ion-modal :is-open="open" @didDismiss="onClose">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ config.title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onClose">Cancel</ion-button>
          <ion-button color="primary" :disabled="busy || selectedIds.length === 0" @click="onCommit">
            {{ config.ctaLabel || 'Add Selected' }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="query" placeholder="Search" />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="controls">
        <ion-button size="small" fill="outline" @click="toggleAll(true)" :disabled="busy || filtered.length === 0">Select All</ion-button>
        <ion-button size="small" fill="outline" @click="toggleAll(false)" :disabled="busy || selectedIds.length === 0">Clear</ion-button>
      </div>

      <ion-list inset>
        <ion-item v-if="loading">
          <ion-label>Loading…</ion-label>
        </ion-item>
        <ion-item v-else-if="filtered.length === 0">
          <ion-label color="medium">No items</ion-label>
        </ion-item>
        <ion-item v-for="it in filtered" :key="it.id" :disabled="it.disabled">
          <ion-checkbox slot="start" :checked="isSelected(it.id)" @ionChange="() => toggle(it.id)" :disabled="it.disabled || busy" />
          <ion-label>
            <div class="row">
              <span>{{ it.label }}</span>
              <span v-if="it.sublabel" class="sub">{{ it.sublabel }}</span>
            </div>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonSearchbar, IonContent, IonList, IonItem, IonLabel, IonCheckbox } from '@ionic/vue';
import type { MultiSelectConfig, MultiSelectItem } from '@/types/multi-select';

const props = defineProps<{ open: boolean; config: MultiSelectConfig }>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'done', addedCount: number): void }>();

const items = ref<MultiSelectItem[]>([]);
const loading = ref(false);
const busy = ref(false);
const query = ref('');
const selected = ref<Set<number>>(new Set());

const selectedIds = computed(() => Array.from(selected.value));

async function load() {
  loading.value = true;
  try {
    items.value = await props.config.getItems();
  } finally {
    loading.value = false;
  }
}

watch(() => props.open, (v) => {
  if (v) {
    // Reset state on open
    selected.value = new Set();
    query.value = '';
    load();
  }
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = items.value;
  if (!q) return list;
  return list.filter(i => i.label.toLowerCase().includes(q) || (i.sublabel?.toLowerCase().includes(q) ?? false));
});

function isSelected(id: number) { return selected.value.has(id); }
function toggle(id: number) {
  if (busy.value) return;
  if (selected.value.has(id)) selected.value.delete(id); else selected.value.add(id);
  selected.value = new Set(selected.value);
}
function toggleAll(on: boolean) {
  if (busy.value) return;
  if (on) {
    const enabledIds = filtered.value.filter(i => !i.disabled).map(i => i.id);
    selected.value = new Set(enabledIds);
  } else {
    selected.value.clear();
    selected.value = new Set(selected.value);
  }
}

async function onCommit() {
  if (busy.value || selectedIds.value.length === 0) return;
  busy.value = true;
  try {
    await props.config.commit(selectedIds.value);
    emit('done', selectedIds.value.length);
    emit('update:open', false);
  } finally {
    busy.value = false;
  }
}

function onClose() { emit('update:open', false); }

onMounted(() => { if (props.open) load(); });
</script>
<style scoped>
.controls { display: flex; gap: 8px; padding: 8px 16px; }
.row { display: flex; gap: 8px; align-items: baseline; }
.sub { color: var(--ion-color-medium); font-size: 0.9rem; }
</style>
