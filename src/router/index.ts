import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsPage from '@/pages/TabsPage.vue';
import { Geolocation } from '@capacitor/geolocation';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/gps' },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      { path: '', redirect: '/tabs/gps' },
      { path: 'gps', component: () => import('@/pages/GpsPage.vue') },
      {
        path: 'waypoints',
        component: () => import('@/pages/WaypointsPage.vue'),
        // Ensure opening from tab bar centers based on current location when no params provided.
        async beforeEnter(to) {
          const hasExplicitCenter =
            !!to.query.center || (to.query.lat != null && to.query.lon != null);
          if (hasExplicitCenter) {
            return true;
          }
          try {
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              return {
                path: to.path,
                query: { ...to.query, lat: String(lat), lon: String(lon) },
                hash: to.hash,
                replace: true,
              } as any;
            }
          } catch (e) {
            // Geolocation may fail; allow navigation and page will auto-fetch if needed
            console.warn('[router] getCurrentPosition failed', e);
          }
          return true;
        },
      },
      { path: 'trails', component: () => import('@/pages/TrailsPage.vue') },
      { path: 'collections', component: () => import('@/pages/CollectionsPage.vue') },
      { path: 'settings', component: () => import('@/pages/SettingsPage.vue') },
      { path: 'debug', component: () => import('@/pages/DebugPage.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
