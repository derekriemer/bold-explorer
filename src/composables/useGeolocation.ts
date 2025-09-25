import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { PositionOptions } from '@capacitor/geolocation';
import { locationStream } from '@/data/streams/location';
import type { LocationSample, WatchOptions, ProviderOptions } from '@/types';
import type { Subscription } from 'rxjs';

type Fix = {
  lat: number;
  lon: number;
  accuracy?: number;
  heading?: number | null;
  altitude?: number | null;
  speed?: number | null;
  ts?: number;
};

type StartOptions = {
  minAccuracyM?: number;
  settleMs?: number;
  options?: PositionOptions;
};

type AutoStartOptions = StartOptions & {
  recenter?: boolean;
  onGranted?: () => void;
  onDenied?: () => void;
};

function toFix (sample: LocationSample): Fix
{
  return {
    lat: sample.lat,
    lon: sample.lon,
    accuracy: sample.accuracy,
    altitude: sample.altitude ?? null,
    heading: sample.heading ?? null,
    speed: sample.speed ?? null,
    ts: sample.timestamp,
  };
}

function mapPositionOptionsToProvider (opts?: PositionOptions): Partial<ProviderOptions>
{
  if (!opts) return {};
  const provider: Partial<ProviderOptions> = {};
  if (opts.timeout != null) provider.timeoutMs = opts.timeout;
  if (opts.maximumAge != null) provider.maximumAgeMs = opts.maximumAge;
  return provider;
}

function mapToWatchOptions (opts?: StartOptions): Partial<WatchOptions>
{
  if (!opts) return {};
  const watch: Partial<WatchOptions> = {};
  if (opts.minAccuracyM != null) watch.minAccuracyM = opts.minAccuracyM;
  if (opts.settleMs != null) watch.settleMs = opts.settleMs;
  return watch;
}

export function useGeolocation ()
{
  const current = ref<Fix | null>(null);
  const best = ref<Fix | null>(null);
  const watching = ref(false);
  let sub: Subscription | null = null;

  const updateBest = (sample: Fix) =>
  {
    if (!best.value)
    {
      best.value = sample;
      return;
    }

    const newAcc = sample.accuracy;
    const bestAcc = best.value.accuracy;

    if (newAcc == null)
    {
      if (bestAcc == null) best.value = sample;
      return;
    }

    if (bestAcc == null || newAcc < bestAcc)
    {
      best.value = sample;
    }
  };

  async function start (opts?: StartOptions): Promise<boolean>
  {
    if (watching.value) return true;

    best.value = null;

    const watchOpts = mapToWatchOptions(opts);
    if (Object.keys(watchOpts).length > 0)
    {
      locationStream.configureWatch(watchOpts);
    }

    const providerOpts = mapPositionOptionsToProvider(opts?.options);
    if (Object.keys(providerOpts).length > 0)
    {
      locationStream.configureProvider(providerOpts);
    }

    const ok = await locationStream.ensureProviderPermissions();
    if (!ok)
    {
      return false;
    }

    await locationStream.start();
    sub = locationStream.updates.subscribe((sample) =>
    {
      const fix = toFix(sample);
      current.value = fix;
      updateBest(fix);
    });
    watching.value = true;
    return true;
  }

  async function stop (): Promise<void>
  {
    if (!watching.value) return;
    try { sub?.unsubscribe(); } catch {}
    sub = null;
    await locationStream.stop();
    watching.value = false;
  }

  async function recenter (options?: PositionOptions): Promise<Fix | null>
  {
    const providerOpts = mapPositionOptionsToProvider(options);
    const sample = await locationStream.getCurrentSnapshot(providerOpts);
    if (sample)
    {
      const fix = toFix(sample);
      current.value = fix;
      updateBest(fix);
      return fix;
    }
    return null;
  }

  async function ensurePermissions (): Promise<boolean>
  {
    return await locationStream.ensureProviderPermissions();
  }

  function autoStartOnMounted (opts?: AutoStartOptions)
  {
    onMounted(async () =>
    {
      const ok = await start(opts);
      if (ok)
      {
        if (opts?.recenter !== false)
        {
          await recenter(opts?.options);
        }
        opts?.onGranted?.();
      }
      else
      {
        opts?.onDenied?.();
      }
    });
  }

  onBeforeUnmount(() => { void stop(); });

  const m2ft = (m?: number) => (m == null ? undefined : m * 3.28084);

  return {
    current,
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
