import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// In-memory mock for Capacitor Preferences
const kv: Record<string, string | null> = {};
vi.mock('@capacitor/preferences', () => {
  return {
    Preferences: {
      async get({ key }: { key: string }): Promise<{ value: string | null }> {
        return {
          value: Object.prototype.hasOwnProperty.call(kv, key) ? (kv[key] as string | null) : null,
        };
      },
      async set({ key, value }: { key: string; value: string }): Promise<void> {
        kv[key] = value;
      },
      async remove({ key }: { key: string }): Promise<void> {
        delete kv[key];
      },
      async clear(): Promise<void> {
        for (const k of Object.keys(kv)) {
          delete kv[k];
        }
      },
    },
  };
});

// Import store after mocking
import { usePrefsStore } from '@/stores/usePrefs';

function raw(key: string): string | null {
  return Object.prototype.hasOwnProperty.call(kv, key) ? (kv[key] as string | null) : null;
}

describe('usePrefsStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    // Clear mock storage before each test
    for (const k of Object.keys(kv)) {
      delete kv[k];
    }
  });

  afterEach(async () => {
    // Ensure storage isolation between tests
    for (const k of Object.keys(kv)) {
      delete kv[k];
    }
  });

  it('hydrates with defaults and persists versioned payloads when empty', async () => {
    const store = usePrefsStore();
    await store.hydrate();

    expect(store.units).toBe('imperial');
    expect(store.compassMode).toBe('magnetic');
    expect(store.bearingDisplayMode).toBe('relative');
    expect(store.audioCuesEnabled).toBe(true);

    const unitsRaw = raw('units');
    const compassRaw = raw('compass_mode');
    const bearingRaw = raw('bearing_display_mode');
    const audioRaw = raw('audio_cues');
    expect(unitsRaw).toBeTruthy();
    expect(compassRaw).toBeTruthy();
    expect(bearingRaw).toBeTruthy();
    expect(audioRaw).toBeTruthy();

    const unitsObj = JSON.parse(unitsRaw!);
    const compassObj = JSON.parse(compassRaw!);
    const bearingObj = JSON.parse(bearingRaw!);
    const audioObj = JSON.parse(audioRaw!);

    expect(unitsObj).toEqual({ v: 1, value: 'imperial' });
    expect(compassObj).toEqual({ v: 1, value: 'magnetic' });
    expect(bearingObj).toEqual({ v: 1, value: 'relative' });
    expect(audioObj).toEqual({ v: 1, value: true });
  });

  it('migrates legacy v0 plain values (valid) to current versions', async () => {
    // Pre-populate legacy plain strings
    kv['units'] = 'metric'; // valid legacy
    kv['compass_mode'] = 'true'; // valid legacy
    kv['bearing_display_mode'] = 'clock'; // valid legacy
    kv['audio_cues'] = 'false'; // valid legacy (string)

    const store = usePrefsStore();
    await store.hydrate();

    expect(store.units).toBe('metric');
    expect(store.compassMode).toBe('true');
    expect(store.bearingDisplayMode).toBe('clock');
    expect(store.audioCuesEnabled).toBe(false);

    const unitsObj = JSON.parse(raw('units')!);
    const compassObj = JSON.parse(raw('compass_mode')!);
    const bearingObj = JSON.parse(raw('bearing_display_mode')!);
    const audioObj = JSON.parse(raw('audio_cues')!);
    expect(unitsObj.v).toBe(1);
    expect(compassObj.v).toBe(1);
    expect(bearingObj.v).toBe(1);
    expect(audioObj.v).toBe(1);
  });

  it('repairs invalid legacy values to defaults during migration', async () => {
    // Invalid entries
    kv['units'] = 'foo';
    kv['compass_mode'] = 'nope';
    kv['bearing_display_mode'] = '??';
    kv['audio_cues'] = 'maybe';

    const store = usePrefsStore();
    await store.hydrate();

    expect(store.units).toBe('imperial');
    expect(store.compassMode).toBe('magnetic');
    expect(store.bearingDisplayMode).toBe('relative');
    expect(store.audioCuesEnabled).toBe(true);
  });

  it('reacts to updates via actions and persists', async () => {
    const store = usePrefsStore();
    await store.hydrate();

    await store.setUnits('metric');
    expect(store.units).toBe('metric');
    expect(JSON.parse(raw('units')!)).toEqual({ v: 1, value: 'metric' });

    await store.setCompassMode('true');
    expect(store.compassMode).toBe('true');
    expect(JSON.parse(raw('compass_mode')!)).toEqual({ v: 1, value: 'true' });

    await store.setBearingDisplayMode('clock');
    expect(store.bearingDisplayMode).toBe('clock');
    expect(JSON.parse(raw('bearing_display_mode')!)).toEqual({ v: 1, value: 'clock' });

    await store.setAudioCuesEnabled(false);
    expect(store.audioCuesEnabled).toBe(false);
    expect(JSON.parse(raw('audio_cues')!)).toEqual({ v: 1, value: false });
  });

  it('hydrate is idempotent and does not override current state once hydrated', async () => {
    const store = usePrefsStore();
    await store.hydrate();
    await store.setUnits('metric');
    await store.setBearingDisplayMode('clock');
    // Place conflicting raw to ensure hydrate() early exits when already hydrated
    kv['units'] = 'imperial';
    kv['bearing_display_mode'] = 'true';
    await store.hydrate();
    expect(store.units).toBe('metric');
    expect(store.bearingDisplayMode).toBe('clock');
  });
});
