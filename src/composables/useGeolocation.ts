import { ref, onBeforeUnmount, onMounted } from 'vue';
import { Geolocation, type Position, type PositionOptions } from '@capacitor/geolocation';

export function useGeolocation() {
  const current = ref<{ lat: number; lon: number; accuracy?: number; heading?: number | null; altitude?: number | null } | null>(null);
  const watching = ref(false);
  let watchId: string | null = null;

  const toCoords = (pos: Position) => ({
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    heading: pos.coords.heading,
    altitude: pos.coords.altitude ?? null
  });

  async function recenter(options?: PositionOptions) {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, ...options });
    current.value = toCoords(pos);
  }

  async function start(options?: PositionOptions) {
    if (watching.value) return;
    watching.value = true;
    watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, ...options }, (pos, err) => {
      if (err) return;
      if (pos) current.value = toCoords(pos);
    });
  }

  async function ensurePermissions(): Promise<boolean> {
    try {
      const status = await Geolocation.checkPermissions();
      if ((status as any).location === 'granted' || (status as any).coarseLocation === 'granted') return true;
      const req = await Geolocation.requestPermissions();
      return (req as any).location === 'granted' || (req as any).coarseLocation === 'granted';
    } catch {
      // Web adapter may throw for Permissions API; allow proceeding
      return true;
    }
  }

  function autoStartOnMounted(opts?: { recenter?: boolean; options?: PositionOptions; onGranted?: () => void; onDenied?: () => void }) {
    onMounted(async () => {
      const ok = await ensurePermissions();
      if (ok) {
        await start(opts?.options);
        if (opts?.recenter !== false) await recenter(opts?.options);
        opts?.onGranted?.();
      } else {
        opts?.onDenied?.();
      }
    });
  }

  async function stop() {
    if (watchId != null) await Geolocation.clearWatch({ id: watchId });
    watchId = null;
    watching.value = false;
  }

  onBeforeUnmount(() => {
    void stop();
  });

  return { current, watching, start, stop, recenter, ensurePermissions, autoStartOnMounted };
}
