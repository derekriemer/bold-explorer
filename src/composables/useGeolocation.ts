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
    // Helpful callsite for sourcemaps when debugging
    // eslint-disable-next-line no-console
    console.debug('[useGeolocation] recenter() invoked', { options });
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, ...options });
      current.value = toCoords(pos);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[useGeolocation] recenter() failed via Capacitor', e);
      // Fallback to browser geolocation if available (helps during web dev)
      if (typeof navigator !== 'undefined' && navigator.geolocation?.getCurrentPosition) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, options as PositionOptions | undefined)
        );
        current.value = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading ?? null,
          altitude: pos.coords.altitude ?? null
        };
        // eslint-disable-next-line no-console
        console.info('[useGeolocation] recenter() succeeded via browser fallback');
      } else {
        throw e;
      }
    }
  }

  async function start(options?: PositionOptions) {
    if (watching.value) return;
    watching.value = true;
    watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, ...options }, (pos, err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[useGeolocation] watchPosition error', err);
        return;
      }
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
