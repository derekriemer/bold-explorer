import type { LocationProvider, ProviderKind } from '@/types';
import { GeolocationProvider, FakeableProvider, ReplayProvider, type ReplayPoint } from './providers';

type Listener = (provider: LocationProvider, kind: ProviderKind) => void;

class ProviderRegistry
{
  private instances: Partial<Record<ProviderKind, LocationProvider>> = {};
  private activeKind: ProviderKind = 'geolocation';
  private listeners: Set<Listener> = new Set();
  private replayPoints: ReplayPoint[] = [];

  /** Provide points used when constructing a replay provider. */
  setReplayPoints (points: ReplayPoint[])
  {
    this.replayPoints = points.slice();
    // If a replay provider already exists, rebuild it to reflect new points if active in future
    if (this.instances.replay)
    {
      delete this.instances.replay;
    }
  }

  /** Get the current active kind. */
  getActiveKind (): ProviderKind { return this.activeKind; }

  /** Get or construct a provider instance for a kind. */
  get (kind: ProviderKind): LocationProvider
  {
    if (this.instances[kind]) return this.instances[kind]!;
    switch (kind)
    {
      case 'geolocation': this.instances[kind] = new GeolocationProvider(); break;
      case 'mock': this.instances[kind] = new FakeableProvider(); break;
      case 'replay': this.instances[kind] = new ReplayProvider(this.replayPoints); break;
      case 'background': this.instances[kind] = new GeolocationProvider(); break; // placeholder
    }
    return this.instances[kind]!;
  }

  /** Switch the active provider kind. Notifies listeners. */
  switchTo (kind: ProviderKind): LocationProvider
  {
    if (this.activeKind === kind) return this.get(kind);
    this.activeKind = kind;
    const p = this.get(kind);
    for (const l of this.listeners) l(p, kind);
    return p;
  }

  /** Subscribe to provider change events (kind + instance). */
  onChange (fn: Listener): () => void
  {
    this.listeners.add(fn);
    // Emit current immediately to hydrate subscribers
    try { fn(this.get(this.activeKind), this.activeKind); } catch {}
    return () => { this.listeners.delete(fn); };
  }
}

export const providerRegistry = new ProviderRegistry();
