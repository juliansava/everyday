import { beforeEach, describe, expect, it } from 'vitest';
import { Runner, type RunnerEvent } from '../../src/engine/runner';
import type { TapStep, TimedStep } from '../../src/program/types';

let t = 0;
const now = () => t;
const at = (sec: number) => {
  t = sec * 1000;
};
const timed = (id: string, durationSec: number, cues: TimedStep['cues'] = []): TimedStep => ({
  kind: 'timed', id, title: id, durationSec, cues,
});
const tap = (id: string): TapStep => ({
  kind: 'tap', id, title: id, block: 'circuit', round: 1,
  items: [{ exerciseId: 'halo', reps: 10 }], weightKg: 8,
});
const says = (events: RunnerEvent[]) => events.flatMap((e) => (e.type === 'say' ? [e.text] : []));

beforeEach(() => at(0));

describe('Runner', () => {
  it('emits the first step and its opening cue on start', () => {
    const r = new Runner([timed('a', 10, [{ at: 0, say: 'A' }])], now);
    const events = r.start();
    expect(events[0]).toMatchObject({ type: 'step', index: 0 });
    expect(says(events)).toEqual(['A']);
  });

  it('fires cues when their time comes and beeps the last 3 seconds', () => {
    const r = new Runner([timed('a', 10, [{ at: 5, say: 'half' }])], now);
    r.start();
    at(4.9);
    expect(r.tick()).toEqual([]);
    at(5.1);
    expect(says(r.tick())).toEqual(['half']);
    at(7);
    expect(r.tick()).toEqual([{ type: 'beep', remaining: 3 }]);
    at(8);
    expect(r.tick()).toEqual([{ type: 'beep', remaining: 2 }]);
    at(9);
    expect(r.tick()).toEqual([{ type: 'beep', remaining: 1 }]);
  });

  it('moves on from a timed step by itself but waits on a tap step', () => {
    const r = new Runner([timed('a', 10), tap('b'), timed('c', 4)], now);
    r.start();
    at(10);
    expect(r.tick()[0]).toMatchObject({ type: 'step', index: 1 });
    at(100);
    expect(r.tick()).toEqual([]);
    expect(r.stepIndex).toBe(1);
    expect(r.elapsedInStep()).toBe(90);
    expect(r.done()[0]).toMatchObject({ type: 'step', index: 2 });
    at(104);
    expect(r.tick().map((e) => e.type)).toEqual(['finished']);
    expect(r.finished).toBe(true);
  });

  it('catches up on the wall clock after a gap without replaying stale cues', () => {
    const r = new Runner(
      [
        timed('a', 10, [{ at: 0, say: 'A' }]),
        timed('b', 10, [{ at: 0, say: 'B' }, { at: 4, say: 'b4' }]),
        timed('c', 10),
      ],
      now,
    );
    r.start();
    at(15);
    const events = r.tick();
    expect(events.filter((e) => e.type === 'step')).toEqual([expect.objectContaining({ index: 1 })]);
    expect(says(events)).toEqual(['b4']); // 'B' is 5 s late and dropped, 'b4' is 1 s late and kept
    expect(r.elapsedInStep()).toBe(5);
    at(25);
    r.tick();
    expect(r.stepIndex).toBe(2);
    expect(r.elapsedInStep()).toBe(5);
  });

  it('pauses the clock and resumes where it left off', () => {
    const r = new Runner([timed('a', 10), timed('b', 10)], now);
    r.start();
    at(3);
    r.pause();
    at(50);
    expect(r.tick()).toEqual([]);
    expect(r.elapsedInStep()).toBe(3);
    r.resume();
    expect(r.elapsedInStep()).toBe(3);
    expect(r.totalElapsed()).toBe(3);
    at(57);
    expect(r.tick()[0]).toMatchObject({ type: 'step', index: 1 });
  });

  it('goes back to the previous step and restarts it', () => {
    const r = new Runner([tap('a'), tap('b')], now);
    r.start();
    at(5);
    r.done();
    at(8);
    expect(r.back()[0]).toMatchObject({ type: 'step', index: 0 });
    expect(r.elapsedInStep()).toBe(0);
  });

  it('can start part-way through for a resumed session', () => {
    const r = new Runner([tap('a'), tap('b'), tap('c')], now, 2);
    expect(r.start()[0]).toMatchObject({ type: 'step', index: 2 });
  });

  it('can resume part-way into a timed step', () => {
    const r = new Runner([timed('a', 10), timed('b', 10, [{ at: 0, say: 'B' }, { at: 6, say: 'b6' }])], now, 1, 4);
    const events = r.start();
    expect(events[0]).toMatchObject({ type: 'step', index: 1 });
    expect(says(events)).toEqual([]); // 'B' was already said before the interruption
    expect(r.elapsedInStep()).toBe(4);
    expect(r.remainingInStep()).toBe(6);
    expect(r.totalElapsed()).toBe(0);
    at(2);
    expect(says(r.tick())).toEqual(['b6']);
    expect(r.totalElapsed()).toBe(2);
    at(6);
    expect(r.tick().map((e) => e.type)).toEqual(['finished']);
  });

  it('keeps a resumed step offset across a pause', () => {
    const r = new Runner([timed('a', 10)], now, 0, 3);
    r.start();
    at(2);
    r.pause();
    at(30);
    r.resume();
    expect(r.elapsedInStep()).toBe(5);
    at(35);
    expect(r.tick().map((e) => e.type)).toEqual(['finished']);
  });

  it('clamps a start index outside the routine', () => {
    const past = new Runner([tap('a'), tap('b')], now, 5);
    expect(past.start()).toEqual([{ type: 'finished' }]);
    expect(past.stepIndex).toBe(2);
    expect(new Runner([tap('a'), tap('b')], now, -1).stepIndex).toBe(0);
  });
});
