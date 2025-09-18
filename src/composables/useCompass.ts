import { ref, computed, onBeforeUnmount, onMounted } from 'vue';
import type { Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { compassStream } from '@/data/streams/compass';
import type { HeadingReading } from '@/plugins/heading';

type CompassMode = 'true' | 'magnetic';

/**
 * Encapsulate compassStream lifecycle + formatting.
 * - Starts/stops the underlying compass stream.
 * - Applies optional throttling for UI updates.
 * - Exposes heading as degrees/text and manages true vs magnetic north.
 */
export function useCompass (opts?: { throttleMs?: number; initialMode?: CompassMode; autoStart?: boolean })
{
  const throttleMs = opts?.throttleMs ?? 1000;
  const mode = ref<CompassMode>(opts?.initialMode ?? 'true');
  const reading = ref<HeadingReading | null>(null);

  let sub: Subscription | null = null;

  const headingDeg = computed<number | null>(() =>
  {
    const r = reading.value;
    if (!r)
    {
      return null;
    }
    if (mode.value === 'true' && typeof r.true === 'number')
    {
      return normalizeHeading(r.true);
    }
    if (typeof r.magnetic === 'number')
    {
      return normalizeHeading(r.magnetic);
    }
    return null;
  });

  const headingText = computed(() =>
  {
    const h = headingDeg.value;
    if (h == null) return '—';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const idx = Math.round(h / 22.5) % 16;
    return `${ dirs[idx] } ${ h.toFixed(0) }°`;
  });

  const modeLabel = computed(() =>
    `Compass: ${ mode.value === 'true' ? 'TRUE' : 'MAGNETIC' } North`
  );

  const hasTrueNorth = computed(() => typeof reading.value?.true === 'number');

  async function setMode (next: CompassMode): Promise<void>
  {
    if (mode.value === next) return;
    mode.value = next;
    if (compassStream.isActive())
    {
      await compassStream.setTrueNorth(next === 'true');
    }
  }

  async function toggleMode (): Promise<CompassMode>
  {
    const next: CompassMode = mode.value === 'true' ? 'magnetic' : 'true';
    await setMode(next);
    return mode.value;
  }

  async function start (): Promise<void>
  {
    if (!compassStream.isActive())
    {
      await compassStream.start({ useTrueNorth: mode.value === 'true' });
    }
    try { sub?.unsubscribe(); } catch {}
    const source = throttleMs > 0
      ? compassStream.updates.pipe(throttleTime(throttleMs))
      : compassStream.updates;
    sub = source.subscribe((r: HeadingReading) => { reading.value = r; });
  }

  async function stop (): Promise<void>
  {
    try { sub?.unsubscribe(); } catch {}
    sub = null;
    await compassStream.stop();
  }

  async function setLocation (coords: { lat: number; lon: number; alt?: number }): Promise<void>
  {
    try { await compassStream.setLocation(coords); }
    catch (e) { console.warn('[useCompass] setLocation failed', e); }
  }

  if (opts?.autoStart)
  {
    onMounted(() => { void start(); });
    onBeforeUnmount(() => { void stop(); });
  }
  else
  {
    onBeforeUnmount(() => { try { sub?.unsubscribe(); } catch {}; sub = null; });
  }

  return {
    mode,
    headingDeg,
    headingText,
    modeLabel,
    hasTrueNorth,
    start,
    stop,
    setMode,
    toggleMode,
    setLocation
  } as const;
}

function normalizeHeading (deg: number): number
{
  if (!Number.isFinite(deg)) return deg;
  const mod = ((deg % 360) + 360) % 360;
  return mod;
}
