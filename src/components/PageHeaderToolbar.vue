<template>
  <ion-buttons slot="end">
    <ion-button :router-link="'/tabs/debug'" aria-label="Debug">
      <ion-icon slot="icon-only" :icon="bugOutline" />
    </ion-button>
    <ion-button :router-link="'/tabs/settings'" aria-label="Settings">
      <ion-icon slot="icon-only" :icon="settingsOutline" />
    </ion-button>
  </ion-buttons>
</template>
<script setup lang="ts">
import { IonButtons, IonButton, IonIcon } from '@ionic/vue';
import { settingsOutline, bugOutline } from 'ionicons/icons';
</script>
