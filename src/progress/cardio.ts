import type { SessionRecord, SessionSummary } from '../model';
import { Z2_MAX_MAIN_MIN, Z2_START_MAIN_MIN, Z2_STEP_MIN } from '../program/routines';
import { addDays, weekStart } from '../program/schedule';
import type { Range, TimedStep } from '../program/types';
import { isComplete } from './session';

export interface StepWindow {
  step: TimedStep;
  /** First second of the step in the trace. */
  start: number;
  /** One past the last second. */
  end: number;
}

export function stepWindows(steps: TimedStep[]): StepWindow[] {
  let t = 0;
  return steps.map((step) => {
    const w = { step, start: t, end: t + step.durationSec };
    t = w.end;
    return w;
  });
}

/** Where an interrupted ride continues: the step containing second `recordedSec` and how far into it. */
export function resumePoint(steps: TimedStep[], recordedSec: number): { index: number; offsetSec: number } {
  const windows = stepWindows(steps);
  const index = windows.findIndex((w) => recordedSec < w.end);
  return index < 0 ? { index: steps.length, offsetSec: 0 } : { index, offsetSec: recordedSec - windows[index].start };
}

const inRange = (bpm: number, r: Range) => bpm > 0 && bpm >= r.low && bpm <= r.high;

function secondsInRange(bpm: number[], w: StepWindow, r: Range): number {
  let n = 0;
  for (let i = w.start; i < Math.min(w.end, bpm.length); i++) if (inRange(bpm[i], r)) n++;
  return n;
}

export function timeInZone(bpm: number[], steps: TimedStep[]): number {
  return stepWindows(steps).reduce((sum, w) => sum + (w.step.target ? secondsInRange(bpm, w, w.step.target) : 0), 0);
}

export function zone2Share(bpm: number[], steps: TimedStep[]): number {
  const w = stepWindows(steps).find((x) => x.step.phase === 'main');
  if (!w?.step.target) return 0;
  return secondsInRange(bpm, w, w.step.target) / (w.end - w.start);
}

export function avgBpm(bpm: number[]): number | undefined {
  const valid = bpm.filter((b) => b > 0);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : undefined;
}

export function intervalPeaks(bpm: number[], steps: TimedStep[]): number[] {
  return stepWindows(steps)
    .filter((w) => w.step.phase === 'hard')
    .map((w) => Math.max(0, ...bpm.slice(w.start, w.end)));
}

export const RECOVERY_SEC = 60;

/** Mean bpm drop from the last second of each hard interval to `recoverySec` later. */
export function hrRecovery(bpm: number[], steps: TimedStep[], recoverySec = RECOVERY_SEC): number | null {
  const drops: number[] = [];
  for (const w of stepWindows(steps)) {
    if (w.step.phase !== 'hard') continue;
    const end = bpm[w.end - 1];
    const later = bpm[w.end - 1 + recoverySec];
    if (end > 0 && later > 0) drops.push(end - later);
  }
  return drops.length ? Math.round(drops.reduce((a, b) => a + b, 0) / drops.length) : null;
}

/** The highest bpm that was held (every second at or above it) for `run` seconds in a row. */
export function sustainedPeak(bpm: number[], run = 5): number {
  let best = 0;
  for (let i = 0; i + run <= bpm.length; i++) {
    const window = bpm.slice(i, i + run);
    if (window.every((b) => b > 0)) best = Math.max(best, Math.min(...window));
  }
  return best;
}

export function spinSummary(bpm: number[], steps: TimedStep[]): SessionSummary {
  const hasMain = steps.some((s) => s.phase === 'main');
  const hasHard = steps.some((s) => s.phase === 'hard');
  return {
    durationSec: bpm.length,
    avgBpm: avgBpm(bpm),
    timeInZoneSec: timeInZone(bpm, steps),
    ...(hasMain ? { zone2Share: zone2Share(bpm, steps) } : {}),
    ...(hasHard ? { intervalPeaks: intervalPeaks(bpm, steps), hrRecovery: hrRecovery(bpm, steps) } : {}),
    sustainedPeak: sustainedPeak(bpm),
  };
}

// ---------- Progression and trends ----------

export const Z2_MIN_SHARE = 0.8;

const finished = (sessions: SessionRecord[], kind: 'z2' | 'z5') =>
  sessions.filter((s) => s.kind === kind && isComplete(s)).sort((a, b) => a.startedAt - b.startedAt);

export function nextZone2MainMin(sessions: SessionRecord[]): number {
  let current = Z2_START_MAIN_MIN;
  let count = 0;
  for (const s of finished(sessions, 'z2')) {
    if (s.params.mainMin !== current || (s.summary?.zone2Share ?? 0) < Z2_MIN_SHARE) continue;
    count++;
    if (count === 2) {
      current = Math.min(Z2_MAX_MAIN_MIN, current + Z2_STEP_MIN);
      count = 0;
    }
  }
  return current;
}

export function weeklyZone2Minutes(
  today: string,
  sessions: SessionRecord[],
  weeks = 12,
): { weekStart: string; minutes: number }[] {
  // Partial rides count their time in zone; only rides still in progress are left out.
  const rides = sessions.filter((s) => s.kind === 'z2' && s.status !== 'in_progress');
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(current, -7 * (weeks - 1 - i));
    const sec = rides
      .filter((s) => weekStart(s.plannedDate) === ws)
      .reduce((sum, s) => sum + (s.summary?.timeInZoneSec ?? 0), 0);
    return { weekStart: ws, minutes: Math.round(sec / 60) };
  });
}

export function z2MainTrend(sessions: SessionRecord[]): { date: string; mainMin: number }[] {
  return finished(sessions, 'z2').map((s) => ({ date: s.plannedDate, mainMin: s.params.mainMin ?? Z2_START_MAIN_MIN }));
}

export function z5Trend(
  sessions: SessionRecord[],
): { date: string; avgPeak: number | null; hrRecovery: number | null }[] {
  return finished(sessions, 'z5').map((s) => {
    const peaks = (s.summary?.intervalPeaks ?? []).filter((p) => p > 0);
    return {
      date: s.plannedDate,
      avgPeak: peaks.length ? Math.round(peaks.reduce((a, b) => a + b, 0) / peaks.length) : null,
      hrRecovery: s.summary?.hrRecovery ?? null,
    };
  });
}
