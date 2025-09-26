import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
  Location as BackgroundLocation,
  CallbackError as BackgroundError,
  WatcherOptions,
} from '@capacitor-community/background-geolocation';
import type { LocationProvider, LocationSample, ProviderOptions } from '@/types';
import {
  LocalNotifications,
  type PermissionStatus as LocalNotificationPermissionStatus,
} from '@capacitor/local-notifications';
import {
  Geolocation,
  type PermissionStatus as GeolocationPermissionStatus,
} from '@capacitor/geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

const BACKGROUND_NOTIFICATION_TITLE = 'Bold Explorer';
const BACKGROUND_NOTIFICATION_MESSAGE = 'Tracking location in the background';

/** Convert plugin location payloads into the app's LocationSample shape. */
function toSample(location: BackgroundLocation): LocationSample {
  return {
    lat: location.latitude,
    lon: location.longitude,
    accuracy: location.accuracy ?? undefined,
    altitude: location.altitude ?? null,
    heading: location.bearing ?? null,
    speed: location.speed ?? null,
    timestamp: location.time ?? Date.now(),
    provider: 'background',
    raw: location,
  };
}

function createError(message: string, code: string, cause?: unknown): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  if (cause !== undefined) {
    err.cause = cause;
  }
  return err;
}

function isBackgroundPluginAvailable(): boolean {
  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    return false;
  }
  return true;
}

async function ensureAndroidNotificationPermission(): Promise<boolean> {
  console.info('[BackgroundGeolocation] ensureAndroidNotificationPermission start', {
    platform: Capacitor.getPlatform(),
  });
  if (Capacitor.getPlatform() !== 'android') {
    return true;
  }
  if (
    !Capacitor.isPluginAvailable('LocalNotifications') ||
    typeof LocalNotifications?.checkPermissions !== 'function'
  ) {
    console.warn(
      '[BackgroundGeolocation] LocalNotifications plugin unavailable; skipping notification permission request'
    );
    return true;
  }
  try {
    const status: LocalNotificationPermissionStatus = await LocalNotifications.checkPermissions();
    console.info('[BackgroundGeolocation] notification permission status', status);
    if (status.display === 'granted') {
      return true;
    }
    const request: LocalNotificationPermissionStatus =
      await LocalNotifications.requestPermissions();
    console.info('[BackgroundGeolocation] notification permission request outcome', request);
    return request.display === 'granted';
  } catch (err) {
    console.warn('[BackgroundGeolocation] notification permission check failed', err);
    return false;
  }
}

export class BackgroundGeolocationProvider implements LocationProvider {
  private watchId: string | null = null;

  static isSupported(): boolean {
    return isBackgroundPluginAvailable();
  }

  isActive(): boolean {
    return this.watchId !== null;
  }

  async ensurePermissions(): Promise<boolean> {
    if (!BackgroundGeolocationProvider.isSupported()) {
      return false;
    }
    try {
      const geoStatus: GeolocationPermissionStatus = await Geolocation.checkPermissions();
      let granted = isLocationPermissionGranted(geoStatus);
      if (!granted) {
        const req = await Geolocation.requestPermissions();
        granted = isLocationPermissionGranted(req);
      }
      if (!granted) {
        return false;
      }
      const notificationsOkay = await ensureAndroidNotificationPermission();
      return notificationsOkay;
    } catch (err) {
      console.warn('[BackgroundGeolocation] ensurePermissions failed', err);
      return false;
    }
  }

  async getCurrent(opts: Partial<ProviderOptions>): Promise<LocationSample> {
    if (!BackgroundGeolocationProvider.isSupported()) {
      throw createError('Background geolocation plugin unavailable.', 'UNAVAILABLE');
    }
    const ok = await this.ensurePermissions();
    if (!ok) {
      throw createError(
        'Background tracking requires additional permissions.',
        'PERMISSION_DENIED'
      );
    }

    const timeout = Math.max(2000, opts.timeoutMs ?? 5000);
    const watcherOptions: WatcherOptions = {
      backgroundTitle: BACKGROUND_NOTIFICATION_TITLE,
      backgroundMessage: BACKGROUND_NOTIFICATION_MESSAGE,
      requestPermissions: false,
      stale: false,
      distanceFilter: 0,
    };

    return new Promise<LocationSample>((resolve, reject) => {
      let resolved = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let watcherId: string | null = null;

      const cleanup = async () => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = null;
        if (watcherId) {
          try {
            await BackgroundGeolocation.removeWatcher({ id: watcherId });
          } catch (err) {
            console.warn('[BackgroundGeolocation] removeWatcher (snapshot) failed', err);
          }
        }
        watcherId = null;
      };

      BackgroundGeolocation.addWatcher(watcherOptions, async (location, error) => {
        if (resolved) {
          return;
        }
        if (error) {
          resolved = true;
          await cleanup();
          reject(error);
          return;
        }
        if (location) {
          resolved = true;
          const sample = toSample(location);
          await cleanup();
          resolve(sample);
        }
      })
        .then((id) => {
          watcherId = id;
          timer = setTimeout(async () => {
            if (resolved) {
              return;
            }
            resolved = true;
            await cleanup();
            reject(createError('Timed out acquiring background location fix.', 'TIMEOUT'));
          }, timeout);
        })
        .catch(async (err) => {
          if (resolved) {
            return;
          }
          resolved = true;
          console.warn('[BackgroundGeolocation] getCurrent watcher failed', err);
          await cleanup();
          reject(err);
        });
    });
  }

  async start(
    _opts: Required<ProviderOptions>,
    onSample: (s: LocationSample) => void,
    onError: (e: unknown) => void
  ): Promise<void> {
    console.info('[BackgroundGeolocation] start invoked', {
      alreadyWatching: this.watchId != null,
    });
    if (this.watchId) {
      return;
    }

    if (!BackgroundGeolocationProvider.isSupported()) {
      console.warn('[BackgroundGeolocation] start aborted: plugin unsupported');
      onError(createError('Background geolocation plugin unavailable.', 'UNAVAILABLE'));
      return;
    }

    const ok = await this.ensurePermissions();
    console.info('[BackgroundGeolocation] ensurePermissions result', { ok });
    if (!ok) {
      onError(
        createError('Background tracking requires additional permissions.', 'PERMISSION_DENIED')
      );
      return;
    }

    const options: WatcherOptions = {
      backgroundTitle: BACKGROUND_NOTIFICATION_TITLE,
      backgroundMessage: BACKGROUND_NOTIFICATION_MESSAGE,
      requestPermissions: true,
      stale: false,
      distanceFilter: 5,
    };
    console.info('[BackgroundGeolocation] addWatcher requested', options);

    try {
      this.watchId = await BackgroundGeolocation.addWatcher(options, (location, error) => {
        if (error) {
          console.warn('[BackgroundGeolocation] watcher callback error', error);
        }
        if (location) {
          console.debug('[BackgroundGeolocation] location received', {
            lat: location.latitude,
            lon: location.longitude,
            accuracy: location.accuracy,
            time: location.time,
            speed: location.speed,
          });
        }
        if (error) {
          this.handleWatcherError(error, onError);
          return;
        }
        if (!location) {
          return;
        }
        onSample(toSample(location));
      });
      console.info('[BackgroundGeolocation] watcher started', { watchId: this.watchId });
    } catch (err) {
      this.watchId = null;
      console.error('[BackgroundGeolocation] addWatcher failed', err);
      const code =
        (err as any)?.code ??
        (typeof (err as any)?.message === 'string' && (err as any).message.includes('implemented')
          ? 'UNAVAILABLE'
          : undefined);
      if (code === 'UNAVAILABLE') {
        onError(createError('Background geolocation plugin unavailable.', 'UNAVAILABLE', err));
      } else {
        onError(err);
      }
    }
  }

  private handleWatcherError(error: BackgroundError, onError: (e: unknown) => void): void {
    console.warn('[BackgroundGeolocation] handleWatcherError', error);
    if (error?.code === 'NOT_AUTHORIZED') {
      onError(
        createError(
          'Background location permission denied. Enable permissions in Settings to continue.',
          'PERMISSION_DENIED',
          error
        )
      );
      return;
    }
    onError(error);
  }

  async stop(): Promise<void> {
    console.info('[BackgroundGeolocation] stop invoked', { watchId: this.watchId });
    if (!this.watchId) {
      return;
    }
    const id = this.watchId;
    this.watchId = null;
    try {
      await BackgroundGeolocation.removeWatcher({ id });
      console.info('[BackgroundGeolocation] watcher removed', { id });
    } catch {
      console.warn('[BackgroundGeolocation] removeWatcher failed', { id });
    }
  }
}

function isLocationPermissionGranted(status: GeolocationPermissionStatus): boolean {
  return (
    (status as any).location === 'granted' ||
    (status as any).coarseLocation === 'granted' ||
    (status as any).fineLocation === 'granted'
  );
}
