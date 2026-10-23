import type { TimedStep } from '../program/types';

export const OUT_OF_ZONE_SEC = 20;
export const REPEAT_SEC = 60;
/** Heart rate lags effort, so a hard interval gets this long before "Push a bit". */
export const HARD_GRACE_SEC = 90;
/** A signal gap longer than this restarts the out-of-zone count when the signal returns. */
export const SIGNAL_GAP_SEC = 5;

export class ZoneCoach {
  private stepId: string | null = null;
  private belowSince: number | null = null;
  private aboveSince: number | null = null;
  private lastSaidAt = -Infinity;
  private lastSignalAt: number | null = null;

  /** `t` = seconds into the step, `bpm` 0 = no signal. Returns a phrase to speak, or null. */
  update(step: TimedStep, t: number, bpm: number): string | null {
    if (step.id !== this.stepId) {
      this.stepId = step.id;
      this.belowSince = null;
      this.aboveSince = null;
      this.lastSaidAt = -Infinity;
      this.lastSignalAt = null;
    }
    const target = step.target;
    if (!target || bpm <= 0) return null;

    if (this.lastSignalAt !== null && t - this.lastSignalAt > SIGNAL_GAP_SEC) {
      this.belowSince = null;
      this.aboveSince = null;
    }
    this.lastSignalAt = t;

    if (bpm < target.low) {
      this.aboveSince = null;
      this.belowSince ??= t;
    } else if (bpm > target.high) {
      this.belowSince = null;
      this.aboveSince ??= t;
    } else {
      this.belowSince = null;
      this.aboveSince = null;
      return null;
    }

    if (t - this.lastSaidAt < REPEAT_SEC) return null;
    const hard = step.phase === 'hard';
    if (this.aboveSince !== null && t - this.aboveSince >= OUT_OF_ZONE_SEC) {
      this.lastSaidAt = t;
      return hard ? 'Ease off slightly' : 'Ease off';
    }
    if (
      this.belowSince !== null &&
      t - this.belowSince >= OUT_OF_ZONE_SEC &&
      (!hard || t >= HARD_GRACE_SEC)
    ) {
      this.lastSaidAt = t;
      return 'Push a bit';
    }
    return null;
  }
}
