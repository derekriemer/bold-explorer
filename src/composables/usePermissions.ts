import { Geolocation } from '@capacitor/geolocation';

/** Ensure Capacitor geolocation permissions are granted. */
export async function ensureLocationGranted (): Promise<boolean>
{
  try
  {
    const status = await Geolocation.checkPermissions();
    const granted = (status as any).location === 'granted' || (status as any).coarseLocation === 'granted' || (status as any).fineLocation === 'granted';
    if (granted) return true;
    const req = await Geolocation.requestPermissions();
    return (req as any).location === 'granted' || (req as any).coarseLocation === 'granted' || (req as any).fineLocation === 'granted';
  } catch { return true; }
}

/** Placeholder for compass permission (platform-dependent). Returns true for now. */
export async function ensureCompassGranted (): Promise<boolean>
{
  // Some platforms may not expose a specific permission for heading; handled by plugin.
  return true;
}

