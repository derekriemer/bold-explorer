import {
  from,
  isObservable,
  map,
  Observable,
  of,
  OperatorFunction,
  startWith,
  withLatestFrom,
} from 'rxjs';
import type { ObservableInput } from 'rxjs';
import type { HeadingReading } from '@/plugins/heading';

export interface RotatedHeadingReading {
  /** The original reading emitted by the compass stream. */
  absolute: HeadingReading;
  /** The heading rotated so that 0° aligns with the provided bearing. */
  relative: HeadingReading;
  /** Normalized bearing (0..360) that was used as the rotation offset. */
  offset: number;
}

/**
 * Pipeable operator that rotates compass readings so that 0° aligns with a target bearing.
 *
 * The returned stream emits objects containing both the original (absolute) reading and
 * a rotated (relative) heading. The rotation works for both magnetic and true readings
 * when present.
 */
export function rotateZeroToBearing(
  bearing: number | ObservableInput<number | null | undefined>
): OperatorFunction<HeadingReading, RotatedHeadingReading> {
  const bearing$ = toBearingObservable(bearing);

  return (source) =>
    source.pipe(
      withLatestFrom(bearing$),
      map(([reading, offset]) => {
        if (offset == null || !Number.isFinite(offset)) {
          const result: RotatedHeadingReading = {
            absolute: reading,
            relative: { ...reading },
            offset: 0,
          };
          return result;
        }

        const normalizedOffset = normalizeHeading(offset);

        const rotate = (value: number | undefined): number | undefined => {
          if (value == null || !Number.isFinite(value)) {
            return value;
          }
          return normalizeHeading(value - normalizedOffset);
        };

        const rotated: HeadingReading = {
          magnetic: rotate(reading.magnetic) ?? reading.magnetic,
          true: rotate(reading.true),
          accuracy: reading.accuracy,
        };

        const result: RotatedHeadingReading = {
          absolute: reading,
          relative: rotated,
          offset: normalizedOffset,
        };

        return result;
      })
    );
}

function toBearingObservable(
  bearing: number | ObservableInput<number | null | undefined>
): Observable<number | null> {
  if (isObservable(bearing)) {
    return (bearing as Observable<number | null | undefined>).pipe(
      map<number | null | undefined, number | null>((value) =>
        value == null ? null : normalizeHeading(value)
      ),
      startWith<number | null>(null)
    );
  }

  if (typeof bearing === 'number' || bearing == null) {
    return of<number | null>(bearing ?? null).pipe(
      map<number | null, number | null>((value) =>
        value == null ? null : normalizeHeading(value)
      ),
      startWith<number | null>(null)
    );
  }

  return from(bearing).pipe(
    map<number | null | undefined, number | null>((value) =>
      value == null ? null : normalizeHeading(value)
    ),
    startWith<number | null>(null)
  );
}

function normalizeHeading(deg: number): number {
  if (!Number.isFinite(deg)) {
    return deg;
  }
  const mod = ((deg % 360) + 360) % 360;
  return mod;
}
