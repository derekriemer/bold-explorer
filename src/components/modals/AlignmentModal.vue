<template>
  <ion-modal :is-open="isOpen" @didDismiss="onDidDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>Align to Bearing</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="emitClose">Done</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="alignment-modal">
        <div class="alignment-hero">
          <div class="alignment-target">{{ bearingText }}</div>
          <div v-if="statusText" class="alignment-status">{{ statusText }}</div>
        </div>

        <ion-item class="alignment-input">
          <ion-label position="stacked">Target bearing (degrees)</ion-label>
          <ion-input
            ref="inputRef"
            type="number"
            inputmode="numeric"
            min="0"
            max="359"
            :value="bearingField"
            @ionInput="onInput"
            @ionChange="onCommit"
            @ionBlur="onBlur"
          />
        </ion-item>

        <div class="alignment-controls">
          <ion-button
            fill="outline"
            size="large"
            @mousedown.prevent="() => emitStartAdjust(-1)"
            @mouseup="emitStopAdjust"
            @mouseleave="emitStopAdjust"
            @touchstart.prevent="() => emitStartAdjust(-1)"
            @touchend="emitStopAdjust"
            @touchcancel="emitStopAdjust"
          >
            −1°
          </ion-button>
          <ion-button
            fill="outline"
            size="large"
            @mousedown.prevent="() => emitStartAdjust(1)"
            @mouseup="emitStopAdjust"
            @mouseleave="emitStopAdjust"
            @touchstart.prevent="() => emitStartAdjust(1)"
            @touchend="emitStopAdjust"
            @touchcancel="emitStopAdjust"
          >
            +1°
          </ion-button>
        </div>

        <ion-button
          expand="block"
          color="primary"
          :disabled="disableMatchWaypoint"
          @click="emitMatchWaypoint"
        >
          Match bearing to waypoint
        </ion-button>
        <ion-button
          expand="block"
          fill="clear"
          :disabled="disableResetCurrent"
          @click="emitResetCurrent"
        >
          Reset to current heading
        </ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
} from '@ionic/vue';
import { ref, toRefs } from 'vue';

type AlignmentInputElement = HTMLElement & { setFocus?: () => Promise<void> };
type AlignmentInputEvent = CustomEvent<{ value?: string | null }>;

const props = defineProps<{
  isOpen: boolean;
  bearingText: string;
  statusText: string;
  bearingField: string;
  disableMatchWaypoint: boolean;
  disableResetCurrent: boolean;
}>();

const { isOpen, bearingText, statusText, bearingField, disableMatchWaypoint, disableResetCurrent } = toRefs(props);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'didDismiss'): void;
  (e: 'ionInput', event: AlignmentInputEvent): void;
  (e: 'commit', event?: AlignmentInputEvent): void;
  (e: 'startAdjust', direction: -1 | 1): void;
  (e: 'stopAdjust'): void;
  (e: 'matchWaypoint'): void;
  (e: 'resetCurrent'): void;
}>();

const inputRef = ref<AlignmentInputElement | null>(null);

function emitClose () { emit('close'); }
function onDidDismiss () { emit('didDismiss'); }
function onInput (event: AlignmentInputEvent) { emit('ionInput', event); }
function onCommit (event: AlignmentInputEvent) { emit('commit', event); }
function onBlur () { emit('commit'); }
function emitStartAdjust (direction: -1 | 1) { emit('startAdjust', direction); }
function emitStopAdjust () { emit('stopAdjust'); }
function emitMatchWaypoint () { emit('matchWaypoint'); }
function emitResetCurrent () { emit('resetCurrent'); }

function focusInput () { inputRef.value?.setFocus?.(); }

defineExpose({ focusInput });
</script>

<style scoped>
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
