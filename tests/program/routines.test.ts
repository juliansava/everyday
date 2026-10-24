import { describe, expect, it } from 'vitest';
import {
  MORNING_READY_ID,
  announce,
  kbRoutine,
  morningRoutine,
  totalSec,
  z2Routine,
  z5Routine,
  type KbPlan,
} from '../../src/program/routines';
import type { TapStep } from '../../src/program/types';

describe('morning routine', () => {
  const steps = morningRoutine();

  it('starts with a 5 s get-ready, then the 7 exercises in order', () => {
    expect(steps[0]).toMatchObject({ id: MORNING_READY_ID, durationSec: 5 });
    expect(steps.slice(1).map((s) => s.exerciseId)).toEqual([
      'lymphatic-hops', 'trunk-twists', 'worlds-greatest-stretch', 'cossack-squat',
      'deep-squat-hold', 'hurdler-stretch', 'deep-breaths',
    ]);
  });

  it('adds up to exactly 5:00 without the get-ready', () => {
    expect(totalSec(steps.slice(1))).toBe(300);
  });

  it('says "Switch sides" halfway through the one-sided stretches', () => {
    expect(steps[3].cues).toContainEqual({ at: 30, say: 'Switch sides' });
    expect(steps[6].cues).toContainEqual({ at: 20, say: 'Switch sides' });
  });

  it('announces the next exercise 5 s before the end, except after the last', () => {
    expect(steps[1].cues).toContainEqual({ at: 35, say: 'Next: Trunk twists' });
    expect(steps[7].cues.some((c) => c.say.startsWith('Next:'))).toBe(false);
  });

  it('guides 5 breaths of 4 s in and 6 s out', () => {
    const outs = steps[7].cues.filter((c) => c.say === 'Out').map((c) => c.at);
    expect(outs).toEqual([4, 14, 24, 34, 44]);
  });
});

describe('kettlebell routine', () => {
  const plan: KbPlan = {
    roundRestSec: 90,
    circuit: [
      { exerciseId: 'single-arm-swing', repsPerSide: 10, weightKg: 12 },
      { exerciseId: 'clean-and-press', repsPerSide: 10, weightKg: 8 },
      { exerciseId: 'around-world-lunge', repsPerSide: 10, weightKg: 8 },
      { exerciseId: 'renegade-row-push-up', repsPerSide: 5, weightKg: 8 },
    ],
  };
  const steps = kbRoutine(plan);

  it('has 2 warm-up taps, the bells countdown, 12 circuit taps and 2 rests', () => {
    expect(steps.map((s) => s.id)).toEqual([
      'wu-1', 'wu-2', 'bells',
      'c-1-0', 'c-1-1', 'c-1-2', 'c-1-3', 'rest-1',
      'c-2-0', 'c-2-1', 'c-2-2', 'c-2-3', 'rest-2',
      'c-3-0', 'c-3-1', 'c-3-2', 'c-3-3',
    ]);
  });

  it('lists squats, push-ups and halos in each warm-up round', () => {
    const wu = steps[0] as TapStep;
    expect(wu.items).toEqual([
      { exerciseId: 'bw-squat', reps: 10 },
      { exerciseId: 'push-up', reps: 10 },
      { exerciseId: 'halo', reps: 10 },
    ]);
    expect(wu.weightKg).toBeNull();
  });

  it('carries reps and bell weight on each circuit tap', () => {
    expect(steps[3]).toMatchObject({
      kind: 'tap', block: 'circuit', round: 1, weightKg: 12,
      items: [{ exerciseId: 'single-arm-swing', reps: 10 }],
    });
  });

  it('uses 60 s to get the bells and the planned rest between rounds', () => {
    expect(steps[2]).toMatchObject({ kind: 'timed', durationSec: 60 });
    expect(steps[7]).toMatchObject({ kind: 'timed', durationSec: 90 });
    expect(kbRoutine({ ...plan, roundRestSec: 60 })[7]).toMatchObject({ durationSec: 60 });
  });

  it('announces tap steps in plain words', () => {
    expect(announce(steps[0] as TapStep)).toBe('Warm-up round 1. 10 squats, 10 push-ups, 10 halos');
    expect(announce(steps[3] as TapStep)).toBe('Single-arm swing. 10 per side. 12 kilos');
  });
});

describe('spin routines', () => {
  it('zone 2 is 5 + 45 + 5 minutes with the zone 2 target on the main block only', () => {
    const steps = z2Routine(193, 45);
    expect(totalSec(steps)).toBe(55 * 60);
    expect(steps.map((s) => s.phase)).toEqual(['warmup', 'main', 'cooldown']);
    expect(steps[1].target).toEqual({ low: 116, high: 135 });
    expect(steps[0].target).toBeNull();
    expect(steps[2].target).toBeNull();
  });

  it('zone 2 main block follows the given length', () => {
    expect(totalSec(z2Routine(193, 60))).toBe(70 * 60);
  });

  it('zone 5 is the 40-minute 4×4', () => {
    const steps = z5Routine(193);
    expect(totalSec(steps)).toBe(40 * 60);
    expect(steps.map((s) => s.phase)).toEqual([
      'warmup', 'hard', 'easy', 'hard', 'easy', 'hard', 'easy', 'hard', 'cooldown',
    ]);
    const hard = steps.filter((s) => s.phase === 'hard');
    expect(hard.every((s) => s.durationSec === 240)).toBe(true);
    expect(hard.every((s) => s.target?.low === 174 && s.target?.high === 183)).toBe(true);
    expect(steps[1].cues[0]).toEqual({ at: 0, say: 'Interval 1 of 4. Go' });
  });
});
