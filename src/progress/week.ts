import type { SessionRecord } from '../model';
import { addDays, trainingFor, weekDates, weekStart, type TrainingDays } from '../program/schedule';
import type { TrainingKind } from '../program/types';
import { isComplete } from './session';

export type DayStatus = 'done' | 'moved' | 'partial' | 'missed' | 'today' | 'upcoming' | 'rest';

export interface WeekDay {
  date: string;
  training: TrainingKind | null;
  status: DayStatus;
  morningDone: boolean;
}

/** The finished (or, failing that, partial) session for a planned training day. */
export function trainingSessionFor(
  date: string,
  kind: TrainingKind,
  sessions: SessionRecord[],
): SessionRecord | undefined {
  const matches = sessions.filter((s) => s.kind === kind && s.plannedDate === date && s.status !== 'in_progress');
  return matches.find(isComplete) ?? matches[0];
}

/** The earliest planned date of any session; nothing before it counts as missed. */
export function firstDay(sessions: SessionRecord[]): string | null {
  return sessions.reduce<string | null>((min, s) => (min === null || s.plannedDate < min ? s.plannedDate : min), null);
}

function statusOf(
  date: string,
  today: string,
  since: string,
  training: TrainingKind | null,
  sessions: SessionRecord[],
): DayStatus {
  if (!training) return 'rest';
  const s = trainingSessionFor(date, training, sessions);
  if (s && s.status !== 'in_progress') return s.status;
  if (date < today) return date < since ? 'rest' : 'missed';
  return date === today ? 'today' : 'upcoming';
}

export function weekView(today: string, days: TrainingDays, sessions: SessionRecord[]): WeekDay[] {
  const since = firstDay(sessions) ?? today;
  return weekDates(today).map((date) => {
    const training = trainingFor(date, days);
    return {
      date,
      training,
      status: statusOf(date, today, since, training, sessions),
      morningDone: sessions.some((s) => s.kind === 'morning' && s.plannedDate === date && s.status === 'done'),
    };
  });
}

function finishedTrainingIn(week: string, sessions: SessionRecord[]): number {
  return sessions.filter((s) => s.kind !== 'morning' && isComplete(s) && weekStart(s.plannedDate) === week).length;
}

export function sessionsThisWeek(today: string, sessions: SessionRecord[]): number {
  return finishedTrainingIn(weekStart(today), sessions);
}

export function plannedPerWeek(days: TrainingDays): number {
  return Object.values(days).filter(Boolean).length;
}

export function makeUpCandidates(
  today: string,
  days: TrainingDays,
  sessions: SessionRecord[],
): { date: string; kind: TrainingKind }[] {
  return weekView(today, days, sessions).flatMap((d) =>
    d.status === 'missed' && d.training ? [{ date: d.date, kind: d.training }] : [],
  );
}

export function weeklySessionCounts(
  today: string,
  sessions: SessionRecord[],
  weeks = 12,
): { weekStart: string; count: number }[] {
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(current, -7 * (weeks - 1 - i));
    return { weekStart: ws, count: finishedTrainingIn(ws, sessions) };
  });
}
