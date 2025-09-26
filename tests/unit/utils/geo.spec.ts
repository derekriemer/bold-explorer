import { describe, it, expect } from 'vitest';
import { haversineDistanceMeters, initialBearingDeg, deltaHeadingDeg } from '@/utils/geo';

describe('utils/geo', () => {
  describe('haversineDistanceMeters', () => {
    it('identical points = 0 m', () => {
      const a = { lat: 0, lon: 0 };
      const b = { lat: 0, lon: 0 };
      const d = haversineDistanceMeters(a, b);
      expect(d).toBeCloseTo(0, 6);
    });

    it('~111,320 m per 1° latitude (tolerance)', () => {
      const a = { lat: 0, lon: 0 };
      const b = { lat: 1, lon: 0 }; // move 1 degree north
      const d = haversineDistanceMeters(a, b);
      // Accept a reasonable tolerance due to spherical vs ellipsoidal Earth differences
      expect(Math.abs(d - 111320)).toBeLessThan(1000);
    });

    it('symmetry A→B = B→A', () => {
      const a = { lat: 12.34, lon: -56.78 };
      const b = { lat: -23.45, lon: 67.89 };
      const d1 = haversineDistanceMeters(a, b);
      const d2 = haversineDistanceMeters(b, a);
      expect(Math.abs(d1 - d2)).toBeLessThan(1e-6);
    });
  });

  describe('initialBearingDeg', () => {
    it('cardinal directions', () => {
      const origin = { lat: 0, lon: 0 };
      expect(initialBearingDeg(origin, { lat: 1, lon: 0 })).toBeCloseTo(0, 1); // N
      expect(initialBearingDeg(origin, { lat: 0, lon: 1 })).toBeCloseTo(90, 1); // E
      expect(initialBearingDeg(origin, { lat: -1, lon: 0 })).toBeCloseTo(180, 1); // S
      expect(initialBearingDeg(origin, { lat: 0, lon: -1 })).toBeCloseTo(270, 1); // W
    });

    it('quadrants and wrap [0,360)', () => {
      const origin = { lat: 0, lon: 0 };
      const brNE = initialBearingDeg(origin, { lat: 1, lon: 1 });
      const brSE = initialBearingDeg(origin, { lat: -1, lon: 1 });
      const brSW = initialBearingDeg(origin, { lat: -1, lon: -1 });
      const brNW = initialBearingDeg(origin, { lat: 1, lon: -1 });
      expect(brNE).toBeGreaterThan(0);
      expect(brNE).toBeLessThan(90);
      expect(brSE).toBeGreaterThan(90);
      expect(brSE).toBeLessThan(180);
      expect(brSW).toBeGreaterThan(180);
      expect(brSW).toBeLessThan(270);
      expect(brNW).toBeGreaterThan(270);
      expect(brNW).toBeLessThan(360);
    });
  });

  describe('deltaHeadingDeg', () => {
    it('wrap-around and sign correctness', () => {
      expect(deltaHeadingDeg(350, 10)).toBe(-20);
      expect(deltaHeadingDeg(10, 350)).toBe(20);
      expect(deltaHeadingDeg(0, 0)).toBe(0);
      expect(deltaHeadingDeg(0, 180)).toBe(-180);
      expect(deltaHeadingDeg(180, 0)).toBe(180 - 360); // normalized to [-180,180) => -180
    });
  });
});
