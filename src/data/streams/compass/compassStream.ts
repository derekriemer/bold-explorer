import { BehaviorSubject, Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Heading, type HeadingReading } from '@/plugins/heading';

class CompassStream
{
  private subject = new BehaviorSubject<HeadingReading | null>(null);
  public readonly updates: Observable<HeadingReading> = this.subject.asObservable().pipe(
    // simple type guard
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (src) => new Observable((subscriber) => src.subscribe((v) => { if (v) subscriber.next(v); }))
  );

  private removeListener: (() => void) | null = null;
  private active = false;

  isActive (): boolean { return this.active; }

  async start (opts?: { useTrueNorth?: boolean }): Promise<void>
  {
    if (this.active) return;
    if (Capacitor.getPlatform() === 'web')
    {
      this.active = true; // no-op on web; could synthesize if desired
      return;
    }
    const sub = await Heading.addListener('heading', (r) => { this.subject.next(r); });
    await Heading.start({ useTrueNorth: opts?.useTrueNorth ?? true });
    this.removeListener = () => { sub.remove(); void Heading.stop(); };
    this.active = true;
  }

  async stop (): Promise<void>
  {
    if (!this.active) return;
    try { this.removeListener?.(); } catch {}
    this.removeListener = null;
    this.active = false;
  }

  /** Provide location info to plugin for computing true north (declination). */
  async setLocation (coords: { lat: number; lon: number; alt?: number }): Promise<void>
  {
    try { await Heading.setLocation?.(coords); } catch {}
  }
}

export const compassStream = new CompassStream();
export type { HeadingReading };

