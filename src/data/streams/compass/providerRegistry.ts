import { BehaviorSubject } from 'rxjs';
import type { CompassProvider } from '@/types/compass';
import type { CompassProviderKind } from '@/types/compass';
import { NativeHeadingProvider } from './providers/nativeHeadingProvider';
import { FakeCompassProvider } from './providers/fakeCompassProvider';

type State = { kind: CompassProviderKind; provider: CompassProvider };

class CompassProviderRegistry
{
  private instances: Partial<Record<CompassProviderKind, CompassProvider>> = {};
  private readonly state$: BehaviorSubject<State>;

  constructor()
  {
    const p = this.instantiate('native');
    this.state$ = new BehaviorSubject<State>({ kind: 'native', provider: p });
  }

  get active$ () { return this.state$.asObservable(); }
  getActiveKind () { return this.state$.getValue().kind; }
  getActiveProvider () { return this.state$.getValue().provider; }

  switchTo (kind: CompassProviderKind)
  {
    const cur = this.state$.getValue();
    if (cur.kind === kind) return cur.provider;
    const p = this.instantiate(kind);
    this.state$.next({ kind, provider: p });
    return p;
  }

  get (kind: CompassProviderKind) { return this.instantiate(kind); }

  private instantiate (kind: CompassProviderKind): CompassProvider
  {
    if (this.instances[kind]) return this.instances[kind]!;
    switch (kind)
    {
      case 'native': this.instances.native = new NativeHeadingProvider(); break;
      case 'mock': this.instances.mock = new FakeCompassProvider(); break;
    }
    return this.instances[kind]!;
  }
}

export const compassProviderRegistry = new CompassProviderRegistry();

