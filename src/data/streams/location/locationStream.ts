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
import type {
  LocationSample,
  WatchOptions,
  ProviderOptions,
  LocationProvider,
  ProviderKind,
} from '@/types';
import { providerRegistry } from './providerRegistry';

type LocationStreamMetaEvent = {
  type: 'provider';
  provider: ProviderKind;
  previous: ProviderKind | null;
  at: number;
};

/**
 * Background fixes tend to arrive with lower precision than foreground GPS.
 * Relax the accuracy gate so we still surface a best-effort position instead of dropping every update.
 */
const BACKGROUND_ACCURACY_FLOOR = 50;

function isAccuracyAcceptable(sample: LocationSample, minAccuracy?: number | null): boolean {
  if (!minAccuracy) {
    return true;
  }
  const accuracy = sample.accuracy;
  if (typeof accuracy !== 'number' || Number.isNaN(accuracy)) {
    return true;
  }

  const limit =
    sample.provider === 'background'
      ? Math.max(minAccuracy, BACKGROUND_ACCURACY_FLOOR)
      : minAccuracy;

  return accuracy <= limit;
}

// ---------------- The stream singleton ------------------------------

class LocationStream {
  private subject = new BehaviorSubject<LocationSample | null>(null);
  /** Public read-only stream of filtered samples */
  public readonly updates: Observable<LocationSample> = this.subject
    .asObservable()
    .pipe(filter((v): v is LocationSample => v !== null));

  private readonly metaSubject: BehaviorSubject<LocationStreamMetaEvent>;
  /** Diagnostic/meta channel for provider + lifecycle events */
  public readonly meta$: Observable<LocationStreamMetaEvent>;

  /** Provider + configs */
  private provider: LocationProvider;
  private providerKind: ProviderKind;
  private providerOpts: Required<ProviderOptions> = {
    timeoutMs: 30000,
    maximumAgeMs: 0,
  };

  /** Consumer-facing watch filters */
  private opts: Required<WatchOptions> = {
    minAccuracyM: 15,
    minIntervalMs: 1000,
    distanceMinM: 0,
    settleMs: 0,
  };

  /** Gates bookkeeping */
  private lastEmitted: LocationSample | null = null;
  private lastEmitTime = 0;
  private bestCandidate: LocationSample | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private settleDeadline: number | null = null;

  /** Track requested watch state */
  private shouldBeWatching = false;
  private starting = false;

  constructor(provider?: LocationProvider) {
    const activeKind = providerRegistry.getActiveKind();
    const active = provider ?? providerRegistry.getActiveProvider();
    this.provider = active;
    this.providerKind = activeKind;

    const initialMeta: LocationStreamMetaEvent = {
      type: 'provider',
      provider: activeKind,
      previous: null,
      at: Date.now(),
    };
    this.metaSubject = new BehaviorSubject<LocationStreamMetaEvent>(initialMeta);
    this.meta$ = this.metaSubject.asObservable();

    // React to registry changes by swapping provider and preserving watch state
    providerRegistry.active$.subscribe(({ provider: p, kind }) => {
      void this.swapProvider(p, kind);
    });
  }

  /** Swap in a new provider (e.g., BackgroundProvider, MockProvider). */
  private async swapProvider(next: LocationProvider, nextKind: ProviderKind): Promise<void> {
    const resume = this.shouldBeWatching;
    const prev = this.provider;
    const prevKind = this.providerKind;

    if (resume && prev && prev.isActive()) {
      try {
        await prev.stop();
      } catch (err) {
        console.warn('[locationStream] failed to stop previous provider', err);
      }
    }

    this.provider = next;
    this.providerKind = nextKind;

    if (nextKind !== prevKind) {
      const meta: LocationStreamMetaEvent = {
        type: 'provider',
        provider: nextKind,
        previous: prevKind,
        at: Date.now(),
      };
      this.metaSubject.next(meta);
      console.info('[locationStream] provider changed', { from: prevKind, to: nextKind });
    }

    if (resume) {
      void this.start();
    }
  }

  /** Configure provider-level behavior (timeouts, cache). */
  configureProvider(partial: Partial<ProviderOptions>) {
    this.providerOpts = { ...this.providerOpts, ...partial };
  }

  /** Configure stream-level filters (accuracy/interval/distance). */
  configureWatch(partial: Partial<WatchOptions>) {
    this.opts = { ...this.opts, ...partial };
  }

  /** Whether the underlying provider is active */
  public isWatching(): boolean {
    return this.provider.isActive();
  }

  /** Ensure the active provider has required permissions. */
  public async ensureProviderPermissions(): Promise<boolean> {
    try {
      return await this.provider.ensurePermissions();
    } catch (err) {
      console.warn('[locationStream] ensureProviderPermissions failed', err);
      return false;
    }
    return true;
  }

  /** Fetch a snapshot from the provider or fall back to the last emitted sample. */
  public async getCurrentSnapshot(partial?: Partial<ProviderOptions>): Promise<LocationSample> {
    try {
      const sample = await this.provider.getCurrent({ ...this.providerOpts, ...partial });
      if (sample) {
        return sample;
      }
    } catch (err) {
      console.warn('[locationStream] getCurrentSnapshot provider failed', err);
      const fallback = this.subject.getValue();
      if (fallback) {
        return fallback;
      }
      throw err;
    }
    const fallback = this.subject.getValue();
    if (fallback) {
      return fallback;
    }
    throw new Error('Location snapshot unavailable');
  }

  /** Start watching; providers emit raw samples, we apply gates. */
  async start() {
    if (this.isWatching() || this.starting) {
      this.shouldBeWatching = true;
      return;
    }

    this.shouldBeWatching = true;

    // Reset gates
    this.lastEmitted = null;
    this.lastEmitTime = 0;

    this.starting = true;
    try {
      const ok = await this.provider.ensurePermissions();
      if (!ok) {
        const err = new Error('Location provider permissions were not granted');
        (err as any).code = 'PERMISSION_DENIED';
        this.handleProviderError(err);
        this.shouldBeWatching = false;
        this.clearSettlingState();
        return;
      }

      this.initSettlingState();
      await this.provider.start(
        this.providerOpts,
        (s) => this.emitIfPasses(s),
        (e) => {
          this.handleProviderError(e);
        }
      );
    } catch (err) {
      this.clearSettlingState();
      this.handleProviderError(err);
    } finally {
      this.starting = false;
    }

    if (!this.provider.isActive() && this.shouldBeWatching) {
      this.scheduleBackgroundFallback('inactive-after-start');
    }
  }

  async stop() {
    if (!this.shouldBeWatching && !this.isWatching()) {
      return;
    }
    this.shouldBeWatching = false;
    try {
      await this.provider.stop();
    } catch (err) {
      console.warn('[locationStream] failed to stop provider', err);
    } finally {
      this.clearSettlingState();
    }
  }

  // ---------------- Gating logic ----------------

  private emitIfPasses(s: LocationSample) {
    this.updateBestCandidate(s);

    // Accuracy filter (relaxed when background provider is active)
    if (!isAccuracyAcceptable(s, this.opts.minAccuracyM)) {
      return;
    }

    // Interval throttle
    const now = Date.now();
    if (now - this.lastEmitTime < this.opts.minIntervalMs) {
      return;
    }

    // Distance gate
    if (this.lastEmitted && this.opts.distanceMinM > 0) {
      const d = haversineDistanceMeters(
        toLatLng(this.lastEmitted.lat, this.lastEmitted.lon),
        toLatLng(s.lat, s.lon)
      );
      if (d < this.opts.distanceMinM) {
        return;
      }
    }

    this.emitSample(s);
    this.clearSettlingState();
  }

  private handleProviderError(err: unknown) {
    if (!this.shouldBeWatching) {
      console.warn('[locationStream] provider error after stop request', err);
      return;
    }

    this.scheduleBackgroundFallback(err);
  }

  private scheduleBackgroundFallback(reason: unknown) {
    if (!this.shouldBeWatching) {
      return;
    }
    if (providerRegistry.getActiveKind() !== 'background') {
      if (reason !== 'inactive-after-start') {
        console.warn('[locationStream] provider error', reason);
      }
      return;
    }

    console.warn(
      '[locationStream] background provider unavailable, falling back to geolocation',
      reason
    );
    providerRegistry.switchTo('geolocation');

    queueMicrotask(() => {
      if (!this.shouldBeWatching) {
        return;
      }
      if (providerRegistry.getActiveKind() !== 'geolocation') {
        return;
      }
      if (this.isWatching() || this.starting) {
        return;
      }
      void this.start();
    });
  }

  private initSettlingState(): void {
    this.clearSettlingState();
    const settleMs = Math.max(0, this.opts.settleMs ?? 0);
    if (settleMs > 0) {
      this.settleDeadline = Date.now() + settleMs;
      this.settleTimer = setTimeout(() => {
        this.flushBestCandidate();
      }, settleMs);
    }
  }

  private clearSettlingState(): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
    }
    this.settleTimer = null;
    this.settleDeadline = null;
    this.bestCandidate = null;
  }

  private updateBestCandidate(sample: LocationSample): void {
    if ((this.opts.settleMs ?? 0) <= 0) {
      return;
    }

    if (!this.bestCandidate) {
      this.bestCandidate = sample;
      return;
    }

    const candidateAcc = this.bestCandidate.accuracy;
    const nextAcc = sample.accuracy;

    if (typeof nextAcc === 'number' && !Number.isNaN(nextAcc)) {
      if (candidateAcc == null || Number.isNaN(candidateAcc) || nextAcc < candidateAcc) {
        this.bestCandidate = sample;
      }
    } else if (candidateAcc == null) {
      this.bestCandidate = sample;
    }
  }

  private flushBestCandidate(): void {
    if (!this.bestCandidate) {
      return;
    }
    const sample = this.bestCandidate;
    this.clearSettlingState();
    this.emitSample(sample);
  }

  private emitSample(sample: LocationSample): void {
    const now = Date.now();
    this.lastEmitted = sample;
    this.lastEmitTime = now;
    this.subject.next(sample);
  }
}

export const locationStream = new LocationStream();
export { LocationStream, isAccuracyAcceptable };
export type {
  LocationSample,
  WatchOptions,
  ProviderOptions,
  LocationProvider,
  ProviderKind,
  LocationStreamMetaEvent,
};
