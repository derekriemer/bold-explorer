import { describe, it, expect } from 'vitest';
import { sqlDistanceMetersForAlias } from '@/utils/geo';

describe('utils/geo security', () => {
  it('accepts safe alias identifiers', () => {
    expect(() => sqlDistanceMetersForAlias('w', { lat: 0, lon: 0 })).not.toThrow();
    expect(() => sqlDistanceMetersForAlias('waypoint', { lat: 0, lon: 0 })).not.toThrow();
    expect(() => sqlDistanceMetersForAlias('W1_', { lat: 0, lon: 0 })).not.toThrow();
  });

  it('rejects unsafe alias strings', () => {
    const badAliases = [
      'w;',
      'w ',
      ' w',
      '1w',
      'w,lat',
      'w.lat',
      'w`',
      'w"',
      'w-',
      'w/w',
      'w$',
      'w\nDROP TABLE waypoint'
    ];
    for (const a of badAliases) {
      expect(() => sqlDistanceMetersForAlias(a as any, { lat: 0, lon: 0 })).toThrow(/Invalid SQL alias/);
    }
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => sqlDistanceMetersForAlias('w', { lat: 100, lon: 0 } as any)).toThrow(/Invalid LatLng/);
    expect(() => sqlDistanceMetersForAlias('w', { lat: -91, lon: 0 } as any)).toThrow(/Invalid LatLng/);
    expect(() => sqlDistanceMetersForAlias('w', { lat: 0, lon: 181 } as any)).toThrow(/Invalid LatLng/);
    expect(() => sqlDistanceMetersForAlias('w', { lat: 0, lon: -181 } as any)).toThrow(/Invalid LatLng/);
  });
});
