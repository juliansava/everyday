import type { Store } from '../db/store';
import type { SessionRecord, SessionSummary } from '../model';
import type { CircuitEntry } from '../program/routines';
import { todayISO, trainingFor, type TrainingDays } from '../program/schedule';
import type { TimedStep, TrainingKind } from '../program/types';
import { nextZone2MainMin, spinSummary } from '../progress/cardio';
import { completedStatus, isComplete, kbTotalReps, newSession, routineFor } from '../progress/session';
import type { AppData, Next, Route } from './data';

export async function beginMorning(d: AppData, next: Next): Promise<void> {
  const s = newSession('morning', d.today, Date.now());
  await d.store.putSession(s);
  await d.reload();
  d.go({ name: 'morning', sessionId: s.id, next });
}

/**
 * Opens the start screen; the session itself is only created when the user taps Start there.
 * `replace` is for the move straight on from the morning routine, which Back shouldn't return to.
 */
export async function beginTraining(d: AppData, kind: TrainingKind, plannedDate: string, replace = false): Promise<void> {
  d.go(kind === 'kb' ? { name: 'kb-start', plannedDate } : { name: 'spin-start', kind, plannedDate }, { replace });
}

export async function beginSpin(d: AppData, kind: 'z2' | 'z5', plannedDate: string): Promise<void> {
  const params =
    kind === 'z2'
      ? { maxHr: d.settings.maxHr, mainMin: nextZone2MainMin(d.sessions) }
      : { maxHr: d.settings.maxHr };
  const s = newSession(kind, plannedDate, Date.now(), params);
  await d.store.putSession(s);
  await d.reload();
  d.go({ name: 'spin', sessionId: s.id }, { replace: true });
}

export async function beginKb(d: AppData, plannedDate: string, circuit: CircuitEntry[]): Promise<void> {
  const s = newSession('kb', plannedDate, Date.now(), { circuit, roundRestSec: d.settings.roundRestSec });
  await d.store.putSession(s);
  await d.reload();
  d.go({ name: 'kb', sessionId: s.id }, { replace: true });
}

/** Remembers where to resume. Doesn't reload, so it's cheap to call on every step. */
export async function saveProgress(d: AppData, s: SessionRecord, stepIndex: number): Promise<void> {
  await d.store.putSession({ ...s, stepIndex });
}

export async function completeSession(
  d: AppData,
  s: SessionRecord,
  patch: Partial<SessionRecord> = {},
): Promise<SessionRecord> {
  const latest = (await d.store.getSession(s.id)) ?? s;
  const done: SessionRecord = {
    ...latest,
    ...patch,
    status: s.kind === 'morning' ? 'done' : completedStatus(s.plannedDate, d.today),
    doneDate: d.today,
    endedAt: Date.now(),
  };
  await d.store.putSession(done);
  await d.reload();
  return done;
}

export async function endPartial(d: AppData, s: SessionRecord, patch: Partial<SessionRecord> = {}): Promise<void> {
  const latest = (await d.store.getSession(s.id)) ?? s;
  await d.store.putSession({ ...latest, ...patch, status: 'partial', endedAt: Date.now() });
  await d.reload();
}

/** The summary an interrupted ride keeps, built from the heart-rate trace saved so far. */
export async function partialSummary(store: Store, s: SessionRecord): Promise<SessionSummary | undefined> {
  if (s.kind !== 'z2' && s.kind !== 'z5') return undefined;
  const trace = await store.getTrace(s.id);
  return spinSummary(trace?.bpm ?? [], routineFor(s) as TimedStep[]);
}

/** A kettlebell session or ride that ran its whole routine: only the Finish screen's save is missing. */
export function reachedEnd(s: SessionRecord): boolean {
  return s.kind !== 'morning' && s.stepIndex >= routineFor(s).length;
}

/**
 * Files an interrupted session when it's ended from Today or auto-saved after 12 h. One that reached
 * the end of its routine counts as done on the day it was done (a kettlebell session just has no
 * rating); anything else is partial. Rides keep the summary of their stored trace either way.
 * `endedAt` is used when the session has no end time of its own.
 */
export async function closeInterrupted(store: Store, s: SessionRecord, endedAt: number): Promise<SessionRecord> {
  const latest = (await store.getSession(s.id)) ?? s;
  if (!reachedEnd(latest)) {
    const summary = await partialSummary(store, latest);
    return { ...latest, status: 'partial', endedAt, ...(summary ? { summary } : {}) };
  }
  let summary: SessionSummary | undefined;
  let end = latest.endedAt;
  if (latest.kind === 'kb') {
    const sets = await store.setsFor(latest.id);
    end ??= Math.max(latest.startedAt, ...sets.map((x) => x.at));
    summary = { totalReps: kbTotalReps(sets), durationSec: Math.round((end - latest.startedAt) / 1000) };
  } else {
    summary = await partialSummary(store, latest);
  }
  const doneDate = todayISO(new Date(end ?? latest.startedAt));
  return {
    ...latest,
    status: completedStatus(latest.plannedDate, doneDate),
    doneDate,
    endedAt: end ?? endedAt,
    ...(summary ? { summary } : {}),
  };
}

/** Where to go to continue an interrupted session. */
export function resumeRoute(
  s: SessionRecord,
  today: string,
  days: TrainingDays,
  sessions: SessionRecord[],
): Route {
  switch (s.kind) {
    case 'morning': {
      const training = trainingFor(today, days);
      const done =
        training !== null && sessions.some((x) => x.kind === training && x.plannedDate === today && isComplete(x));
      return {
        name: 'morning',
        sessionId: s.id,
        next: training && !done ? { kind: training, plannedDate: today } : null,
      };
    }
    case 'kb':
    case 'z2':
    case 'z5':
      // Restarting a player at the end would finish at once and, for a ride, overwrite its trace.
      if (reachedEnd(s)) return { name: 'finish', sessionId: s.id };
      return s.kind === 'kb' ? { name: 'kb', sessionId: s.id } : { name: 'spin', sessionId: s.id };
  }
}
