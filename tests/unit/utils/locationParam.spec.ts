import { describe, it, expect } from 'vitest';
import { parseCenterParam } from '@/utils/locationParam';

describe('parseCenterParam', () => {
  it('parses valid "lat,lon" string', () => {
    expect(parseCenterParam('37.7749,-122.4194')).toEqual({ lat: 37.7749, lon: -122.4194 });
  });

  it('parses first element when array provided', () => {
    expect(parseCenterParam(['51.5, -0.12'])).toEqual({ lat: 51.5, lon: -0.12 });
  });

  it('rejects invalid formats', () => {
    expect(parseCenterParam('')).toBeNull();
    expect(parseCenterParam('10')).toBeNull();
    expect(parseCenterParam('10,20,30')).toBeNull();
    expect(parseCenterParam('lat,lon')).toBeNull();
    expect(parseCenterParam('100,0')).toBeNull(); // invalid latitude
    expect(parseCenterParam('0,200')).toBeNull(); // invalid longitude
  });
});

