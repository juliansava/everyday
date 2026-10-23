import { describe, expect, it } from 'vitest';
import { poseAt } from '../../src/art/interpolate';
import { DRAWINGS, JOINTS, type Drawing } from '../../src/art/poses';
import { EXERCISES } from '../../src/program/exercises';

describe('drawings', () => {
  it('has a drawing for every exercise', () => {
    expect(Object.keys(DRAWINGS).sort()).toEqual(Object.keys(EXERCISES).sort());
  });

  it('gives every frame 11 joints inside the 100 × 100 box', () => {
    for (const [id, d] of Object.entries(DRAWINGS)) {
      for (const frame of d.frames) {
        expect(frame, id).toHaveLength(JOINTS * 2);
        expect(frame.every((v) => v >= 0 && v <= 100), id).toBe(true);
      }
    }
  });

  it('loops seamlessly: the last frame equals the first', () => {
    for (const [id, d] of Object.entries(DRAWINGS)) {
      expect(d.frames[d.frames.length - 1], id).toEqual(d.frames[0]);
    }
  });

  it('gives custom keyframe times for every frame, from 0 to 1', () => {
    for (const d of Object.values(DRAWINGS)) {
      if (!d.stops) continue;
      expect(d.stops).toHaveLength(d.frames.length);
      expect(d.stops[0]).toBe(0);
      expect(d.stops.at(-1)).toBe(1);
    }
  });
});

describe('poseAt', () => {
  const A = new Array(22).fill(0);
  const B = new Array(22).fill(10);
  const d: Drawing = { frames: [A, B, A], durationSec: 2, bell: null };

  it('starts on the first frame and reaches the middle frame halfway through the loop', () => {
    expect(poseAt(d, 0)).toEqual(A);
    expect(poseAt(d, 1)).toEqual(B);
    expect(poseAt(d, 2)).toEqual(A);
  });

  it('eases between frames', () => {
    expect(poseAt(d, 0.5)[0]).toBeCloseTo(5);
    expect(poseAt(d, 0.25)[0]).toBeCloseTo(1.25);
  });

  it('respects custom keyframe times', () => {
    expect(poseAt({ ...d, stops: [0, 0.25, 1] }, 0.5)).toEqual(B);
  });
});
