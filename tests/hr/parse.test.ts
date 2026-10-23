import { describe, expect, it } from 'vitest';
import { freshBpm, parseHeartRate } from '../../src/hr/parse';
import { TraceRecorder } from '../../src/hr/trace';

const view = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe('parseHeartRate', () => {
  it('reads an 8-bit value', () => {
    expect(parseHeartRate(view(0x00, 72))).toBe(72);
  });

  it('reads a 16-bit little-endian value', () => {
    expect(parseHeartRate(view(0x01, 0x2c, 0x01))).toBe(300);
  });

  it('ignores the other flag bits', () => {
    expect(parseHeartRate(view(0x16, 150, 0, 0))).toBe(150);
  });
});

describe('freshBpm', () => {
  it('returns the bpm while it is at most 3 s old, then 0', () => {
    const reading = { bpm: 140, at: 1000 };
    expect(freshBpm(reading, 3999)).toBe(140);
    expect(freshBpm(reading, 4000)).toBe(140);
    expect(freshBpm(reading, 4001)).toBe(0);
    expect(freshBpm(null, 0)).toBe(0);
  });
});

describe('TraceRecorder', () => {
  it('stores one value per second and fills skipped seconds with 0', () => {
    const trace = new TraceRecorder();
    trace.record(0, 120);
    trace.record(1, 121);
    trace.record(4, 125);
    expect(trace.snapshot()).toEqual([120, 121, 0, 0, 125]);
    expect(trace.length).toBe(5);
  });

  it('ignores a second that was already recorded', () => {
    const trace = new TraceRecorder();
    trace.record(0, 120);
    trace.record(0, 999);
    expect(trace.snapshot()).toEqual([120]);
  });

  it('continues from restored values', () => {
    const trace = new TraceRecorder([1, 2, 3]);
    trace.record(3, 4);
    expect(trace.snapshot()).toEqual([1, 2, 3, 4]);
  });
});
