// src/stores/usePrefs.ts
import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';

// ---------- Types ----------
const UNITS_VALUES = ['metric', 'imperial'] as const;
type Units = (typeof UNITS_VALUES)[number];

const COMPASS_VALUES = ['magnetic', 'true'] as const;
type CompassMode = (typeof COMPASS_VALUES)[number];

const BEARING_DISPLAY_VALUES = ['relative', 'clock', 'true'] as const;
export type BearingDisplayMode = (typeof BEARING_DISPLAY_VALUES)[number];


interface Versioned<T> { v: number; value: T; }

// ---------- Validators (strict) ----------
const isLiteral = <T extends readonly string[]> (allowed: T) =>
  (val: unknown): val is T[number] => typeof val === 'string' && (allowed as readonly string[]).includes(val);

const isBoolean = (val: unknown): val is boolean => typeof val === 'boolean';

// ---------- Pref framework ----------
type Migrator<T> = (old: T) => T;

type PrefSpec<T> = {
  key: string;
  currentVersion: number;
  default: T;
  validate: (v: unknown) => v is T;
  // migrations: from version K to K+1 (K is the key)
  migrations?: Record<number, Migrator<T>>;
};

async function readRaw (key: string): Promise<string | null>
{
  const { value } = await Preferences.get({ key });
  return value ?? null;
}

async function writeVersioned<T> (key: string, v: number, value: T)
{
  const payload: Versioned<T> = { v, value };
  await Preferences.set({ key, value: JSON.stringify(payload) });
}

async function getOrInitWithMigrate<T> (spec: PrefSpec<T>): Promise<T>
{
  const raw = await readRaw(spec.key);
  if (raw == null)
  {
    await writeVersioned(spec.key, spec.currentVersion, spec.default);
    return spec.default;
  }

  let parsed: Versioned<unknown> | null = null;

  // Accept legacy plain values: assume v0 and raw may be primitive or JSON string
  try
  {
    const maybeObj = JSON.parse(raw);
    if (maybeObj && typeof maybeObj === 'object' && 'v' in maybeObj && 'value' in maybeObj)
    {
      parsed = maybeObj as Versioned<unknown>;
    } else
    {
      // Legacy JSON without wrapper -> treat as v0
      parsed = { v: 0, value: maybeObj as unknown };
    }
  } catch
  {
    // Not JSON -> legacy primitive string/number/etc at v0
    parsed = { v: 0, value: raw as unknown };
  }

  let version = typeof parsed.v === 'number' ? parsed.v : 0;
  let val: unknown = parsed.value;

  // Migrate stepwise
  const migrations = spec.migrations ?? {};
  while (version < spec.currentVersion)
  {
    const migrate = migrations[version];
    if (!migrate)
    {
      // No path forward: repair to default
      val = spec.default;
      version = spec.currentVersion;
      break;
    }
    try
    {
      val = migrate(val as any); // migrator authors ensure type safety across steps
      version += 1;
    } catch
    {
      // Failed migration -> repair
      val = spec.default;
      version = spec.currentVersion;
      break;
    }
  }

  // Validate final
  if (!spec.validate(val))
  {
    val = spec.default;
  }

  // Persist upgraded/corrected
  await writeVersioned(spec.key, spec.currentVersion, val as T);
  return val as T;
}

async function setPref<T> (spec: PrefSpec<T>, value: T)
{
  await writeVersioned(spec.key, spec.currentVersion, value);
}


// ---------- migration helpers ----------

function booleanMigrator (old: unknown): boolean
{
  if (old === 'true' || old === true) return true;
  if (old === 'false' || old === false) return false;
  return true; // fallback to default
}

// ---------- Pref specs with versions & migrations ----------

// Example history for Units:
// v0: stored as plain string "metric"/"imperial" (unwrapped)
// v1: wrapped { v:1, value: "metric" | "imperial" }  (no transform, just wrap)
const UnitsPref: PrefSpec<Units> = {
  key: 'units',
  currentVersion: 1,
  default: 'imperial',
  validate: isLiteral(UNITS_VALUES),
  migrations: {
    // v0 -> v1 : incoming value may be "metric"/"imperial" or garbage
    0: (old: unknown) => (typeof old === 'string' && isLiteral(UNITS_VALUES)(old) ? old : 'imperial'),
  },
};

const CompassPref: PrefSpec<CompassMode> = {
  key: 'compass_mode',
  currentVersion: 1,
  default: 'magnetic',
  validate: isLiteral(COMPASS_VALUES),
  migrations: {
    0: (old: unknown) => {
      if (typeof old === 'string' && isLiteral(COMPASS_VALUES)(old)) return old;
      if (old === true) return 'true';
      if (old === false) return 'magnetic';
      return 'magnetic';
    },
  },
};

const BearingDisplayPref: PrefSpec<BearingDisplayMode> = {
  key: 'bearing_display_mode',
  currentVersion: 1,
  default: 'relative',
  validate: isLiteral(BEARING_DISPLAY_VALUES),
  migrations: {
    0: (old: unknown) => (typeof old === 'string' && isLiteral(BEARING_DISPLAY_VALUES)(old) ? old : 'relative'),
  },
};

const AudioCuesPref: PrefSpec<boolean> = {
  key: 'audio_cues',
  currentVersion: 1,
  default: true,
  validate: isBoolean,
  migrations: {
    0: booleanMigrator,
  },
};

// ---------- Pinia store ----------
interface PrefsState
{
  units: Units;
  compassMode: CompassMode;
  bearingDisplayMode: BearingDisplayMode;
  audioCuesEnabled: boolean;
  _hydrated: boolean;
}

export const usePrefsStore = defineStore('prefs', {
  state: (): PrefsState => ({
    units: UnitsPref.default,
    compassMode: CompassPref.default,
    bearingDisplayMode: BearingDisplayPref.default,
    audioCuesEnabled: AudioCuesPref.default,
    _hydrated: false,
  }),
  actions: {
    async hydrate ()
    {
      if (this._hydrated) return;

      const [
        loadedUnits,
        loadedCompassMode,
        loadedBearingMode,
        loadedAudioCues,
      ] = await Promise.all([
        getOrInitWithMigrate(UnitsPref),
        getOrInitWithMigrate(CompassPref),
        getOrInitWithMigrate(BearingDisplayPref),
        getOrInitWithMigrate(AudioCuesPref),
      ]);

      this.units = loadedUnits;
      this.compassMode = loadedCompassMode;
      this.bearingDisplayMode = loadedBearingMode;
      this.audioCuesEnabled = loadedAudioCues;
      this._hydrated = true;
    },

    async setUnits (value: Units)
    {
      this.units = value;
      await setPref(UnitsPref, value);
    },

    async setCompassMode (value: CompassMode)
    {
      this.compassMode = value;
      await setPref(CompassPref, value);
    },

    async setBearingDisplayMode (value: BearingDisplayMode)
    {
      this.bearingDisplayMode = value;
      await setPref(BearingDisplayPref, value);
    },

    async setAudioCuesEnabled (value: boolean)
    {
      this.audioCuesEnabled = value;
      await setPref(AudioCuesPref, value);
    },
  },
});
