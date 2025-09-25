import { locationStream } from '@/data/streams/location';

/** Ensure the active location provider permissions are granted. */
export async function ensureLocationGranted (): Promise<boolean>
{
  return await locationStream.ensureProviderPermissions();
}

/** Placeholder for compass permission (platform-dependent). Returns true for now. */
export async function ensureCompassGranted (): Promise<boolean>
{
  // Some platforms may not expose a specific permission for heading; handled by plugin.
  return true;
}
