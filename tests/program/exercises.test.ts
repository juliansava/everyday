import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../../src/program/exercises';

const ALL_IDS = [
  'lymphatic-hops', 'trunk-twists', 'worlds-greatest-stretch', 'cossack-squat',
  'deep-squat-hold', 'hurdler-stretch', 'deep-breaths',
  'bw-squat', 'push-up', 'halo',
  'single-arm-swing', 'clean-and-press', 'low-windmill', 'overhead-windmill',
  'renegade-row-push-up',
];

describe('exercise catalog', () => {
  it('has exactly the 15 exercises from the spec', () => {
    expect(Object.keys(EXERCISES).sort()).toEqual([...ALL_IDS].sort());
  });

  it('keys every entry by its own id and gives it a name and a form cue', () => {
    for (const [key, ex] of Object.entries(EXERCISES)) {
      expect(ex.id).toBe(key);
      expect(ex.name.length).toBeGreaterThan(0);
      expect(ex.cue.length).toBeGreaterThan(0);
    }
  });

  it('marks one-sided movements as per side', () => {
    expect(EXERCISES['single-arm-swing'].perSide).toBe(true);
    expect(EXERCISES['renegade-row-push-up'].perSide).toBe(true);
    expect(EXERCISES['bw-squat'].perSide).toBe(false);
    expect(EXERCISES['halo'].perSide).toBe(false);
  });
});
