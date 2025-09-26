<template>
  <!-- Toasts top/bottom/center -->
  <ion-toast
    v-for="a in toastActions"
    :key="a.id"
    :is-open="true"
    :message="a.message"
    :position="toToastPosition(a.placement)"
    :duration="a.durationMs ?? undefined"
    :color="toColor(a.kind)"
    :buttons="toastButtons(a)"
    @didDismiss="onDidDismiss(a.id)"
  />

  <!-- Banners (top/bottom) -->
  <div class="banner-container top" v-if="bannerTop.length">
    <div v-for="a in bannerTop" :key="a.id" class="banner" :class="toColor(a.kind)">
      <span>{{ a.message }}</span>
      <span class="spacer" />
      <ion-button size="small" fill="clear" @click="onUndo(a)" v-if="a.canUndo">{{
        a.undoLabel
      }}</ion-button>
      <ion-button size="small" fill="clear" @click="onDismiss(a)">{{ a.dismissLabel }}</ion-button>
    </div>
  </div>
  <div class="banner-container bottom" v-if="bannerBottom.length">
    <div v-for="a in bannerBottom" :key="a.id" class="banner" :class="toColor(a.kind)">
      <span>{{ a.message }}</span>
      <span class="spacer" />
      <ion-button size="small" fill="clear" @click="onUndo(a)" v-if="a.canUndo">{{
        a.undoLabel
      }}</ion-button>
      <ion-button size="small" fill="clear" @click="onDismiss(a)">{{ a.dismissLabel }}</ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonToast, IonButton } from '@ionic/vue';
import { useActions } from '@/composables/useActions';
import type { ActionItem } from '@/services/actions.service';

const actions = useActions();
const all = computed(() => actions.actions as unknown as ActionItem[]);

const toastActions = computed(() =>
  all.value.filter(
    (a) => a.placement === 'top' || a.placement === 'bottom' || a.placement === 'center'
  )
);
const bannerTop = computed(() => all.value.filter((a) => a.placement === 'banner-top'));
const bannerBottom = computed(() => all.value.filter((a) => a.placement === 'banner-bottom'));

function toToastPosition(p: string) {
  return p === 'center' ? 'middle' : p === 'top' ? 'top' : 'bottom';
}
function toColor(kind: string) {
  switch (kind) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'primary';
  }
}

function toastButtons(a: ActionItem) {
  const buttons: any[] = [];
  if (a.canUndo) {
    buttons.push({ text: a.undoLabel, role: 'destructive', handler: () => onUndo(a) });
  }
  buttons.push({ role: 'cancel', text: a.dismissLabel, handler: () => onDismiss(a) });
  return buttons;
}

function onDidDismiss(id: number) {
  actions.dismiss(id);
}
function onDismiss(a: ActionItem) {
  actions.dismiss(a.id);
}
function onUndo(a: ActionItem) {
  actions.undo(a.id);
}
</script>

<style scoped>
.banner-container {
  position: fixed;
  left: 0;
  right: 0;
  display: grid;
  gap: 8px;
  padding: 8px;
  z-index: 1000;
}
.banner-container.top {
  top: 0;
}
.banner-container.bottom {
  bottom: 0;
}
.banner {
  display: flex;
  align-items: center;
  background: var(--ion-color-step-50);
  color: var(--ion-text-color);
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: var(--ion-shadow-2);
}
.banner.success {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success-contrast);
}
.banner.warning {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning-contrast);
}
.banner.danger {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger-contrast);
}
.spacer {
  flex: 1;
}
</style>
