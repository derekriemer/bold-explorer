import { ref, computed, onBeforeUnmount, onMounted, type Ref } from 'vue';
import { compassStream } from '@/data/streams/compass';
import type { HeadingReading } from '@/plugins/heading';
import { throttleTime } from 'rxjs/operators';

/**
 * Encapsulate compassStream lifecycle + formatting.
 * - Starts/stops the underlying compass stream.
 * - Applies optional throttling for UI updates.
 * - Exposes heading as degrees and text and allows toggling true vs magnetic north.
 */
export function useCompass (opts?: { throttleMs?: number; initialMode?: 'true' | 'magnetic'; autoStart?: boolean })
{
  const throttleMs = opts?.throttleMs ?? 1000;
  const northType = ref<'true' | 'magnetic'>(opts?.initialMode ?? 'true');

  const mag = ref<number | null>(null);
  const tru = ref<number | null>(null);

  let sub: import('rxjs').Subscription | null = null;

  const headingDeg = computed<number | null>(() => (northType.value === 'true' ? tru.value : mag.value));

  const headingText = computed(() =>
  {
    const h = headingDeg.value;
    if (h == null) return '—';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const idx = Math.round(h / 22.5) % 16;
    return `${ dirs[idx] } ${ h.toFixed(0) }°`;
  });

  async function start (): Promise<void>
  {
    if (!compassStream.isActive()) await compassStream.start({ useTrueNorth: northType.value === 'true' });
    // (re)subscribe
    try { sub?.unsubscribe(); } catch {}
    sub = compassStream.updates
      .pipe(throttleMs > 0 ? throttleTime(throttleMs) : (x: any) => x)
      .subscribe((r: HeadingReading) =>
      {
        mag.value = typeof (r as any)?.magnetic === 'number' ? (r as any).magnetic : null;
        tru.value = typeof (r as any)?.true === 'number' ? (r as any).true : null;
      });
  }

  async function stop (): Promise<void>
  {
    try { sub?.unsubscribe(); } catch {}
    sub = null;
    await compassStream.stop();
  }

  async function toggleTrueNorth (): Promise<void>
  {
    northType.value = northType.value === 'true' ? 'magnetic' : 'true';
    await compassStream.setTrueNorth(northType.value === 'true');
  }

  if (opts?.autoStart)
  {
    onMounted(() => { void start(); });
    onBeforeUnmount(() => { void stop(); });
  } else
  {
    onBeforeUnmount(() => { try { sub?.unsubscribe(); } catch {}; sub = null; });
  }

  return { mag, tru, northType, headingDeg, headingText, start, stop, toggleTrueNorth } as const;
}

