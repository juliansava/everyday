export type ExerciseId =
  | 'lymphatic-hops'
  | 'trunk-twists'
  | 'worlds-greatest-stretch'
  | 'cossack-squat'
  | 'deep-squat-hold'
  | 'hurdler-stretch'
  | 'deep-breaths'
  | 'bw-squat'
  | 'push-up'
  | 'halo'
  | 'single-arm-swing'
  | 'clean-and-press'
  | 'around-world-lunge'
  | 'renegade-row-push-up';

export interface Exercise {
  id: ExerciseId;
  name: string;
  /** One-line form cue shown under the exercise name. */
  cue: string;
  /** Reps are counted per side. */
  perSide: boolean;
}

export type SessionKind = 'morning' | 'kb' | 'z2' | 'z5';
export type TrainingKind = Exclude<SessionKind, 'morning'>;

/** 0 = Monday … 6 = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Range {
  low: number;
  high: number;
}

/** Something to say `at` seconds after a step starts. */
export interface Cue {
  at: number;
  say: string;
}

export type SpinPhase = 'warmup' | 'main' | 'hard' | 'easy' | 'cooldown';

/** A step that ends by itself after `durationSec`. */
export interface TimedStep {
  kind: 'timed';
  /** Unique within its routine. */
  id: string;
  title: string;
  detail?: string;
  /** Drives the drawing. Absent for rests and spin phases. */
  exerciseId?: ExerciseId;
  durationSec: number;
  cues: Cue[];
  /** Spin only. */
  phase?: SpinPhase;
  /** Spin only: bpm target during this step, `null` for no target. */
  target?: Range | null;
}

export interface TapItem {
  exerciseId: ExerciseId;
  /** Per side when the exercise is per side. */
  reps: number;
}

/** A step that ends when the user taps Done. */
export interface TapStep {
  kind: 'tap';
  id: string;
  title: string;
  block: 'warmup' | 'circuit';
  /** 1-based. */
  round: number;
  /** Warm-up rounds list 3 items; circuit steps list 1. */
  items: TapItem[];
  /** Circuit only; `null` in the warm-up. */
  weightKg: number | null;
}

export type Step = TimedStep | TapStep;
