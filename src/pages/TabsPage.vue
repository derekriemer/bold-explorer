<template>
  <ion-tabs>
    <ion-router-outlet></ion-router-outlet>
    <ion-tab-bar slot="bottom">
      <ion-tab-button tab="gps" href="/tabs/gps">
        <ion-label>GPS</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="waypoints" href="/tabs/waypoints">
        <ion-label>Waypoints</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="trails" href="/tabs/trails">
        <ion-label>Trails</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="collections" href="/tabs/collections">
        <ion-label>Collections</ion-label>
      </ion-tab-button>
    </ion-tab-bar>
  </ion-tabs>
</template>
<script setup lang="ts">
import { IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonLabel } from '@ionic/vue';
</script>
