import type { SessionParams, SessionRecord, SetRecord } from '../model';
import { EXERCISES } from '../program/exercises';
import { Z2_START_MAIN_MIN, kbRoutine, morningRoutine, z2Routine, z5Routine } from '../program/routines';
import type { SessionKind, Step } from '../program/types';
import { DEFAULT_MAX_HR } from '../program/zones';

export function newSession(
  kind: SessionKind,
  plannedDate: string,
  now: number,
  params: SessionParams = {},
): SessionRecord {
  return { id: crypto.randomUUID(), kind, plannedDate, status: 'in_progress', startedAt: now, stepIndex: 0, params };
}

export function completedStatus(plannedDate: string, doneDate: string): 'done' | 'moved' {
  return plannedDate === doneDate ? 'done' : 'moved';
}

export function isComplete(s: SessionRecord): boolean {
  return s.status === 'done' || s.status === 'moved';
}

export const STALE_IN_PROGRESS_MS = 12 * 60 * 60 * 1000;

export function staleInProgress(sessions: SessionRecord[], now: number): SessionRecord[] {
  return sessions.filter((s) => s.status === 'in_progress' && now - s.startedAt > STALE_IN_PROGRESS_MS);
}

/** The most recent session that was interrupted less than 12 h ago. */
export function resumable(sessions: SessionRecord[], now: number): SessionRecord | undefined {
  return sessions
    .filter((s) => s.status === 'in_progress' && now - s.startedAt <= STALE_IN_PROGRESS_MS)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

export function routineFor(s: SessionRecord): Step[] {
  switch (s.kind) {
    case 'morning':
      return morningRoutine();
    case 'kb': {
      const { circuit, roundRestSec } = s.params;
      if (!circuit || !roundRestSec) throw new Error(`Kettlebell session ${s.id} has no circuit`);
      return kbRoutine({ circuit, roundRestSec });
    }
    case 'z2':
      return z2Routine(s.params.maxHr ?? DEFAULT_MAX_HR, s.params.mainMin ?? Z2_START_MAIN_MIN);
    case 'z5':
      return z5Routine(s.params.maxHr ?? DEFAULT_MAX_HR);
  }
}

export function kbTotalReps(sets: SetRecord[]): number {
  return sets.reduce((sum, s) => sum + s.repsPerSide * (EXERCISES[s.exerciseId].perSide ? 2 : 1), 0);
}
