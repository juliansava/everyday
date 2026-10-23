import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_HR, positionIn, zone2, zone5 } from '../../src/program/zones';

describe('zones', () => {
  it('uses 193 as the default max HR', () => {
    expect(DEFAULT_MAX_HR).toBe(193);
  });

  it('zone 2 is 60–70 % of max HR, rounded', () => {
    expect(zone2(193)).toEqual({ low: 116, high: 135 });
  });

  it('zone 5 target is 90–95 % of max HR, rounded', () => {
    expect(zone5(193)).toEqual({ low: 174, high: 183 });
  });

  it('recalculates for a different max HR', () => {
    expect(zone2(200)).toEqual({ low: 120, high: 140 });
    expect(zone5(200)).toEqual({ low: 180, high: 190 });
  });

  it('places a bpm below, in or above a range (bounds are inclusive)', () => {
    const r = { low: 116, high: 135 };
    expect(positionIn(115, r)).toBe('below');
    expect(positionIn(116, r)).toBe('in');
    expect(positionIn(135, r)).toBe('in');
    expect(positionIn(136, r)).toBe('above');
  });
});
