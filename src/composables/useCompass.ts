import { ref, onBeforeUnmount, onMounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Heading } from '@/plugins/heading';
import { Motion } from '@capacitor/motion';

export interface CompassReading {
  // Preferred fields to render
  magnetic: number | null; // 0..360, magnetic north referenced
  true?: number | null;    // 0..360, true north if available
  // Raw/fallback
  heading?: number | null; // legacy convenience
  absolute?: boolean;      // Earth-frame available (Motion)
  alpha?: number | null;   // raw device alpha (z-axis), as provided by Motion
  beta?: number | null;    // raw device beta (x-axis)
  gamma?: number | null;   // raw device gamma (y-axis)
}

/**
 * Provides magnetic compass heading via Capacitor Motion orientation events.
 * Uses `alpha` (z-axis rotation) from device orientation as heading degrees.
 */
export function useCompass() {
  const reading = ref<CompassReading>({ magnetic: null, true: null, heading: null, absolute: undefined });
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

  function toCompassHeading(event: any): number | null {
    // Use Capacitor Motion orientation event's alpha only; do not rely on webkit/device APIs
    const alpha = typeof event?.alpha === 'number' ? event.alpha : null;
    if (alpha == null) return null;
    // Normalize to compass convention: 0° = North, 90° = East, clockwise positive.
    // Prefer alpha as-is; many Android devices already report azimuth (0 = North, clockwise).
    // When event.absolute is true, treat alpha as absolute heading relative to Earth.
    const h = alpha;
    return normalizeHeading(h);
  }

  // No longer use window plugin probing; prefer our Capacitor plugin wrapper `Heading`.

  async function start() {
    if (watching.value) return;
    const granted = await requestPermissionIfNeeded();
    if (!granted) return;
    watching.value = true;
    const isWeb = Capacitor.getPlatform() === 'web';
    if (!isWeb) {
      try {
        const sub = await Heading.addListener('heading', (evt) => {
          // evt: { magnetic, true?, accuracy? }
          const mag = typeof evt?.magnetic === 'number' ? normalizeHeading(evt.magnetic) : null;
          const tru = typeof evt?.true === 'number' ? normalizeHeading(evt.true) : null;
          reading.value = { magnetic: mag, true: tru, heading: tru ?? mag, absolute: true, alpha: null, beta: null, gamma: null };
        });
        await Heading.start({ useTrueNorth: true });
        removeListener = () => { sub.remove(); void Heading.stop(); };
        return;
      } catch (e) {
        // Fall through to Motion fallback if plugin not available or fails
      }
    }
    // Fallback: Capacitor Motion orientation
    const listener = await Motion.addListener('orientation', (event: any) => {
      const h = toCompassHeading(event);
      reading.value = {
        magnetic: h,
        true: null,
        heading: h,
        absolute: event?.absolute,
        alpha: typeof event?.alpha === 'number' ? event.alpha : null,
        beta: typeof event?.beta === 'number' ? event.beta : null,
        gamma: typeof event?.gamma === 'number' ? event.gamma : null
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
