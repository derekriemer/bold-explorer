<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/gps" />
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>
  <ion-content>
      <ion-list inset>
        <ion-item>
          <ion-label>Units</ion-label>
          <ion-segment v-model="units" @ionChange="onUnitsChange">
            <ion-segment-button value="metric">
              <ion-label>Metric</ion-label>
            </ion-segment-button>
            <ion-segment-button value="imperial">
              <ion-label>Imperial</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-item>

        <ion-item lines="full">
          <ion-label>Audio Cues</ion-label>
          <ion-toggle v-model="audioCues" @ionChange="onAudioToggle"/>
        </ion-item>

        <ion-item lines="full">
          <ion-label>Use True North</ion-label>
          <ion-toggle :checked="compassMode === 'true'" @ionChange="onCompassToggle" />
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonToggle, IonSegment, IonSegmentButton,
  IonButtons, IonBackButton
} from '@ionic/vue';
import { computed } from 'vue';
import { compassStream } from '@/data/streams/compass';
import { usePrefsStore } from '@/stores/usePrefs';

const prefs = usePrefsStore();

const units = computed({
  get: () => prefs.units,
  set: (v: 'metric' | 'imperial') => { void prefs.setUnits(v); }
});
const audioCues = computed({
  get: () => prefs.audioCuesEnabled,
  set: (v: boolean) => { void prefs.setAudioCuesEnabled(v); }
});
const compassMode = computed({
  get: () => prefs.compassMode,
  set: (v: 'magnetic' | 'true') => { void prefs.setCompassMode(v); }
});

async function onUnitsChange() {
  // v-model already triggers setter; keep handler for clarity
}

async function onAudioToggle() {
  // v-model setter handles persistence
}

async function onCompassToggle(ev: CustomEvent) {
  const checked = (ev as any).detail?.checked === true;
  compassMode.value = checked ? 'true' : 'magnetic';
  try { await compassStream.setTrueNorth(checked); } catch (e) { console.warn('[Settings] setTrueNorth failed', e); }
}
</script>
