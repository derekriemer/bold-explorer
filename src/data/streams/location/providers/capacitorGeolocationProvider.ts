import { LocationProvider, LocationSample, ProviderOptions } from '@/types';
import { Geolocation, type Position, type PositionOptions } from '@capacitor/geolocation';

export class GeolocationProvider implements LocationProvider
{
    private watchId: string | null = null;
    isActive () { return this.watchId !== null; }

    async start (
        opts: Required<ProviderOptions>,
        onSample: (s: LocationSample) => void,
        onError: (e: unknown) => void
    ): Promise<void>
    {
        const posOpts: PositionOptions = {
            enableHighAccuracy: true,        // Always burn high accuracy; this is a GPS app.
            timeout: opts.timeoutMs,
            maximumAge: opts.maximumAgeMs,
            minimumUpdateInterval: 1000
        };

        // Seed with one fix (optional but helpful)
        try
        {
            const p = await Geolocation.getCurrentPosition(posOpts);
            onSample(positionToSample(p));
        } catch (e)
        {
            // Non-fatal; watch may still produce updates.
            onError(e);
        }

        this.watchId = await Geolocation.watchPosition(posOpts, (p, err) =>
        {
            if (err) return onError(err);
            if (p) onSample(positionToSample(p));
        });
    }

    async stop (): Promise<void>
    {
        if (!this.watchId) return;
        await Geolocation.clearWatch({ id: this.watchId });
        this.watchId = null;
    }
}

function positionToSample (p: Position): LocationSample
{
    return {
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        accuracy: p.coords.accuracy,
        altitude: p.coords.altitude ?? null,
        heading: p.coords.heading ?? null,
        speed: p.coords.speed ?? null,
        timestamp: (p as any).timestamp ?? Date.now(),
        provider: 'geolocation',
        raw: p
    };
}
