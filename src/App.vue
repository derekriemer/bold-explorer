<template>
  <ion-app>
    <ion-router-outlet />
    <ActionHost />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import ActionHost from '@/components/ActionHost.vue';
</script>
