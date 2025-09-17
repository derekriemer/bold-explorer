import { defineStore } from 'pinia';
import { onUnmounted } from 'vue';
import { locationStream } from '@/data/streams/location';
import type { LocationSample, WatchOptions } from '@/types';
import type { Subscription } from 'rxjs';

let sub: Subscription | null = null;

export const useLocation = defineStore('location', {
  state: () => ({
    current: null as LocationSample | null,
    watching: false as boolean
  }),

  actions: {
    async start (opts?: WatchOptions)
    {
      if (this.watching) return;
      if (opts) locationStream.configureWatch(opts);

      await locationStream.start(); // idempotent
      // Subscribe to stream updates and reflect into store state
      sub = locationStream.updates.subscribe((s) => { this.current = s; });
      this.watching = true;

      // If invoked from a component setup, auto-detach the subscription on unmount
      try { onUnmounted(() => { this.detach(); }); } catch {}
    },

    /** Detach from the stream (unsubscribe) but do not stop the global provider. */
    detach ()
    {
      try { sub?.unsubscribe(); } catch {}
      sub = null;
      this.watching = false;
    },

    /** Stop the global stream and detach local subscription. */
    async stop ()
    {
      this.detach();
      await locationStream.stop();
    },

    /** Convenience: return compass bearing (deg) if provided by samples. */
    getCompassBearing (): number | null
    {
      const h = this.current?.heading;
      return typeof h === 'number' ? h : null;
    }
  }
});

