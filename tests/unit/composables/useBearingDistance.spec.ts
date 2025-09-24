import { describe, it, expect, beforeEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { useBearingDistance } from '@/composables/useBearingDistance';
import type { LatLng, LocationSample } from '@/types';
import type { Units } from '@/composables/useDistance';

describe('useBearingDistance', () => {
  let gps: Ref<Pick<LocationSample, 'lat' | 'lon' | 'heading'> | null>;
  let target: Ref<LatLng | null>;
  let units: Ref<Units>;
  let mode: Ref<'relative' | 'clock' | 'true'>;

  beforeEach(() => {
    gps = ref({ lat: 0, lon: 0, heading: 0 });
    target = ref<LatLng | null>({ lat: 0, lon: 1 });
    units = ref<Units>('metric');
    mode = ref<'relative' | 'clock' | 'true'>('relative');
  });

  it('returns relative bearing text by default when heading is available', () => {
    const { userBearingText } = useBearingDistance({
      gps,
      target,
      units,
      bearingDisplayMode: mode,
    });

    expect(userBearingText.value).toBe('90° right');
  });

  it('describes bearings behind the user when the delta is large', () => {
    target.value = { lat: -1, lon: 0 } as unknown as LatLng;

    const { userBearingText } = useBearingDistance({
      gps,
      target,
      units,
      bearingDisplayMode: mode,
    });

    expect(userBearingText.value).toBe('180° left behind you');
  });

  it('switches formats based on bearing display mode', () => {
    const { userBearingText } = useBearingDistance({
      gps,
      target,
      units,
      bearingDisplayMode: mode,
    });

    mode.value = 'clock';
    expect(userBearingText.value).toBe("3 o'clock");

    mode.value = 'true';
    expect(userBearingText.value).toBe('E 90° true');
  });

  it('falls back to placeholder when required inputs are missing', () => {
    const { userBearingText } = useBearingDistance({
      gps,
      target,
      units,
      bearingDisplayMode: mode,
    });

    gps.value = gps.value ? { ...gps.value, heading: null } : null;
    expect(userBearingText.value).toBe('—');

    mode.value = 'true';
    gps.value = null;
    expect(userBearingText.value).toBe('—');
  });
});
