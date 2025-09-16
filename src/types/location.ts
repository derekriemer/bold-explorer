/**
 * A provider of location services.
 * In absttract terms, a provider produces locations periodically according to some trigger.
 * The provider is driven by some event, whether that be user input in the form of virtual navigation, or a real geolocation sensor.
 * In tests, a gpx trail could be provided, or simply a list of lat/lng/time tuples. The provider can drive the test through a simulated hike.
 * In a game, a locationProvider could change the location according to user movement, which would drive the gps as if there was a real gps fix.
 * In the real world, sensor arrays such as gps can provide locations to the app.
 */
export type ProviderKind = 'geolocation' | 'mock' | 'replay' | 'background';


/** Provider interface to implement for any source of locations. */
export interface LocationProvider
{
    /** Start producing samples. Call onSample/onError for each update. */
    start (
        opts: Required<ProviderOptions>,
        onSample: (s: LocationSample) => void,
        onError: (e: unknown) => void
    ): Promise<void>;

    /** Stop producing samples and release resources. */
    stop (): Promise<void>;

    /** True if provider is actively producing samples. */
    isActive (): boolean;
}

// todo (codex): Document me
export interface LocationSample
{
    lat: number;
    lon: number;
    accuracy?: number;      // meters
    altitude?: number | null;
    heading?: number | null;
    speed?: number | null;  // m/s
    timestamp: number;      // ms since epoch
    provider: ProviderKind;
    raw?: unknown;          // original Position if you want to keep it
}

// Todo (codex): Document me
export interface WatchOptions
{
    minAccuracyM?: number;  // drop samples worse than this
    minIntervalMs?: number; // throttle
    distanceMinM?: number;  // only emit if moved this far
}

/**
 * Options providers may need internally. Typically not exposed to app consumers,
 * but configurable by the app configurator.
 */
export interface ProviderOptions
{
    timeoutMs?: number;  // geolocation timeout
    maximumAgeMs?: number;
}
