import { ref, onBeforeUnmount, onMounted } from 'vue';
import { Motion } from '@capacitor/motion';

export interface CompassReading {
  heading: number | null; // degrees 0-360, where 0 ≈ North
  absolute?: boolean;
}

/**
 * Provides magnetic compass heading via Capacitor Motion orientation events.
 * Uses `alpha` (z-axis rotation) from device orientation as heading degrees.
 */
export function useCompass() {
  const reading = ref<CompassReading>({ heading: null, absolute: undefined });
  const watching = ref(false);
  let removeListener: (() => void) | null = null;

  async function requestPermissionIfNeeded(): Promise<boolean> {
    try {
      // iOS requires an explicit permission request; other platforms may just resolve.
      const { granted } = await (Motion as any).requestPermission?.() ?? { granted: true };
      return granted !== false;
    } catch {
      // Web adapter may not implement requestPermission; allow proceed.
      return true;
    }
  }

  function normalizeHeading(alpha: number | null | undefined): number | null {
    if (alpha == null || isNaN(alpha)) return null;
    // Ensure value is 0..360
    const h = ((alpha % 360) + 360) % 360;
    return h;
  }

  async function start() {
    if (watching.value) return;
    const granted = await requestPermissionIfNeeded();
    if (!granted) return;
    watching.value = true;
    const listener = await Motion.addListener('orientation', (event: any) => {
      // event: { alpha, beta, gamma, absolute? }
      reading.value = {
        heading: normalizeHeading(event?.alpha),
        absolute: event?.absolute
      };
    });
    removeListener = () => listener.remove();
  }

  async function stop() {
    if (removeListener) await removeListener();
    removeListener = null;
    watching.value = false;
  }

  function autoStartOnMounted() {
    onMounted(() => { void start(); });
  }

  onBeforeUnmount(() => { void stop(); });

  return { reading, watching, start, stop, autoStartOnMounted };
}

