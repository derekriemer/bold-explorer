import { Subscription } from 'rxjs';

import { locationStream } from '@/data/streams/location';
import type { LocationSample } from '@/types';

const BASE_FREQ_HZ = 220;
const MAX_STEPS = 36;
const MAX_ACCURACY_METERS = 30;
const DEFAULT_DURATION_SEC = 0.15;

class LocationDebugService
{
  private subscription: Subscription | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private liveRegion: HTMLDivElement | null = null;
  private unlockTeardown: Array<() => void> | null = null;

  start (): void
  {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this.subscription) return;

    this.ensureAudio();
    this.ensureLiveRegion();

    this.subscription = locationStream.updates.subscribe((sample) =>
    {
      this.handleSample(sample);
    });
  }

  stop (): void
  {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private handleSample (sample: LocationSample): void
  {
    const frequency = this.computeFrequency(sample.accuracy);
    this.beep(frequency);
    this.announceAccuracy(sample.accuracy);
  }

  private computeFrequency (accuracy?: number): number
  {
    // Normalize accuracy (meters) into semitone steps between 0 and MAX_STEPS.
    const raw = typeof accuracy === 'number' && !Number.isNaN(accuracy)
      ? accuracy
      : MAX_ACCURACY_METERS;
    const clamped = Math.min(Math.max(raw, 0), MAX_ACCURACY_METERS);
    const steps = Math.min(
      MAX_STEPS,
      Math.round((clamped / MAX_ACCURACY_METERS) * MAX_STEPS)
    );

    return BASE_FREQ_HZ * Math.pow(2, steps / 12);
  }

  private ensureAudio (): void
  {
    if (this.audioContext) return;
    const contextCtor: (typeof AudioContext) | undefined =
      (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!contextCtor) return;

    const ctx = new contextCtor();
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    gain.connect(ctx.destination);

    this.audioContext = ctx;
    this.masterGain = gain;
    if (ctx.state !== 'running')
    {
      this.installUnlockHandlers();
    }
  }

  private installUnlockHandlers (): void
  {
    if (typeof window === 'undefined') return;
    if (this.unlockTeardown) return;

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown'];
    const disposers: Array<() => void> = [];
    const attemptResume = () => { void this.resumeAudioContext(); };

    for (const eventName of events)
    {
      const handler = () => { attemptResume(); };
      window.addEventListener(eventName, handler, { once: true, passive: true });
      disposers.push(() => { window.removeEventListener(eventName, handler); });
    }

    this.unlockTeardown = disposers;
  }

  private clearUnlockHandlers (): void
  {
    if (!this.unlockTeardown) return;
    for (const dispose of this.unlockTeardown)
    {
      try { dispose(); } catch { /* noop */ }
    }
    this.unlockTeardown = null;
  }

  private async resumeAudioContext (): Promise<void>
  {
    const ctx = this.audioContext;
    if (!ctx) return;

    const initialState = ctx.state;
    if (initialState === 'running')
    {
      this.clearUnlockHandlers();
      return;
    }

    try
    {
      await ctx.resume();
      const resumedState = ctx.state;
      if (resumedState === 'running')
      {
        this.clearUnlockHandlers();
      } else
      {
        this.installUnlockHandlers();
      }
    } catch
    {
      this.installUnlockHandlers();
    }
  }

  private ensureLiveRegion (): void
  {
    if (!document) return;
    if (this.liveRegion) return;

    const existing = document.getElementById('TEMP_DEBUG');
    if (existing instanceof HTMLDivElement)
    {
      this.liveRegion = existing;
      return;
    }

    const div = document.createElement('div');
    div.id = 'TEMP_DEBUG';
    div.setAttribute('aria-live', 'assertive');
    div.setAttribute('role', 'status');
    // Hide visually but keep available to assistive tech.
    div.style.position = 'absolute';
    div.style.width = '1px';
    div.style.height = '1px';
    div.style.margin = '-1px';
    div.style.border = '0';
    div.style.padding = '0';
    div.style.clip = 'rect(0 0 0 0)';
    div.style.overflow = 'hidden';

    document.body.appendChild(div);
    this.liveRegion = div;
  }

  private beep (frequency: number): void
  {
    if (!this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const duration = DEFAULT_DURATION_SEC;

    if (ctx.state !== 'running')
    {
      void this.resumeAudioContext();
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    osc.onended = () =>
    {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private announceAccuracy (accuracy?: number): void
  {
    if (!this.liveRegion) return;
    if (accuracy == null || Number.isNaN(accuracy))
    {
      this.liveRegion.textContent = 'Accuracy unavailable';
      return;
    }

    const rounded = accuracy < 10 ? accuracy.toFixed(1) : accuracy.toFixed(0);
    this.liveRegion.textContent = `Accuracy ${ rounded } meters`;
  }
}

export const locationDebugService = new LocationDebugService();

if (typeof window !== 'undefined')
{
  locationDebugService.start();
}
  
