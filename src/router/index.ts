import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsPage from '@/pages/TabsPage.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/gps' },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      { path: '', redirect: '/tabs/gps' },
      { path: 'gps', component: () => import('@/pages/GpsPage.vue') },
      { path: 'waypoints', component: () => import('@/pages/WaypointsPage.vue') },
      { path: 'trails', component: () => import('@/pages/TrailsPage.vue') },
      { path: 'collections', component: () => import('@/pages/CollectionsPage.vue') }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
