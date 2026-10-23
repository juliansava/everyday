import type { CircuitEntry } from './program/routines';
import { DEFAULT_TRAINING_DAYS, type TrainingDays } from './program/schedule';
import type { ExerciseId, SessionKind } from './program/types';
import { DEFAULT_MAX_HR } from './program/zones';

export type Rating = 'easy' | 'right' | 'hard';
export type SessionStatus = 'in_progress' | 'done' | 'moved' | 'partial';

/** What the session was planned with, so its routine can be rebuilt exactly. */
export interface SessionParams {
  circuit?: CircuitEntry[];
  roundRestSec?: number;
  maxHr?: number;
  mainMin?: number;
}

export interface SessionSummary {
  durationSec?: number;
  totalReps?: number;
  avgBpm?: number;
  manualAvgBpm?: number;
  timeInZoneSec?: number;
  zone2Share?: number;
  intervalPeaks?: number[];
  hrRecovery?: number | null;
  sustainedPeak?: number;
}

export interface SessionRecord {
  id: string;
  kind: SessionKind;
  /** The schedule day this session belongs to. */
  plannedDate: string;
  /** The day it was actually completed. */
  doneDate?: string;
  status: SessionStatus;
  startedAt: number;
  endedAt?: number;
  /** Index of the step to resume from. */
  stepIndex: number;
  rating?: Rating;
  note?: string;
  params: SessionParams;
  summary?: SessionSummary;
}

export interface SetRecord {
  id: string;
  sessionId: string;
  exerciseId: ExerciseId;
  block: 'warmup' | 'circuit';
  round: number;
  repsPerSide: number;
  plannedRepsPerSide: number;
  weightKg: number | null;
  at: number;
}

export interface HrTraceRecord {
  sessionId: string;
  startedAt: number;
  /** One value per second of the ride, 0 = no signal. */
  bpm: number[];
}

export type RoundRest = 90 | 75 | 60;

export interface Settings {
  maxHr: number;
  trainingDays: TrainingDays;
  bellsKg: number[];
  roundRestSec: RoundRest;
  voice: boolean;
  beeps: boolean;
  vibration: boolean;
  pairedStrapId?: string;
  lastBackupAt?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  maxHr: DEFAULT_MAX_HR,
  trainingDays: DEFAULT_TRAINING_DAYS,
  bellsKg: [8, 12, 16],
  roundRestSec: 90,
  voice: true,
  beeps: true,
  vibration: true,
};
