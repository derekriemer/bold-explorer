import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocationSample, ProviderOptions } from '@/types';
import { isAccuracyAcceptable, LocationStream } from '@/data/streams/location/locationStream';
import { providerRegistry } from '@/data/streams/location/providerRegistry';
import { BackgroundGeolocationProvider, GeolocationProvider, FakeableProvider } from '@/data/streams/location/providers';

function makeSample (override: Partial<LocationSample>): LocationSample
{
  return {
    lat: 0,
    lon: 0,
    timestamp: 0,
    provider: 'geolocation',
    ...override
  } as LocationSample;
}

describe('isAccuracyAcceptable', () =>
{
  it('drops geolocation samples worse than the requested accuracy', () =>
  {
    const sample = makeSample({ provider: 'geolocation', accuracy: 22 });
    expect(isAccuracyAcceptable(sample, 15)).toBe(false);
  });

  it('keeps background samples that beat the relaxed floor', () =>
  {
    const sample = makeSample({ provider: 'background', accuracy: 40 });
    expect(isAccuracyAcceptable(sample, 15)).toBe(true);
  });

  it('still filters background samples far outside the floor', () =>
  {
    const sample = makeSample({ provider: 'background', accuracy: 130 });
    expect(isAccuracyAcceptable(sample, 15)).toBe(false);
  });

  it('accepts samples without a numeric accuracy', () =>
  {
    const sample = makeSample({ provider: 'background', accuracy: undefined });
    expect(isAccuracyAcceptable(sample, 15)).toBe(true);
  });

  it('ignores the gate when no minimum accuracy is requested', () =>
  {
    const sample = makeSample({ provider: 'background', accuracy: 200 });
    expect(isAccuracyAcceptable(sample, undefined)).toBe(true);
  });
});

describe('LocationStream helpers', () =>
{
  it('delegates ensureProviderPermissions when available', async () =>
  {
    const provider = new FakeableProvider();
    const ensure = vi.spyOn(provider, 'ensurePermissions').mockResolvedValue(true);
    const activeKindSpy = vi.spyOn(providerRegistry, 'getActiveKind').mockReturnValue('mock');
    const activeProviderSpy = vi.spyOn(providerRegistry, 'getActiveProvider').mockReturnValue(provider);
    const activeGetter = vi.spyOn(providerRegistry, 'active$', 'get').mockReturnValue({ subscribe: () => ({ unsubscribe () {} }) } as any);
    const stream = new LocationStream(provider);
    expect(await stream.ensureProviderPermissions()).toBe(true);
    expect(ensure).toHaveBeenCalledTimes(1);
    activeKindSpy.mockRestore();
    activeProviderSpy.mockRestore();
    activeGetter.mockRestore();
  });

  it('falls back to last sample when provider snapshot is unavailable', async () =>
  {
    const provider = new FakeableProvider();
    const getCurrent = vi.spyOn(provider, 'getCurrent').mockResolvedValue(null);
    const activeKindSpy = vi.spyOn(providerRegistry, 'getActiveKind').mockReturnValue('mock');
    const activeProviderSpy = vi.spyOn(providerRegistry, 'getActiveProvider').mockReturnValue(provider);
    const activeGetter = vi.spyOn(providerRegistry, 'active$', 'get').mockReturnValue({ subscribe: () => ({ unsubscribe () {} }) } as any);
    const stream = new LocationStream(provider);
    const sample = makeSample({ provider: 'geolocation', accuracy: 5 });
    (stream as any).subject.next(sample);
    expect(await stream.getCurrentSnapshot()).toEqual(sample);
    expect(getCurrent).toHaveBeenCalledTimes(1);
    activeKindSpy.mockRestore();
    activeProviderSpy.mockRestore();
    activeGetter.mockRestore();
  });
});

describe('LocationStream settling behaviour', () =>
{
  afterEach(() =>
  {
    vi.useRealTimers();
  });

  it('emits best-so-far once the settle window elapses', async () =>
  {
    vi.useFakeTimers();

    const provider = new FakeableProvider();
    const activeKindSpy = vi.spyOn(providerRegistry, 'getActiveKind').mockReturnValue('mock');
    const activeProviderSpy = vi.spyOn(providerRegistry, 'getActiveProvider').mockReturnValue(provider);
    const activeGetter = vi.spyOn(providerRegistry, 'active$', 'get').mockReturnValue({ subscribe: () => ({ unsubscribe () {} }) } as any);
    const stream = new LocationStream(provider);
    stream.configureWatch({ minAccuracyM: 5, settleMs: 5000, minIntervalMs: 0, distanceMinM: 0 });

    await stream.start();

    const received: LocationSample[] = [];
    const sub = stream.updates.subscribe((sample) => { received.push(sample); });

    provider.emitSample({ lat: 1, lon: 2, accuracy: 50, timestamp: Date.now() } as any);
    expect(received).toHaveLength(0);

    vi.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(received).toHaveLength(1);
    expect(received[0]?.accuracy).toBe(50);

    sub.unsubscribe();
    await stream.stop();

    activeKindSpy.mockRestore();
    activeProviderSpy.mockRestore();
    activeGetter.mockRestore();
  });

  it('emits immediately when accuracy target is met and cancels the settle timer', async () =>
  {
    vi.useFakeTimers();

    const provider = new FakeableProvider();
    const activeKindSpy = vi.spyOn(providerRegistry, 'getActiveKind').mockReturnValue('mock');
    const activeProviderSpy = vi.spyOn(providerRegistry, 'getActiveProvider').mockReturnValue(provider);
    const activeGetter = vi.spyOn(providerRegistry, 'active$', 'get').mockReturnValue({ subscribe: () => ({ unsubscribe () {} }) } as any);
    const stream = new LocationStream(provider);
    stream.configureWatch({ minAccuracyM: 5, settleMs: 5000, minIntervalMs: 0, distanceMinM: 0 });

    await stream.start();

    const received: LocationSample[] = [];
    const sub = stream.updates.subscribe((sample) => { received.push(sample); });

    provider.emitSample({ lat: 1, lon: 2, accuracy: 3, timestamp: Date.now() } as any);
    expect(received).toHaveLength(1);

    vi.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(received).toHaveLength(1);

    sub.unsubscribe();
    await stream.stop();

    activeKindSpy.mockRestore();
    activeProviderSpy.mockRestore();
    activeGetter.mockRestore();
  });
});

describe('providerRegistry background fallback handling', () =>
{
  afterEach(() =>
  {
    providerRegistry.switchTo('geolocation');
    vi.restoreAllMocks();
  });

  it('defaults to geolocation when background is unsupported', () =>
  {
    vi.spyOn(BackgroundGeolocationProvider, 'isSupported').mockReturnValue(false);
    const provider = providerRegistry.get('background');
    expect(provider).toBeInstanceOf(GeolocationProvider);
  });

  it('keeps the explicit background selection even if support probe fails', () =>
  {
    vi.spyOn(BackgroundGeolocationProvider, 'isSupported').mockReturnValue(false);
    const provider = providerRegistry.switchTo('background');
    expect(providerRegistry.getActiveKind()).toBe('background');
    expect(provider).toBeInstanceOf(BackgroundGeolocationProvider);
  });
});
