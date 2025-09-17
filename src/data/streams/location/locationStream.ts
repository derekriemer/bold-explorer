// src/data/streams/location/LocationStream.ts
// One authoritative stream of LocationSample updates with start/stop + filters.
// - Accuracy gate
// - Interval throttle
// - Distance gate
// Providers only emit raw samples; LocationStream applies all gating.
// Default provider = Capacitor Geolocation with enableHighAccuracy=true.

import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

import { haversineDistanceMeters } from '@/utils/geo';
import { toLatLng } from '@/types';
import type { LocationSample, WatchOptions, ProviderOptions, LocationProvider, ProviderKind } from '@/types';
import { GeolocationProvider } from './providers';
import { providerRegistry } from './providerRegistry';


// ---------------- The stream singleton ------------------------------

class LocationStream
{
    private subject = new BehaviorSubject<LocationSample | null>(null);
    /** Public read-only stream of filtered samples */
    public readonly updates: Observable<LocationSample> = this.subject.asObservable()
        .pipe(filter((v): v is LocationSample => v !== null));

    /** Provider + configs */
    private provider: LocationProvider;
    private providerOpts: Required<ProviderOptions> = {
        timeoutMs: 15000,
        maximumAgeMs: 0
    };

    /** Consumer-facing watch filters */
    private opts: Required<WatchOptions> = {
        minAccuracyM: 30,
        minIntervalMs: 1000,
        distanceMinM: 0
    };

    /** Gates bookkeeping */
    private lastEmitted: LocationSample | null = null;
    private lastEmitTime = 0;

    constructor(provider?: LocationProvider)
    {
        const active = provider ?? providerRegistry.getActiveProvider();
        this.provider = active;
        // React to registry changes by swapping provider and preserving watch state
        providerRegistry.active$.subscribe(({ provider: p }) => { this.swapProvider(p); });
    }

    /** Swap in a new provider (e.g., BackgroundProvider, MockProvider). */
    swapProvider (next: LocationProvider)
    {
        const wasActive = this.isWatching();
        if (wasActive) void this.stop();
        this.provider = next;
        if (wasActive) void this.start(); // resume with same configs
    }

    /** Configure provider-level behavior (timeouts, cache). */
    configureProvider (partial: Partial<ProviderOptions>)
    {
        this.providerOpts = { ...this.providerOpts, ...partial };
    }

    /** Configure stream-level filters (accuracy/interval/distance). */
    configureWatch (partial: Partial<WatchOptions>)
    {
        this.opts = { ...this.opts, ...partial };
    }

    /** Whether the underlying provider is active */
    public isWatching (): boolean { return this.provider.isActive(); }

    /** Start watching; providers emit raw samples, we apply gates. */
    async start ()
    {
        if (this.isWatching()) return;

        // Reset gates
        this.lastEmitted = null;
        this.lastEmitTime = 0;

        await this.provider.start(
            this.providerOpts,
            (s) => this.emitIfPasses(s),
            (_e) => { /* optionally surface an error subject */ }
        );
    }

    async stop ()
    {
        if (!this.isWatching()) return;
        await this.provider.stop();
    }

    // ---------------- Gating logic ----------------

    private emitIfPasses (s: LocationSample)
    {
        // Accuracy filter
        if (this.opts.minAccuracyM && typeof s.accuracy === 'number' && s.accuracy > this.opts.minAccuracyM) return;

        // Interval throttle
        const now = Date.now();
        if (now - this.lastEmitTime < this.opts.minIntervalMs) return;

        // Distance gate
        if (this.lastEmitted && this.opts.distanceMinM > 0)
        {
            const d = haversineDistanceMeters(
                toLatLng(this.lastEmitted.lat, this.lastEmitted.lon),
                toLatLng(s.lat, s.lon)
            );
            if (d < this.opts.distanceMinM) return;
        }

        this.lastEmitted = s;
        this.lastEmitTime = now;
        this.subject.next(s);
    }
}

export const locationStream = new LocationStream();
export { LocationStream };
export type { LocationSample, WatchOptions, ProviderOptions, LocationProvider, ProviderKind };
