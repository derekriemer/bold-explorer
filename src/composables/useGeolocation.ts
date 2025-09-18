import { ref, onBeforeUnmount, onMounted } from 'vue';
import { Geolocation, type Position, type PositionOptions } from '@capacitor/geolocation';

type ExtendedPositionOptions = PositionOptions & { minimumUpdateInterval?: number };

type Fix = {
  lat: number;
  lon: number;
  accuracy?: number;     // meters (1σ)
  heading?: number | null;
  altitude?: number | null;
  speed?: number | null;
  ts?: number;           // ms epoch
};

export function useGeolocation ()
{
  const current = ref<Fix | null>(null);
  const best = ref<Fix | null>(null);        // best-so-far during settle
  const watching = ref(false);
  let watchId: string | null = null;
  let settleTimer: number | null = null;
  let settleUntil = 0;

  // Defaults that keep GPS "hot" and avoid cached/coarse fixes
  const DEFAULT_OPTS: ExtendedPositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 30000,
    minimumUpdateInterval: 1000,
  };

  const toCoords = (pos: Position): Fix => ({
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? undefined,  // meters
    heading: pos.coords.heading ?? null,
    altitude: pos.coords.altitude ?? null,
    speed: pos.coords.speed ?? null,
    ts: (pos as any).timestamp ?? Date.now()
  });

  const m2ft = (m?: number) => (m == null ? undefined : m * 3.28084);

  /**
   * Single snapshot. Handy for “center map to me”.
   * Note: this will often be a coarse first fix; rely on start() for precision work.
   */
  async function recenter (options?: PositionOptions)
  {
    console.debug('[useGeolocation] recenter()', { options });
    const opts: ExtendedPositionOptions = { ...DEFAULT_OPTS, ...(options ?? {}) };
    try
    {
      const pos = await Geolocation.getCurrentPosition(opts);
      current.value = toCoords(pos);
    } catch (e)
    {
      console.error('[useGeolocation] recenter() Capacitor failed', e);
      // Web fallback (useful in dev)
      if (typeof navigator !== 'undefined' && navigator.geolocation?.getCurrentPosition)
      {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, opts as PositionOptions)
        );
        current.value = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          heading: pos.coords.heading ?? null,
          altitude: pos.coords.altitude ?? null,
          speed: pos.coords.speed ?? null,
          ts: (pos as any).timestamp ?? Date.now()
        };
        console.info('[useGeolocation] recenter() via browser fallback');
      } else
      {
        throw e;
      }
    }
  }

  /**
   * Start a continuous watch and (optionally) wait for a good fix.
   * - minAccuracyM: emit immediately once accuracy <= this (e.g., 10 m). If never reached, emit best at settleMs.
   * - settleMs: how long to wait for convergence (default 15s).
   * - options: PositionOptions to tweak polling/caching/timeout; defaults keep GPS hot.
   */
  async function start (opts?: { minAccuracyM?: number; settleMs?: number; options?: PositionOptions })
  {
    if (watching.value) return;
    watching.value = true;

    const minAccuracyM = opts?.minAccuracyM ?? 10;  // 10 m ≈ 33 ft
    const settleMs = opts?.settleMs ?? 15000;       // give GNSS time to converge
    const options: ExtendedPositionOptions = { ...DEFAULT_OPTS, ...(opts?.options ?? {}) };

    // Settle window bookkeeping
    best.value = null;
    settleUntil = Date.now() + settleMs;
    if (settleTimer)
    {
      clearTimeout(settleTimer);
      settleTimer = null;
    }

    // Deadline emit: if we never hit minAccuracyM, publish best-so-far at the settle deadline
    settleTimer = window.setTimeout(() =>
    {
      if (!watching.value) return;
      if (best.value) current.value = best.value;
      // keep the watch alive; caller can stop() when leaving the screen
    }, settleMs) as unknown as number;

    watchId = await Geolocation.watchPosition(
      options,
      (pos, err) =>
      {
        if (err)
        {
          console.error('[useGeolocation] watchPosition error', err);
          return;
        }
        if (!pos) return;

        const fix = toCoords(pos);

        // Track best-so-far by smallest accuracy (undefined means we can’t judge; accept once)
        if (!best.value || (fix.accuracy != null && (best.value.accuracy == null || fix.accuracy < best.value.accuracy)))
        {
          best.value = fix;
        }

        // Emit immediately once we hit target accuracy (within settle window)
        if (fix.accuracy != null && fix.accuracy <= minAccuracyM)
        {
          current.value = fix;
          // Keep the watch running to hold the GNSS "hot" while the screen is open
        } else
        {
          // If settle window has passed and we still haven’t emitted, publish best-so-far
          if (Date.now() > settleUntil && best.value && current.value !== best.value)
          {
            current.value = best.value;
          }
        }
      }
    );
  }

  async function ensurePermissions (): Promise<boolean>
  {
    try
    {
      const status = await Geolocation.checkPermissions();
      // Capacitor’s types vary a bit; handle both precise & coarse flags
      const granted =
        (status as any).location === 'granted' ||
        (status as any).coarseLocation === 'granted' ||
        (status as any).fineLocation === 'granted';
      if (granted) return true;
      const req = await Geolocation.requestPermissions();
      return (
        (req as any).location === 'granted' ||
        (req as any).coarseLocation === 'granted' ||
        (req as any).fineLocation === 'granted'
      );
    } catch
    {
      // Web adapter may throw for Permissions API; allow proceeding in dev
      return true;
    }
  }

  function autoStartOnMounted (opts?: {
    recenter?: boolean;
    options?: PositionOptions;
    minAccuracyM?: number;
    settleMs?: number;
    onGranted?: () => void;
    onDenied?: () => void;
  })
  {
    onMounted(async () =>
    {
      const ok = await ensurePermissions();
      if (ok)
      {
        await start({ minAccuracyM: opts?.minAccuracyM, settleMs: opts?.settleMs, options: opts?.options });
        if (opts?.recenter !== false) await recenter(opts?.options);
        opts?.onGranted?.();
      } else
      {
        opts?.onDenied?.();
      }
    });
  }

  async function stop ()
  {
    if (settleTimer)
    {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    if (watchId != null) await Geolocation.clearWatch({ id: watchId });
    watchId = null;
    watching.value = false;
  }

  onBeforeUnmount(() => { void stop(); });

  return {
    current,        // meters in .accuracy; convert with m2ft() if you show feet
    best,
    watching,
    start,
    stop,
    recenter,
    ensurePermissions,
    autoStartOnMounted,
    m2ft
  };
}
