import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocationProvider, LocationSample, ProviderOptions } from '@/types';
import { isAccuracyAcceptable, LocationStream } from '@/data/streams/location/locationStream';
import { providerRegistry } from '@/data/streams/location/providerRegistry';
import { BackgroundGeolocationProvider, GeolocationProvider } from '@/data/streams/location/providers';

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
    const ensure = vi.fn<[], Promise<boolean>>().mockResolvedValue(true);
    const stubProvider: LocationProvider = {
      async start (_opts: Required<ProviderOptions>) {},
      async stop () {},
      isActive: () => false,
      ensurePermissions: ensure
    };
    const stream = new LocationStream(stubProvider);
    expect(await stream.ensureProviderPermissions()).toBe(true);
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it('falls back to last sample when provider snapshot is unavailable', async () =>
  {
    const stubProvider: LocationProvider = {
      async start (_opts: Required<ProviderOptions>) {},
      async stop () {},
      isActive: () => false,
      getCurrent: async () => null
    };
    const stream = new LocationStream(stubProvider);
    const sample = makeSample({ provider: 'geolocation', accuracy: 5 });
    (stream as any).subject.next(sample);
    expect(await stream.getCurrentSnapshot()).toEqual(sample);
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
