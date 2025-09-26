/**
 * Helpers for aligning the magnetometer heading to a user-defined bearing without
 * altering the absolute compass display.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type { Subscription } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import {
  rotateZeroToBearing,
  type RotatedHeadingReading,
} from '@/data/streams/compass/rotateZeroToBearing';
import { compassStream } from '@/data/streams/compass';
import { useGpsUiStore } from '@/stores/useGpsUi';

/** Convert a compass value to a signed delta in the range [-180, 180]. */
function toSignedHeading(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

/**
 * Stream rotated compass readings while alignment is active and expose helper deltas
 * for audio/tactile guidance.
 */
export function useBearingAlignment() {
  const gpsUi = useGpsUiStore();
  const { alignmentActive, alignmentBearingDeg } = storeToRefs(gpsUi);

  const bearing$ = new BehaviorSubject<number | null>(alignmentBearingDeg.value);
  watch(alignmentBearingDeg, (value) => {
    bearing$.next(value ?? null);
  });

  const rotated = ref<RotatedHeadingReading | null>(null);
  let sub: Subscription | null = null;

  /** Ensure the rotation subscription is active when alignment guidance is on. */
  const ensureSubscription = () => {
    if (sub || !alignmentActive.value) {
      return;
    }
    sub = compassStream.updates.pipe(rotateZeroToBearing(bearing$)).subscribe((reading) => {
      rotated.value = reading;
    });
  };

  /** Stop listening to the compass stream when guidance is disabled. */
  const teardown = () => {
    if (!sub) {
      return;
    }
    try {
      sub.unsubscribe();
    } catch {
      /* noop */
    }
    sub = null;
    rotated.value = null;
  };

  watch(
    alignmentActive,
    (active) => {
      if (active) {
        ensureSubscription();
      } else {
        teardown();
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    teardown();
  });

  /** Signed difference between the compass heading and target bearing. */
  const relativeDeg = computed(() => {
    const rel = rotated.value?.relative;
    if (!rel) {
      return null;
    }
    const preferred = rel.true ?? rel.magnetic ?? null;
    return toSignedHeading(preferred);
  });

  /** Absolute deviation from the target bearing. */
  const differenceAbs = computed(() => {
    const value = relativeDeg.value;
    return value == null ? null : Math.abs(value);
  });

  /** Direction of deviation: -1 left, 1 right, 0 aligned. */
  const differenceSign = computed(() => {
    const value = relativeDeg.value;
    if (value == null || value === 0) {
      return 0;
    }
    return value > 0 ? 1 : -1;
  });

  /** Simplified pan control for audio cues (-1 left, 1 right). */
  const pan = computed(() => {
    const sign = differenceSign.value;
    if (sign === 0) {
      return 0;
    }
    return sign > 0 ? 1 : -1;
  });

  return {
    alignmentActive,
    alignmentBearingDeg,
    relativeDeg,
    differenceAbs,
    differenceSign,
    pan,
  } as const;
}
