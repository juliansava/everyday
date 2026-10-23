import type { Step } from '../program/types';

export type RunnerEvent =
  | { type: 'step'; index: number; step: Step }
  | { type: 'say'; text: string }
  | { type: 'beep'; remaining: number }
  | { type: 'finished' };

/** Cues more than this many seconds late are dropped (e.g. after the phone slept). */
export const STALE_SEC = 2;

/**
 * Runs a list of steps. All timing is derived from `now()` against the step's
 * start time, so a throttled interval or a brief screen lock never makes the
 * countdown drift: the next `tick()` simply catches up.
 */
export class Runner {
  private index: number;
  private stepStart: number;
  private readonly startedAt: number;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private lastElapsed = -1;
  private ended = false;

  constructor(
    readonly steps: Step[],
    private readonly now: () => number = Date.now,
    startIndex = 0,
  ) {
    this.startedAt = now();
    this.stepStart = this.startedAt;
    this.index = startIndex;
  }

  get stepIndex(): number {
    return this.index;
  }

  get finished(): boolean {
    return this.ended;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  current(): Step | undefined {
    return this.steps[this.index];
  }

  /** Seconds into the current step, excluding pauses. */
  elapsedInStep(): number {
    return Math.max(0, (this.clock() - this.stepStart) / 1000);
  }

  remainingInStep(): number {
    const step = this.current();
    return step?.kind === 'timed' ? Math.max(0, step.durationSec - this.elapsedInStep()) : 0;
  }

  /** Seconds since the runner was created, excluding pauses. */
  totalElapsed(): number {
    return Math.max(0, (this.clock() - this.startedAt - this.pausedTotal) / 1000);
  }

  start(): RunnerEvent[] {
    return this.enter(this.index, this.now());
  }

  tick(): RunnerEvent[] {
    if (this.ended || this.paused) return [];
    let events: RunnerEvent[] | null = null;
    let step = this.current();
    while (step?.kind === 'timed' && this.elapsedInStep() >= step.durationSec) {
      // The next step starts exactly when this one ended, not when we noticed.
      events = this.enter(this.index + 1, this.stepStart + step.durationSec * 1000);
      step = this.current();
    }
    if (events) return events;
    return step ? this.dueCues(step) : [];
  }

  /** Completes the current step: Done on a tap step, Skip on a timed one. */
  done(): RunnerEvent[] {
    if (this.ended || this.paused) return [];
    return this.enter(this.index + 1, this.now());
  }

  back(): RunnerEvent[] {
    if (this.paused) return [];
    this.ended = false;
    return this.enter(Math.max(0, this.index - 1), this.now());
  }

  pause(): void {
    if (!this.paused && !this.ended) this.pausedAt = this.now();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    const pausedFor = this.now() - this.pausedAt;
    this.stepStart += pausedFor;
    this.pausedTotal += pausedFor;
    this.pausedAt = null;
  }

  private clock(): number {
    return this.pausedAt ?? this.now();
  }

  private enter(index: number, at: number): RunnerEvent[] {
    this.index = index;
    this.stepStart = at;
    this.lastElapsed = -1;
    const step = this.current();
    if (!step) {
      this.ended = true;
      return [{ type: 'finished' }];
    }
    return [{ type: 'step', index, step }, ...this.dueCues(step)];
  }

  private dueCues(step: Step): RunnerEvent[] {
    const t = this.elapsedInStep();
    const prev = this.lastElapsed;
    this.lastElapsed = t;
    if (step.kind !== 'timed') return [];

    const due = (at: number) => at > prev && at <= t && t - at < STALE_SEC;
    const events: RunnerEvent[] = [];
    for (const cue of step.cues) {
      if (due(cue.at)) events.push({ type: 'say', text: cue.say });
    }
    for (const remaining of [3, 2, 1]) {
      const at = step.durationSec - remaining;
      if (at > 0 && due(at)) events.push({ type: 'beep', remaining });
    }
    return events;
  }
}
