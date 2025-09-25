/** A provider that fakes the users location.  for tests.*/
import { METERS_PER_DEG_LAT } from '@/utils/geo';
import type { LocationProvider, LocationSample, ProviderOptions } from '@/types';

/**
 * Simple programmable provider used for tests and dev tools.
 * - Call emitSample() directly or use helpers emitCoords()/walkDirection().
 */
export class FakeableProvider implements LocationProvider
{
  private active = false;
  private onSample: ((s: LocationSample) => void) | null = null;
  private onError: ((e: unknown) => void) | null = null;
  private clock = Date.now();
  private cur: { lat: number; lon: number } | null = null;

  isActive (): boolean { return this.active; }

  async ensurePermissions (): Promise<boolean>
  {
    return true;
  }

  async getCurrent (_opts?: Partial<ProviderOptions>): Promise<LocationSample>
  {
    if (!this.cur)
    {
      throw new Error('FakeableProvider has no current location');
    }
    return {
      lat: this.cur.lat,
      lon: this.cur.lon,
      timestamp: this.clock,
      provider: 'mock'
    };
  }

  async start (
    _opts: Required<ProviderOptions>,
    onSample: (s: LocationSample) => void,
    onError: (e: unknown) => void
  ): Promise<void>
  {
    this.onSample = onSample;
    this.onError = onError;
    this.active = true;
    // Optionally emit current position if already set
    if (this.cur)
    {
      onSample({
        lat: this.cur.lat,
        lon: this.cur.lon,
        timestamp: this.clock,
        provider: 'mock'
      });
    }
  }

  async stop (): Promise<void>
  {
    this.active = false;
    this.onSample = null;
    this.onError = null;
  }

  /** Directly emit a prepared sample. */
  emitSample (s: Omit<LocationSample, 'provider'>)
  {
    if (!this.active || !this.onSample) return;
    const sample: LocationSample = { ...s, provider: 'mock' };
    this.cur = { lat: sample.lat, lon: sample.lon };
    this.clock = sample.timestamp ?? this.clock;
    this.onSample(sample);
  }

  /** Emit at coords with time delta (ms). */
  emitCoords (pt: { lat: number; lon: number }, timePassedMs: number, extras?: Partial<Omit<LocationSample, 'lat' | 'lon' | 'timestamp' | 'provider'>>)
  {
    this.clock += timePassedMs;
    this.cur = { lat: pt.lat, lon: pt.lon };
    this.emitSample({
      lat: pt.lat,
      lon: pt.lon,
      timestamp: this.clock,
      accuracy: extras?.accuracy,
      altitude: extras?.altitude ?? null,
      heading: extras?.heading ?? null,
      speed: extras?.speed ?? null
    } as any);
  }

  /**
   * Move from the current point along a bearing (deg) by distance (m), then emit.
   * Uses a local planar approximation suitable for short steps.
   */
  walkDirection (bearingDeg: number, distanceM: number, timePassedMs: number, extras?: Partial<Omit<LocationSample, 'lat' | 'lon' | 'timestamp' | 'provider'>>)
  {
    if (!this.cur)
    {
      this.onError?.(new Error('FakeableProvider.walkDirection called before an initial position was set'));
      return;
    }
    const latRad = this.cur.lat * Math.PI / 180;
    const dLatDeg = (distanceM * Math.cos(bearingDeg * Math.PI / 180)) / METERS_PER_DEG_LAT;
    const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos(latRad);
    const dLonDeg = metersPerDegLon > 1e-6 ? (distanceM * Math.sin(bearingDeg * Math.PI / 180)) / metersPerDegLon : 0;
    const next = { lat: this.cur.lat + dLatDeg, lon: this.cur.lon + dLonDeg };
    this.emitCoords(next, timePassedMs, extras);
  }

  /** Set current position without emitting (e.g., initialize). */
  setCurrent (pt: { lat: number; lon: number })
  {
    this.cur = { lat: pt.lat, lon: pt.lon };
  }
}
