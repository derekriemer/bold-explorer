import { locationStream } from '@/data/streams/location';
import type { PermissionAlertOptions, UsePermissionAlert } from '@/composables/usePermissionAlert';

type EnsureLocationGrantedOptions = {
  alert?: UsePermissionAlert;
  message?: PermissionAlertOptions;
};

const DEFAULT_LOCATION_ALERT: PermissionAlertOptions = {
  header: 'Location Permission Required',
  message: 'Enable location access in system settings to unlock GPS tracking and compass guidance.',
};

/** Ensure the active location provider permissions are granted. */
export async function ensureLocationGranted(opts?: EnsureLocationGrantedOptions): Promise<boolean> {
  const ok = await locationStream.ensureProviderPermissions();
  if (!ok && opts?.alert) {
    opts.alert.show(opts.message ?? DEFAULT_LOCATION_ALERT);
  }
  return ok;
}

/** Placeholder for compass permission (platform-dependent). Returns true for now. */
export async function ensureCompassGranted(): Promise<boolean> {
  // Some platforms may not expose a specific permission for heading; handled by plugin.
  return true;
}
