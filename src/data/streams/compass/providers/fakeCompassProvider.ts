import type { CompassProvider } from '@/types/compass';
import type { HeadingReading } from '@/plugins/heading';

export class FakeCompassProvider implements CompassProvider {
  private active = false;
  private onReading: ((r: HeadingReading) => void) | null = null;
  private onError: ((e: unknown) => void) | null = null;
  private useTrue = true;

  isActive(): boolean {
    return this.active;
  }

  async start(
    onReading: (r: HeadingReading) => void,
    onError: (e: unknown) => void
  ): Promise<void> {
    this.onReading = onReading;
    this.onError = onError;
    this.active = true;
  }

  async stop(): Promise<void> {
    this.active = false;
    this.onReading = null;
    this.onError = null;
  }

  async setTrueNorth(useTrue: boolean): Promise<void> {
    this.useTrue = !!useTrue;
  }

  async setLocation(): Promise<void> {
    // ignore for fake
  }

  /** Test helper to push a reading into the stream. */
  emit(r: HeadingReading) {
    if (!this.active) {
      return;
    }
    const ev = { ...r };
    if (!this.useTrue) {
      delete (ev as any).true;
    } // simulate magnetic only
    this.onReading?.(ev);
  }
}
