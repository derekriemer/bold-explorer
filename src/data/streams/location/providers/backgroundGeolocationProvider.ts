import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
  Location as BackgroundLocation,
  CallbackError as BackgroundError,
  WatcherOptions,
} from '@capacitor-community/background-geolocation';
import type { LocationProvider, LocationSample, ProviderOptions } from '@/types';
import { LocalNotifications, type PermissionStatus as LocalNotificationPermissionStatus } from '@capacitor/local-notifications';

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

async function ensureAndroidNotificationPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true;
  if (!Capacitor.isPluginAvailable('LocalNotifications')) return false;
  try {
    const status: LocalNotificationPermissionStatus = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;
    const request: LocalNotificationPermissionStatus = await LocalNotifications.requestPermissions();
    return request.display === 'granted';
  } catch (err) {
    console.warn('[BackgroundGeolocation] notification permission check failed', err);
    return false;
  }
}

export class BackgroundGeolocationProvider implements LocationProvider {
  private watchId: string | null = null;

  isActive(): boolean {
    return this.watchId !== null;
  }

  async start(
    _opts: Required<ProviderOptions>,
    onSample: (s: LocationSample) => void,
    onError: (e: unknown) => void,
  ): Promise<void> {
    if (this.watchId) return;

    if (!Capacitor.isNativePlatform()) {
      onError(new Error('Background geolocation is only available on native platforms.'));
      return;
    }

    if (!Capacitor.isPluginAvailable('BackgroundGeolocation')) {
      onError(new Error('Background geolocation plugin unavailable.'));
      return;
    }

    const notificationsOkay = await ensureAndroidNotificationPermission();
    if (!notificationsOkay) {
      onError(new Error('Background tracking requires notification permission.'));
      return;
    }

    const options: WatcherOptions = {
      backgroundTitle: BACKGROUND_NOTIFICATION_TITLE,
      backgroundMessage: BACKGROUND_NOTIFICATION_MESSAGE,
      requestPermissions: true,
      stale: false,
      distanceFilter: 10,
    };

    try {
      this.watchId = await BackgroundGeolocation.addWatcher(options, (location, error) => {
        if (error) {
          this.handleWatcherError(error, onError);
          return;
        }
        if (!location) return;
        onSample(toSample(location));
      });
    } catch (err) {
      this.watchId = null;
      onError(err);
    }
  }

  private handleWatcherError(error: BackgroundError, onError: (e: unknown) => void): void {
    if (error?.code === 'NOT_AUTHORIZED') {
      onError(new Error('Background location permission denied. Enable permissions in Settings to continue.'));
      return;
    }
    onError(error);
  }

  async stop(): Promise<void> {
    if (!this.watchId) return;
    const id = this.watchId;
    this.watchId = null;
    try {
      await BackgroundGeolocation.removeWatcher({ id });
    } catch {
      // ignore
    }
  }
}
