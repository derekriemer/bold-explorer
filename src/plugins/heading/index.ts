// src/plugins/heading/index.ts
import { registerPlugin } from '@capacitor/core';

export interface HeadingReading {
  magnetic: number; // 0..360, 0=N
  true?: number;    // if declination applied
  accuracy?: number; // iOS headingAccuracy (deg) or Android azimuth stddev
}

export interface HeadingPlugin {
  start(options?: { useTrueNorth?: boolean }): Promise<void>;
  stop(): Promise<void>;
  setLocation?(coords: { lat: number; lon: number; alt?: number }): Promise<void>;
  addListener(
    eventName: 'heading',
    listener: (r: HeadingReading) => void
  ): Promise<{ remove: () => void }>;
}

export const Heading = registerPlugin<HeadingPlugin>('Heading');
