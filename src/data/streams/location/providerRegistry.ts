import type { LocationProvider, ProviderKind } from '@/types';
import { GeolocationProvider, FakeableProvider, ReplayProvider, type ReplayPoint } from './providers';
import { BehaviorSubject } from 'rxjs';

type ProviderState = { kind: ProviderKind; provider: LocationProvider };

class ProviderRegistry
{
  private instances: Partial<Record<ProviderKind, LocationProvider>> = {};
  private replayPoints: ReplayPoint[] = [];

  private readonly state$: BehaviorSubject<ProviderState>;

  constructor()
  {
    const initialProvider = this.instantiate('geolocation');
    this.state$ = new BehaviorSubject<ProviderState>({ kind: 'geolocation', provider: initialProvider });
  }

  /** Observable stream of the active provider state. */
  get active$ () { return this.state$.asObservable(); }

  /** Get the current active kind. */
  getActiveKind (): ProviderKind { return this.state$.getValue().kind; }

  /** Get the current active provider instance. */
  getActiveProvider (): LocationProvider { return this.state$.getValue().provider; }

  /** Return current state (kind + provider). */
  getActive (): ProviderState { return this.state$.getValue(); }

  /** Provide points used when constructing a replay provider. */
  setReplayPoints (points: ReplayPoint[])
  {
    this.replayPoints = points.slice();
    // Rebuild replay provider so future switches get fresh data
    if (this.instances.replay)
    {
      delete this.instances.replay;
      // If currently active kind is replay, immediately swap to a fresh instance
      if (this.getActiveKind() === 'replay')
      {
        const fresh = this.instantiate('replay');
        this.state$.next({ kind: 'replay', provider: fresh });
      }
    }
  }

  /** Get or construct a provider instance for a kind (does not switch active). */
  get (kind: ProviderKind): LocationProvider
  {
    return this.instantiate(kind);
  }

  /** Switch the active provider kind and emit via Rx. */
  switchTo (kind: ProviderKind): LocationProvider
  {
    const cur = this.state$.getValue();
    if (cur.kind === kind) return cur.provider;
    const p = this.instantiate(kind);
    this.state$.next({ kind, provider: p });
    return p;
  }

  private instantiate (kind: ProviderKind): LocationProvider
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
}

export const providerRegistry = new ProviderRegistry();
