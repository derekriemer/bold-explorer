import { BehaviorSubject, Observable } from 'rxjs';
import type { HeadingReading } from '@/plugins/heading';
import type { CompassProvider } from '@/types/compass';
import { compassProviderRegistry } from './providerRegistry';

class CompassStream
{
  private subject = new BehaviorSubject<HeadingReading | null>(null);
  public readonly updates: Observable<HeadingReading> = this.subject.asObservable().pipe(
    // simple type guard
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (src) => new Observable((subscriber) => src.subscribe((v) => { if (v) subscriber.next(v); }))
  );

  private active = false;
  private lastUseTrue = true;

  isActive (): boolean { return this.active; }

  async start (opts?: { useTrueNorth?: boolean }): Promise<void>
  {
    if (this.active) return;
    const provider = compassProviderRegistry.getActiveProvider();
    await provider.start(
      (r: HeadingReading) => { this.subject.next(r); },
      (e: unknown) => { /* surface via logs later */ console.warn('[compass] provider error', e); }
    );
    this.active = true;
    this.lastUseTrue = opts?.useTrueNorth ?? true;
    await provider.setTrueNorth(this.lastUseTrue);
    // If provider switches while active, rewire without changing outward state
    compassProviderRegistry.active$.subscribe(async ({ provider: p }: { provider: CompassProvider }) =>
    {
      if (!this.active) return;
      try
      {
        await p.start(
          (r: HeadingReading) => { this.subject.next(r); },
          (e: unknown) => console.warn('[compass] provider error', e)
        );
        await p.setTrueNorth(this.lastUseTrue);
      }
      catch (e) { console.warn('[compass] swap failed', e); }
    });
  }

  async stop (): Promise<void>
  {
    if (!this.active) return;
    try { await compassProviderRegistry.getActiveProvider().stop(); } catch {}
    this.active = false;
  }

  /** Provide location info to plugin for computing true north (declination). */
  async setLocation (coords: { lat: number; lon: number; alt?: number }): Promise<void>
  {
    try { await compassProviderRegistry.getActiveProvider().setLocation?.(coords); } catch {}
  }

  /** Toggle true north without restarting. */
  async setTrueNorth (useTrue: boolean): Promise<void>
  {
    this.lastUseTrue = !!useTrue;
    try { await compassProviderRegistry.getActiveProvider().setTrueNorth(this.lastUseTrue); } catch {}
  }
}

export const compassStream = new CompassStream();
export type { HeadingReading };
