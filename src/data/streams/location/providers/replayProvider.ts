import type { LocationProvider, LocationSample, ProviderOptions } from '@/types';

export type ReplayPoint = {
  lat: number;
  lon: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number; // if absent, we will synthesize based on last sample
};

/**
 * Provider that replays a predefined list of positions on demand via tick().
 * - start(): primes and emits the first point; provider remains active.
 * - tick(): emits the next point; returns true if advanced, false if at end.
 */
export class ReplayProvider implements LocationProvider
{
  private points: ReplayPoint[];
  private idx = 0;
  private active = false;
  private onSample: ((s: LocationSample) => void) | null = null;
  private onError: ((e: unknown) => void) | null = null;
  private clock = Date.now();

  constructor(points: ReplayPoint[])
  {
    this.points = points.slice();
  }

  isActive (): boolean { return this.active; }

  async start (
    _opts: Required<ProviderOptions>,
    onSample: (s: LocationSample) => void,
    onError: (e: unknown) => void
  ): Promise<void>
  {
    this.onSample = onSample;
    this.onError = onError;
    this.active = true;
    this.idx = 0;
    if (this.points.length > 0)
    {
      const p = this.points[0];
      const ts = p.timestamp ?? this.clock;
      this.clock = ts;
      onSample({
        lat: p.lat,
        lon: p.lon,
        accuracy: p.accuracy,
        altitude: p.altitude ?? null,
        heading: p.heading ?? null,
        speed: p.speed ?? null,
        timestamp: ts,
        provider: 'replay'
      });
    }
  }

  async stop (): Promise<void>
  {
    this.active = false;
    this.onSample = null;
    this.onError = null;
  }

  /** Advance and emit next point. Returns true if advanced. */
  tick (): boolean
  {
    if (!this.active || !this.onSample) return false;
    if (this.idx + 1 >= this.points.length) return false;
    this.idx += 1;
    const p = this.points[this.idx];
    const ts = p.timestamp ?? (this.clock + 1000);
    this.clock = ts;
    this.onSample({
      lat: p.lat,
      lon: p.lon,
      accuracy: p.accuracy,
      altitude: p.altitude ?? null,
      heading: p.heading ?? null,
      speed: p.speed ?? null,
      timestamp: ts,
      provider: 'replay'
    });
    return true;
  }

  /** Reset to the first point (does not emit). */
  reset () { this.idx = 0; }
}
