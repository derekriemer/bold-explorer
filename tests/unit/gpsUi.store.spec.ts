import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useGpsUiStore } from '@/stores/useGpsUi';

describe('useGpsUiStore - alignment lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('begins alignment with normalized bearing and tracks history', () => {
    const store = useGpsUiStore();
    store.beginAlignment(725.4);
    expect(store.alignmentActive).toBe(true);
    expect(store.alignmentBearingDeg).toBeCloseTo(5.4, 5);
    expect(store.alignmentLastBearingDeg).toBeCloseTo(5.4, 5);
  });

  it('falls back to last bearing when opening without seed', () => {
    const store = useGpsUiStore();
    store.beginAlignment(90);
    store.endAlignment();
    expect(store.alignmentActive).toBe(false);
    expect(store.alignmentBearingDeg).toBeNull();
    expect(store.alignmentLastBearingDeg).toBe(90);

    store.beginAlignment(null);
    expect(store.alignmentActive).toBe(true);
    expect(store.alignmentBearingDeg).toBe(90);
  });

  it('updates alignment bearing and preserves last value', () => {
    const store = useGpsUiStore();
    store.beginAlignment(10);
    store.setAlignmentBearing(-45);
    expect(store.alignmentBearingDeg).toBe(315);
    expect(store.alignmentLastBearingDeg).toBe(315);
  });

  it('clears current bearing but keeps history on endAlignment', () => {
    const store = useGpsUiStore();
    store.beginAlignment(45);
    store.endAlignment();
    expect(store.alignmentActive).toBe(false);
    expect(store.alignmentBearingDeg).toBeNull();
    expect(store.alignmentLastBearingDeg).toBe(45);
  });

  it('reset clears all alignment state', () => {
    const store = useGpsUiStore();
    store.beginAlignment(180);
    store.reset();
    expect(store.alignmentActive).toBe(false);
    expect(store.alignmentBearingDeg).toBeNull();
    expect(store.alignmentLastBearingDeg).toBeNull();
  });
});
