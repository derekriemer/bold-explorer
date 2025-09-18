import { computed, type Ref } from 'vue';
import { initialBearingDeg, haversineDistanceMeters } from '@/utils/geo';
import { formatDistance, type Units } from './useDistance';
import type { LatLng } from '@/types';

/** Map an absolute bearing (0..360) to a cardinal text. */
function toCardinal (deg: number): string
{
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return dirs[idx];
}

/** Map a relative bearing (−180..180) to a clock position label (12,1,…,11 o'clock). */
function toClock (rel: number): string
{
  const angle = ((rel + 360) % 360); // 0..360
  const hour = Math.round(angle / 30) % 12; // 0..11
  const label = hour === 0 ? 12 : hour;
  return `${ label } o'clock`;
}

/** Signed smallest angular difference a→b in range [−180, 180). */
function deltaAngle (fromDeg: number, toDeg: number): number
{
  const d = ((toDeg - fromDeg + 540) % 360) - 180;
  return d;
}

/**
 * Compute bearings and distance between current GPS and a target.
 * - trueNorthBearingDeg: absolute bearing (0..360) from GPS to target.
 * - relativeBearingDeg: signed angle (−180..180) between user headingDeg and bearing to target.
 * - userBearingText: cardinal text for trueNorthBearingDeg.
 * - clockBearingText: clock position from relativeBearingDeg.
 * - distanceM/distanceText: meters and formatted string based on units.
 */
export function useBearingDistance (args: {
  gps: Ref<LatLng | null>;
  target: Ref<LatLng | null>;
  headingDeg?: Ref<number | null>;
  units: Ref<Units>;
})
{
  const trueNorthBearingDeg = computed<number | null>(() =>
  {
    if (!args.gps.value || !args.target.value) return null;
    return initialBearingDeg(args.gps.value, args.target.value);
  });

  const relativeBearingDeg = computed<number | null>(() =>
  {
    if (!args.headingDeg || args.headingDeg.value == null || trueNorthBearingDeg.value == null) return null;
    return deltaAngle(args.headingDeg.value, trueNorthBearingDeg.value);
  });

  const userBearingText = computed<string>(() =>
  {
    const b = trueNorthBearingDeg.value;
    return b == null ? '—' : `${ toCardinal(b) } ${ b.toFixed(0) }°`;
  });

  const clockBearingText = computed<string>(() =>
  {
    const r = relativeBearingDeg.value;
    return r == null ? '—' : toClock(r);
  });

  const distanceM = computed<number | null>(() =>
  {
    const a = args.gps.value; const b = args.target.value;
    return a && b ? haversineDistanceMeters(a, b) : null;
  });

  const distanceText = computed<string>(() => formatDistance(distanceM.value, args.units.value));

  return { trueNorthBearingDeg, relativeBearingDeg, userBearingText, clockBearingText, distanceM, distanceText } as const;
}
