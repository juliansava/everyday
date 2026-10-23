import type { SessionRecord } from '../model';
import type { CircuitEntry } from '../program/routines';
import type { TrainingKind } from '../program/types';
import { nextZone2MainMin } from '../progress/cardio';
import { completedStatus, newSession } from '../progress/session';
import type { AppData, Next } from './data';

export async function beginMorning(d: AppData, next: Next): Promise<void> {
  const s = newSession('morning', d.today, Date.now());
  await d.store.putSession(s);
  await d.reload();
  d.go({ name: 'morning', sessionId: s.id, next });
}

/** Opens the start screen; the session itself is only created when the user taps Start there. */
export async function beginTraining(d: AppData, kind: TrainingKind, plannedDate: string): Promise<void> {
  d.go(kind === 'kb' ? { name: 'kb-start', plannedDate } : { name: 'spin-start', kind, plannedDate });
}

export async function beginSpin(d: AppData, kind: 'z2' | 'z5', plannedDate: string): Promise<void> {
  const params =
    kind === 'z2'
      ? { maxHr: d.settings.maxHr, mainMin: nextZone2MainMin(d.sessions) }
      : { maxHr: d.settings.maxHr };
  const s = newSession(kind, plannedDate, Date.now(), params);
  await d.store.putSession(s);
  await d.reload();
  d.go({ name: 'spin', sessionId: s.id });
}

export async function beginKb(d: AppData, plannedDate: string, circuit: CircuitEntry[]): Promise<void> {
  const s = newSession('kb', plannedDate, Date.now(), { circuit, roundRestSec: d.settings.roundRestSec });
  await d.store.putSession(s);
  await d.reload();
  d.go({ name: 'kb', sessionId: s.id });
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
