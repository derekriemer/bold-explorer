import { describe, expect, it } from 'vitest';
import { BehaviorSubject, of, Subject } from 'rxjs';
import type { HeadingReading } from '@/plugins/heading';
import { rotateZeroToBearing } from '@/data/streams/compass';
import type { RotatedHeadingReading } from '@/data/streams/compass';

describe('rotateZeroToBearing', () => {
  it('rotates headings by the specified bearing', () => {
    const input: HeadingReading = { magnetic: 90, true: 95 };

    const results: Array<ReturnType<typeof summarize>> = [];
    of(input)
      .pipe(rotateZeroToBearing(90))
      .subscribe((value) => {
        results.push(summarize(value));
      });

    expect(results).toHaveLength(1);
    const { relativeMagnetic, relativeTrue, offset } = results[0];
    expect(offset).toBe(90);
    expect(relativeMagnetic).toBe(0);
    expect(relativeTrue).toBe(5);
  });

  it('handles dynamic bearing updates', () => {
    const bearing$ = new BehaviorSubject<number>(45);
    const source$ = new Subject<HeadingReading>();
    const seen: Array<ReturnType<typeof summarize>> = [];

    source$.pipe(rotateZeroToBearing(bearing$)).subscribe((value) => {
      seen.push(summarize(value));
    });

    source$.next({ magnetic: 0, true: 10 });
    bearing$.next(180);
    source$.next({ magnetic: 90, true: 200 });

    expect(seen).toHaveLength(2);

    expect(seen[0]).toMatchObject({ relativeMagnetic: 315, relativeTrue: 325, offset: 45 });
    expect(seen[1]).toMatchObject({ relativeMagnetic: 270, relativeTrue: 20, offset: 180 });
  });

  it('leaves readings unchanged when bearing is missing', () => {
    const sample: HeadingReading = { magnetic: 123.4, true: 200.1 };
    const observed: Array<ReturnType<typeof summarize>> = [];

    of(sample)
      .pipe(rotateZeroToBearing(undefined))
      .subscribe((value) => {
        observed.push(summarize(value));
      });

    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      relativeMagnetic: sample.magnetic,
      relativeTrue: sample.true,
      offset: 0,
    });
  });
});

function summarize(value: RotatedHeadingReading) {
  return {
    relativeMagnetic: value.relative.magnetic,
    relativeTrue: value.relative.true,
    offset: value.offset,
  };
}
