import type { HeadingReading } from '@/plugins/heading';

export type CompassProviderKind = 'native' | 'mock';

export interface CompassProvider {
  start(onReading: (r: HeadingReading) => void, onError: (e: unknown) => void): Promise<void>;

  stop(): Promise<void>;
  isActive(): boolean;

  /** Switch between magnetic and true north without restarting. */
  setTrueNorth(useTrue: boolean): Promise<void>;
  /** Optional: provide location for declination (true north). */
  setLocation?(coords: { lat: number; lon: number; alt?: number }): Promise<void>;
}

export type { HeadingReading };
