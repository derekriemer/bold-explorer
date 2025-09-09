<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Trails</ion-title>
        <ion-buttons slot="end">
          <ion-button :router-link="'/tabs/settings'" aria-label="Settings">
            <ion-icon slot="icon-only" :icon="settingsOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p>Trails list placeholder</p>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon } from '@ionic/vue';
import { settingsOutline } from 'ionicons/icons';
</script>
