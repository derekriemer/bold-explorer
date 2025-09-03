import { ref, watch, computed, type Ref } from 'vue';
import { haversineDistanceMeters } from '@/utils/geo';

export interface TrailPoint { id: number; name: string; lat: number; lon: number }

export function useFollowTrail(waypoints: Ref<TrailPoint[]>, position: Ref<{ lat: number; lon: number } | null>, opts?: { thresholdM?: number }) {
  const thresholdM = opts?.thresholdM ?? 15;
  const active = ref(false);
  const currentIndex = ref(0);
  const announcement = ref('');

  const next = computed(() => active.value ? waypoints.value[currentIndex.value] : undefined);

  function start(fromIndex = 0) {
    currentIndex.value = Math.min(fromIndex, Math.max(0, waypoints.value.length - 1));
    active.value = true;
    announcement.value = waypoints.value.length ? `Following trail. Next waypoint: ${waypoints.value[currentIndex.value].name}` : '';
  }

  function stop() {
    active.value = false;
    announcement.value = 'Stopped following trail';
  }

  watch([position, waypoints, active], () => {
    if (!active.value || !position.value || waypoints.value.length === 0) return;
    const target = waypoints.value[currentIndex.value];
    if (!target) return;
    const d = haversineDistanceMeters(position.value, target);
    if (d <= thresholdM) {
      if (currentIndex.value < waypoints.value.length - 1) {
        currentIndex.value += 1;
        const nextWp = waypoints.value[currentIndex.value];
        announcement.value = `Next waypoint updated: ${nextWp.name}`;
      } else {
        announcement.value = 'Trail complete';
        active.value = false;
      }
    }
  });

  return { active, currentIndex, next, start, stop, announcement };
}

