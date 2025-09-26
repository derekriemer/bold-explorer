import { Heading, type HeadingReading } from '@/plugins/heading';
import type { CompassProvider } from '@/types/compass';
import { Capacitor } from '@capacitor/core';

export class NativeHeadingProvider implements CompassProvider {
  private remove: (() => void) | null = null;
  private active = false;
  private useTrue = true;
  private onReading: ((r: HeadingReading) => void) | null = null;
  private onError: ((e: unknown) => void) | null = null;

  isActive(): boolean {
    return this.active;
  }

  async start(
    onReading: (r: HeadingReading) => void,
    onError: (e: unknown) => void
  ): Promise<void> {
    if (this.active) {
      return;
    }
    this.onReading = onReading;
    this.onError = onError;
    if (Capacitor.getPlatform() === 'web') {
      this.active = true; // no-op
      return;
    }
    const sub = await Heading.addListener('heading', (r) => {
      this.onReading?.(r);
    });
    await Heading.start({ useTrueNorth: this.useTrue });
    this.remove = () => {
      sub.remove();
      void Heading.stop();
    };
    this.active = true;
  }

  async stop(): Promise<void> {
    if (!this.active) {
      return;
    }
    try {
      this.remove?.();
    } catch (e) {
      this.onError?.(e);
    }
    this.remove = null;
    this.active = false;
  }

  async setTrueNorth(useTrue: boolean): Promise<void> {
    this.useTrue = !!useTrue;
    if (!this.active) {
      return;
    } // apply next start
    try {
      await Heading.start({ useTrueNorth: this.useTrue });
    } catch (e) {
      this.onError?.(e);
    }
  }

  async setLocation(coords: { lat: number; lon: number; alt?: number }): Promise<void> {
    try {
      await Heading.setLocation?.(coords);
    } catch (e) {
      this.onError?.(e);
    }
  }
}
