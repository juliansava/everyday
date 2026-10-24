import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/model';
import {
  avgBpm,
  hrRecovery,
  intervalPeaks,
  nextZone2MainMin,
  resumePoint,
  spinSummary,
  sustainedPeak,
  timeInZone,
  weeklyZone2Minutes,
  z2MainTrend,
  z5Trend,
  zone2Share,
} from '../../src/progress/cardio';
import { z2Routine, z5Routine } from '../../src/program/routines';
import type { Range, SpinPhase, TimedStep } from '../../src/program/types';

const step = (id: string, phase: SpinPhase, durationSec: number, target: Range | null): TimedStep => ({
  kind: 'timed', id, title: id, phase, durationSec, cues: [], target,
});
const Z2 = { low: 116, high: 135 };
const Z5 = { low: 174, high: 183 };

describe('ride metrics', () => {
  const z2Steps = [step('w', 'warmup', 3, null), step('m', 'main', 4, Z2), step('c', 'cooldown', 2, null)];
  const z2Bpm = [100, 105, 110, 120, 140, 130, 0, 110, 100];

  it('counts seconds in the target zone and the zone 2 share of the main block', () => {
    expect(timeInZone(z2Bpm, z2Steps)).toBe(2);
    expect(zone2Share(z2Bpm, z2Steps)).toBe(0.5);
  });

  it('averages bpm, ignoring seconds without signal', () => {
    expect(avgBpm(z2Bpm)).toBe(114);
    expect(avgBpm([0, 0])).toBeUndefined();
  });

  it('finds interval peaks and heart-rate recovery', () => {
    const steps = [step('h1', 'hard', 3, Z5), step('e1', 'easy', 2, null), step('h2', 'hard', 3, Z5), step('cd', 'cooldown', 2, null)];
    const bpm = [170, 178, 180, 160, 150, 175, 182, 181, 165, 150];
    expect(intervalPeaks(bpm, steps)).toEqual([180, 182]);
    expect(hrRecovery(bpm, steps, 2)).toBe(31); // (180-150 + 181-150) / 2 = 30.5
    expect(timeInZone(bpm, steps)).toBe(5);
    expect(hrRecovery([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], steps, 2)).toBeNull();
  });

  it('finds the highest bpm held for a run of seconds', () => {
    expect(sustainedPeak([150, 160, 170, 180, 190, 185, 175], 3)).toBe(180);
    expect(sustainedPeak([200, 200, 0, 200, 200], 3)).toBe(0);
  });

  it('summarises a zone 2 ride', () => {
    const summary = spinSummary(new Array(55 * 60).fill(125), z2Routine(193, 45));
    expect(summary).toMatchObject({ durationSec: 3300, avgBpm: 125, timeInZoneSec: 2700, zone2Share: 1 });
    expect(summary.intervalPeaks).toBeUndefined();
  });

  it('summarises a zone 5 ride', () => {
    const summary = spinSummary(new Array(40 * 60).fill(176), z5Routine(193));
    expect(summary.intervalPeaks).toEqual([176, 176, 176, 176]);
    expect(summary.hrRecovery).toBe(0);
    expect(summary.zone2Share).toBeUndefined();
  });
});

let seq = 0;
const ride = (over: Partial<SessionRecord>): SessionRecord => ({
  id: `r${++seq}`, kind: 'z2', plannedDate: '2026-10-20', status: 'done', startedAt: seq,
  stepIndex: 0, params: { maxHr: 193, mainMin: 45 }, summary: { zone2Share: 0.9 }, ...over,
});
const z2At = (mainMin: number, share: number) => ride({ params: { maxHr: 193, mainMin }, summary: { zone2Share: share } });

describe('resuming a ride', () => {
  const steps = [step('w', 'warmup', 3, null), step('m', 'main', 4, Z2), step('c', 'cooldown', 2, null)];

  it('continues at the recorded second, part-way into its step', () => {
    expect(resumePoint(steps, 0)).toEqual({ index: 0, offsetSec: 0 });
    expect(resumePoint(steps, 2)).toEqual({ index: 0, offsetSec: 2 });
    expect(resumePoint(steps, 3)).toEqual({ index: 1, offsetSec: 0 });
    expect(resumePoint(steps, 5)).toEqual({ index: 1, offsetSec: 2 });
  });

  it('is past the last step once the whole ride is recorded', () => {
    expect(resumePoint(steps, 9)).toEqual({ index: 3, offsetSec: 0 });
    expect(resumePoint(steps, 12)).toEqual({ index: 3, offsetSec: 0 });
  });
});

describe('zone 2 progression', () => {
  it('starts at 45 minutes', () => {
    expect(nextZone2MainMin([])).toBe(45);
  });

  it('adds 5 minutes after two rides at the current length with 80 % in zone', () => {
    expect(nextZone2MainMin([z2At(45, 0.85), z2At(45, 0.8)])).toBe(50);
  });

  it('does not count rides with less than 80 % in zone', () => {
    expect(nextZone2MainMin([z2At(45, 0.85), z2At(45, 0.6)])).toBe(45);
  });

  it('ignores rides at a different length', () => {
    expect(nextZone2MainMin([z2At(45, 0.9), z2At(50, 0.9)])).toBe(45);
  });

  it('caps at 60 minutes', () => {
    const rides = [45, 45, 50, 50, 55, 55, 60, 60].map((m) => z2At(m, 0.9));
    expect(nextZone2MainMin(rides)).toBe(60);
  });
});

describe('cardio trends', () => {
  it('sums zone 2 minutes per week', () => {
    const sessions = [ride({ plannedDate: '2026-10-20', summary: { timeInZoneSec: 2700, zone2Share: 1 } })];
    expect(weeklyZone2Minutes('2026-10-23', sessions, 2)).toEqual([
      { weekStart: '2026-10-12', minutes: 0 },
      { weekStart: '2026-10-19', minutes: 45 },
    ]);
  });

  it('counts partial zone 2 rides in the weekly minutes but not rides still in progress', () => {
    const sessions = [
      ride({ plannedDate: '2026-10-20', status: 'partial', summary: { timeInZoneSec: 2400, zone2Share: 0.9 } }),
      ride({ plannedDate: '2026-10-21', status: 'in_progress', summary: { timeInZoneSec: 600 } }),
    ];
    expect(weeklyZone2Minutes('2026-10-23', sessions, 1)).toEqual([{ weekStart: '2026-10-19', minutes: 40 }]);
  });

  it('lists the zone 2 block length and zone 5 peaks and recovery per ride', () => {
    const sessions = [
      ride({ plannedDate: '2026-10-20' }),
      ride({ kind: 'z5', plannedDate: '2026-10-22', params: { maxHr: 193 }, summary: { intervalPeaks: [176, 180, 0, 184], hrRecovery: 28 } }),
    ];
    expect(z2MainTrend(sessions)).toEqual([{ date: '2026-10-20', mainMin: 45 }]);
    expect(z5Trend(sessions)).toEqual([{ date: '2026-10-22', avgPeak: 180, hrRecovery: 28 }]);
  });
});
