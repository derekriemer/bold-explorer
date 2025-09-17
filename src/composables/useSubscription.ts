import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';
import type { Observable } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

/**
 * Subscribe to an Observable and expose a Vue ref that updates with its values.
 * Automatically subscribes on mounted and unsubscribes on unmount.
 */
export function useSubscription<T> (
  source$: Observable<T>,
  opts?: { initial?: T; throttleMs?: number }
)
{
  const value = ref<T | null>((opts?.initial as any) ?? null);
  let sub: import('rxjs').Subscription | null = null;

  function subscribe ()
  {
    try { sub?.unsubscribe(); } catch {}
    const stream = opts?.throttleMs ? source$.pipe(throttleTime(opts.throttleMs)) : source$;
    sub = stream.subscribe((v) => { (value as Ref<T | null>).value = v; });
  }

  function unsubscribe () { try { sub?.unsubscribe(); } catch {}; sub = null; }

  onMounted(() => { subscribe(); });
  onBeforeUnmount(() => { unsubscribe(); });

  return { value, subscribe, unsubscribe } as const;
}

