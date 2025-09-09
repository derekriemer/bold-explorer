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
          <ion-segment v-model="units" @ionChange="onUnitsChange" aria-label="Units">
            <ion-segment-button value="metric" aria-label="Metric units">
              <ion-label>Metric</ion-label>
            </ion-segment-button>
            <ion-segment-button value="imperial" aria-label="Imperial units">
              <ion-label>Imperial</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-item>

        <ion-item lines="full">
          <ion-label>Audio Cues</ion-label>
          <ion-toggle v-model="audioCues" @ionChange="onAudioToggle" aria-label="Toggle audio cues"/>
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
import { ref, onMounted } from 'vue';
import { getUnits, setUnits, getAudioCuesEnabled, setAudioCuesEnabled } from '@/data/storage/prefs/preferences.service';

const units = ref<'metric' | 'imperial'>('metric');
const audioCues = ref(false);

async function onUnitsChange() {
  await setUnits(units.value);
}

async function onAudioToggle() {
  await setAudioCuesEnabled(audioCues.value);
}

onMounted(async () => {
  units.value = await getUnits();
  audioCues.value = await getAudioCuesEnabled();
});
</script>
