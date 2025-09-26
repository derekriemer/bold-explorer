import { computed, type Ref } from 'vue';
import { initialBearingDeg, haversineDistanceMeters } from '@/utils/geo';
import { formatDistance, type Units } from './useDistance';
import { toLatLng, type LatLng, type LocationSample } from '@/types';
import type { BearingDisplayMode } from '@/stores/usePrefs';

/** Map an absolute bearing (0..360) to a cardinal text. */
function toCardinal(deg: number): string {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return dirs[idx];
}

/** Map a relative bearing (−180..180) to a clock position label (12,1,…,11 o'clock). */
function toClock(rel: number): string {
  const angle = (rel + 360) % 360; // 0..360
  const hour = Math.round(angle / 30) % 12; // 0..11
  const label = hour === 0 ? 12 : hour;
  return `${label} o'clock`;
}

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Signed smallest angular difference between the device heading and target bearing.
 *
 * @param fromHeadingDeg Heading the user/device is currently facing (0° = north).
 * @param toBearingDeg Absolute bearing from the user toward the target (0° = north).
 * @returns Delta in range [−180, 180). Negative values mean the target lies to the left.
 */
function deltaAngle(fromHeadingDeg: number, toBearingDeg: number): number {
  const d = ((toBearingDeg - fromHeadingDeg + 540) % 360) - 180;
  return d;
}

function formatRelativeBearing(deg: number): string {
  if (!Number.isFinite(deg)) {
    return '—';
  }

  const rounded = Number(deg.toFixed(0));
  if (rounded === 0) {
    return '0° ahead';
  }

  const direction = rounded > 0 ? 'right' : 'left';
  if (Math.abs(rounded) > 120) {
    return `${Math.abs(rounded)}° ${direction} behind you`;
  }
  return `${Math.abs(rounded)}° ${direction}`;
}

/**
 * Compute bearings and distance between current GPS and a target.
 * - trueNorthBearingDeg: absolute bearing (0..360) from GPS to target.
 * - relativeBearingDeg: signed angle (−180..180) between GPS heading and bearing to target.
 * - userBearingText: formatted bearing respecting user preference (relative/clock/true north).
 * - clockBearingText: clock position from relativeBearingDeg.
 * - distanceM/distanceText: meters and formatted string based on units.
 */
export function useBearingDistance(args: {
  gps: Ref<Pick<LocationSample, 'lat' | 'lon' | 'heading'> | null>;
  target: Ref<LatLng | null>;
  units: Ref<Units>;
  bearingDisplayMode?: Ref<BearingDisplayMode>;
}) {
  const gpsLatLng = computed<LatLng | null>(() => {
    const sample = args.gps.value;
    if (!sample) {
      return null;
    }
    return toLatLng(sample.lat, sample.lon);
  });

  const gpsHeadingDeg = computed<number | null>(() => {
    const heading = args.gps.value?.heading;
    return typeof heading === 'number' ? heading : null;
  });

  const trueNorthBearingDeg = computed<number | null>(() => {
    if (!gpsLatLng.value || !args.target.value) {
      return null;
    }
    return initialBearingDeg(gpsLatLng.value, args.target.value);
  });

  const relativeBearingDeg = computed<number | null>(() => {
    if (gpsHeadingDeg.value == null || trueNorthBearingDeg.value == null) {
      return null;
    }
    return deltaAngle(gpsHeadingDeg.value, trueNorthBearingDeg.value);
  });

  const userBearingText = computed<string>(() => {
    const mode: BearingDisplayMode = args.bearingDisplayMode?.value ?? 'relative';

    if (mode === 'clock') {
      const r = relativeBearingDeg.value;
      return r == null ? '—' : toClock(r);
    }

    if (mode === 'true') {
      const t = trueNorthBearingDeg.value;
      if (t == null) {
        return '—';
      }
      const normalized = normalize360(t);
      return `${toCardinal(normalized)} ${normalized.toFixed(0)}° true`;
    }

    const r = relativeBearingDeg.value;
    return r == null ? '—' : formatRelativeBearing(r);
  });

  const clockBearingText = computed<string>(() => {
    const r = relativeBearingDeg.value;
    return r == null ? '—' : toClock(r);
  });

  const distanceM = computed<number | null>(() => {
    const a = gpsLatLng.value;
    const b = args.target.value;
    return a && b ? haversineDistanceMeters(a, b) : null;
  });

  const distanceText = computed<string>(() => formatDistance(distanceM.value, args.units.value));

  return {
    trueNorthBearingDeg,
    relativeBearingDeg,
    userBearingText,
    clockBearingText,
    distanceM,
    distanceText,
  } as const;
}
