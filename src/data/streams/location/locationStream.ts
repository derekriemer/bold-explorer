// src/data/streams/location/LocationStream.ts
// One authoritative stream of LocationSample updates with start/stop + filters.
// - Accuracy gate
// - Interval throttle
// - Distance gate
// Providers only emit raw samples; LocationStream applies all gating.
// Default provider = Capacitor Geolocation.

import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

import { haversineDistanceMeters } from '@/utils/geo';
import { toLatLng } from '@/types';
import type { LocationSample, WatchOptions, ProviderOptions, LocationProvider, ProviderKind } from '@/types';
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
        timeoutMs: 30000,
        maximumAgeMs: 0
    };

    /** Consumer-facing watch filters */
    private opts: Required<WatchOptions> = {
        minAccuracyM: 15,
        minIntervalMs: 1000,
        distanceMinM: 0
    };

    /** Gates bookkeeping */
    private lastEmitted: LocationSample | null = null;
    private lastEmitTime = 0;

    /** Track requested watch state */
    private shouldBeWatching = false;
    private starting = false;

    constructor(provider?: LocationProvider)
    {
        const active = provider ?? providerRegistry.getActiveProvider();
        this.provider = active;
        // React to registry changes by swapping provider and preserving watch state
        providerRegistry.active$.subscribe(({ provider: p }) => { void this.swapProvider(p); });
    }

    /** Swap in a new provider (e.g., BackgroundProvider, MockProvider). */
    private async swapProvider (next: LocationProvider): Promise<void>
    {
        const resume = this.shouldBeWatching;
        const prev = this.provider;

        if (resume && prev && prev.isActive())
        {
            try { await prev.stop(); }
            catch (err)
            {
                console.warn('[locationStream] failed to stop previous provider', err);
            }
        }

        this.provider = next;

        if (resume)
        {
            void this.start();
        }
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
        if (this.isWatching() || this.starting)
        {
            this.shouldBeWatching = true;
            return;
        }

        this.shouldBeWatching = true;

        // Reset gates
        this.lastEmitted = null;
        this.lastEmitTime = 0;

        this.starting = true;
        try
        {
            await this.provider.start(
                this.providerOpts,
                (s) => this.emitIfPasses(s),
                (e) => { this.handleProviderError(e); }
            );
        }
        catch (err)
        {
            this.handleProviderError(err);
        }
        finally
        {
            this.starting = false;
        }

        if (!this.provider.isActive() && this.shouldBeWatching)
        {
            this.scheduleBackgroundFallback('inactive-after-start');
        }
    }

    async stop ()
    {
        if (!this.shouldBeWatching && !this.isWatching()) return;
        this.shouldBeWatching = false;
        try
        {
            await this.provider.stop();
        }
        catch (err)
        {
            console.warn('[locationStream] failed to stop provider', err);
        }
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

    private handleProviderError (err: unknown)
    {
        if (!this.shouldBeWatching)
        {
            console.warn('[locationStream] provider error after stop request', err);
            return;
        }

        this.scheduleBackgroundFallback(err);
    }

    private scheduleBackgroundFallback (reason: unknown)
    {
        if (!this.shouldBeWatching) return;
        if (providerRegistry.getActiveKind() !== 'background')
        {
            if (reason !== 'inactive-after-start')
            {
                console.warn('[locationStream] provider error', reason);
            }
            return;
        }

        console.warn('[locationStream] background provider unavailable, falling back to geolocation', reason);
        providerRegistry.switchTo('geolocation');

        queueMicrotask(() =>
        {
            if (!this.shouldBeWatching) return;
            if (providerRegistry.getActiveKind() !== 'geolocation') return;
            if (this.isWatching() || this.starting) return;
            void this.start();
        });
    }
}

export const locationStream = new LocationStream();
export { LocationStream };
export type { LocationSample, WatchOptions, ProviderOptions, LocationProvider, ProviderKind };
