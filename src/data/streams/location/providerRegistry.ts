import type { LocationProvider, ProviderKind } from '@/types';
import { GeolocationProvider, FakeableProvider, ReplayProvider, BackgroundGeolocationProvider, type ReplayPoint } from './providers';
import { BehaviorSubject } from 'rxjs';

type ProviderState = { kind: ProviderKind; provider: LocationProvider };

class ProviderRegistry
{
  private instances: Partial<Record<ProviderKind, LocationProvider>> = {};
  private replayPoints: ReplayPoint[] = [];

  private readonly state$: BehaviorSubject<ProviderState>;

  constructor()
  {
    const initialKind = this.resolvePreferredKind();
    const initialProvider = this.instantiate(initialKind);
    this.state$ = new BehaviorSubject<ProviderState>({ kind: initialKind, provider: initialProvider });
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
    const resolved = this.resolvePreferredKind(kind, { explicit: false });
    return this.instantiate(resolved);
  }

  /** Switch the active provider kind and emit via Rx. */
  switchTo (kind: ProviderKind): LocationProvider
  {
    const resolved = this.resolvePreferredKind(kind, { explicit: true });
    const cur = this.state$.getValue();
    if (cur.kind === resolved) return cur.provider;
    const p = this.instantiate(resolved);
    this.state$.next({ kind: resolved, provider: p });
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
      case 'background': this.instances[kind] = new BackgroundGeolocationProvider(); break;
    }
    return this.instances[kind]!;
  }

  private resolvePreferredKind (requested?: ProviderKind, opts: { explicit: boolean } = { explicit: false }): ProviderKind
  {
    if (!requested)
    {
      if (BackgroundGeolocationProvider.isSupported()) return 'background';
      console.info('[providerRegistry] background provider unsupported; defaulting to geolocation');
      return 'geolocation';
    }

    if (requested === 'background' && !BackgroundGeolocationProvider.isSupported() && !opts.explicit)
    {
      console.info('[providerRegistry] background provider unsupported; keeping geolocation active');
      return 'geolocation';
    }

    return requested;
  }
}

export const providerRegistry = new ProviderRegistry();
