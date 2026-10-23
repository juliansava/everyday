import { describe, expect, it } from 'vitest';
import { ZoneCoach } from '../../src/engine/zoneCoach';
import type { TimedStep } from '../../src/program/types';

const main: TimedStep = {
  kind: 'timed', id: 'z2-main', title: 'Zone 2', phase: 'main', durationSec: 2700, cues: [],
  target: { low: 116, high: 135 },
};
const hard: TimedStep = {
  kind: 'timed', id: 'z5-hard-1', title: 'Interval 1 of 4', phase: 'hard', durationSec: 240, cues: [],
  target: { low: 174, high: 183 },
};
const easy: TimedStep = {
  kind: 'timed', id: 'z5-easy-1', title: 'Easy', phase: 'easy', durationSec: 180, cues: [], target: null,
};

/** Feeds one bpm per second for t = from..to and returns [second, phrase] for everything said. */
function feed(coach: ZoneCoach, step: TimedStep, from: number, to: number, bpm: number): [number, string][] {
  const said: [number, string][] = [];
  for (let t = from; t <= to; t++) {
    const phrase = coach.update(step, t, bpm);
    if (phrase) said.push([t, phrase]);
  }
  return said;
}

describe('ZoneCoach', () => {
  it('says "Ease off" after 20 s above zone 2, then at most once a minute', () => {
    expect(feed(new ZoneCoach(), main, 0, 100, 140)).toEqual([[20, 'Ease off'], [80, 'Ease off']]);
  });

  it('says "Push a bit" after 20 s below zone 2', () => {
    expect(feed(new ZoneCoach(), main, 0, 30, 100)).toEqual([[20, 'Push a bit']]);
  });

  it('stays quiet in zone and restarts the 20 s count after coming back', () => {
    const coach = new ZoneCoach();
    expect(feed(coach, main, 0, 15, 140)).toEqual([]);
    expect(feed(coach, main, 16, 30, 125)).toEqual([]);
    expect(feed(coach, main, 31, 50, 140)).toEqual([]);
    expect(feed(coach, main, 51, 51, 140)).toEqual([[51, 'Ease off']]);
  });

  it('gives heart rate 90 s to rise in a hard interval before "Push a bit"', () => {
    const coach = new ZoneCoach();
    expect(feed(coach, hard, 0, 89, 150)).toEqual([]);
    expect(feed(coach, hard, 90, 90, 150)).toEqual([[90, 'Push a bit']]);
  });

  it('says "Ease off slightly" above the zone 5 target', () => {
    expect(feed(new ZoneCoach(), hard, 0, 25, 190)).toEqual([[20, 'Ease off slightly']]);
  });

  it('ignores steps without a target and seconds without signal', () => {
    const coach = new ZoneCoach();
    expect(feed(coach, easy, 0, 100, 190)).toEqual([]);
    expect(feed(coach, main, 0, 100, 0)).toEqual([]);
  });

  it('starts fresh on a new step', () => {
    const coach = new ZoneCoach();
    feed(coach, main, 0, 19, 140);
    expect(feed(coach, { ...main, id: 'another' }, 0, 19, 140)).toEqual([]);
  });

  it('restarts the 20 s count after a signal gap longer than 5 s', () => {
    const coach = new ZoneCoach();
    expect(feed(coach, main, 0, 9, 140)).toEqual([]);
    expect(feed(coach, main, 10, 39, 0)).toEqual([]);
    expect(feed(coach, main, 40, 59, 140)).toEqual([]);
    expect(feed(coach, main, 60, 60, 140)).toEqual([[60, 'Ease off']]);
  });

  it('does not restart the count for a 3 s signal flicker inside an above-zone run', () => {
    const coach = new ZoneCoach();
    expect(feed(coach, main, 0, 9, 140)).toEqual([]);
    expect(feed(coach, main, 10, 12, 0)).toEqual([]);
    expect(feed(coach, main, 13, 20, 140)).toEqual([[20, 'Ease off']]);
  });
});
