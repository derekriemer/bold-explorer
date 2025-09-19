import { describe, it, expect, beforeEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { useBearingDistance } from '@/composables/useBearingDistance';
import type { LatLng } from '@/types';
import type { Units } from '@/composables/useDistance';

describe('useBearingDistance', () => {
  let gps: Ref<LatLng | null>;
  let target: Ref<LatLng | null>;
  let headingDeg: Ref<number | null>;
  let units: Ref<Units>;
  let mode: Ref<'relative' | 'clock' | 'true'>;

  beforeEach(() => {
    gps = ref<LatLng | null>({ lat: 0, lon: 0 });
    target = ref<LatLng | null>({ lat: 0, lon: 1 });
    headingDeg = ref<number | null>(0);
    units = ref<Units>('metric');
    mode = ref<'relative' | 'clock' | 'true'>('relative');
  });

  it('returns relative bearing text by default when heading is available', () => {
    const { userBearingText } = useBearingDistance({
      gps,
      target,
      headingDeg,
      units,
      bearingDisplayMode: mode,
    });

    expect(userBearingText.value).toBe('E 90°');
  });

  it('switches formats based on bearing display mode', () => {
    const { userBearingText } = useBearingDistance({
      gps,
      target,
      headingDeg,
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
      headingDeg,
      units,
      bearingDisplayMode: mode,
    });

    headingDeg.value = null;
    expect(userBearingText.value).toBe('—');

    mode.value = 'true';
    gps.value = null;
    expect(userBearingText.value).toBe('—');
  });
});
