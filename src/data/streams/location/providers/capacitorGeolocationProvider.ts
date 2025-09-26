import { LocationProvider, LocationSample, ProviderOptions } from '@/types';
import {
  Geolocation,
  type PermissionStatus,
  type Position,
  type PositionOptions,
} from '@capacitor/geolocation';

export class GeolocationProvider implements LocationProvider {
  private watchId: string | null = null;
  isActive() {
    return this.watchId !== null;
  }

  async ensurePermissions(): Promise<boolean> {
    try {
      const status: PermissionStatus = await Geolocation.checkPermissions();
      const granted = isLocationGranted(status);
      if (granted) {
        return true;
      }
      const req: PermissionStatus = await Geolocation.requestPermissions();
      return isLocationGranted(req);
    } catch (err) {
      console.warn('[GeolocationProvider] ensurePermissions failed', err);
      return false;
    }
  }

  async getCurrent(opts: Partial<ProviderOptions>): Promise<LocationSample> {
    const position = await Geolocation.getCurrentPosition(toPositionOptions(opts));
    return positionToSample(position);
  }

  async start(
    opts: Required<ProviderOptions>,
    onSample: (s: LocationSample) => void,
    onError: (e: unknown) => void
  ): Promise<void> {
    const posOpts = toPositionOptions(opts);

    // Seed with one fix (optional but helpful)
    try {
      const p = await Geolocation.getCurrentPosition(posOpts);
      onSample(positionToSample(p));
    } catch (e) {
      // Non-fatal; watch may still produce updates.
      onError(e);
    }

    this.watchId = await Geolocation.watchPosition(posOpts, (p, err) => {
      if (err) {
        return onError(err);
      }
      if (p) {
        onSample(positionToSample(p));
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.watchId) {
      return;
    }
    await Geolocation.clearWatch({ id: this.watchId });
    this.watchId = null;
  }
}

function positionToSample(p: Position): LocationSample {
  return {
    lat: p.coords.latitude,
    lon: p.coords.longitude,
    accuracy: p.coords.accuracy,
    altitude: p.coords.altitude ?? null,
    heading: p.coords.heading ?? null,
    speed: p.coords.speed ?? null,
    timestamp: (p as any).timestamp ?? Date.now(),
    provider: 'geolocation',
    raw: p,
  };
}

function toPositionOptions(opts: Partial<ProviderOptions>): PositionOptions {
  return {
    enableHighAccuracy: true,
    timeout: opts.timeoutMs,
    maximumAge: opts.maximumAgeMs,
    minimumUpdateInterval: 1000,
  };
}

function isLocationGranted(status: PermissionStatus): boolean {
  return (
    (status as any).location === 'granted' ||
    (status as any).coarseLocation === 'granted' ||
    (status as any).fineLocation === 'granted'
  );
}
