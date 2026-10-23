import type { SessionKind, TrainingKind, Weekday } from './types';

export type TrainingDays = Record<Weekday, TrainingKind | null>;

export const DEFAULT_TRAINING_DAYS: TrainingDays = {
  0: 'kb',
  1: 'z2',
  2: 'kb',
  3: 'z5',
  4: 'kb',
  5: null,
  6: null,
};

const DAY_MS = 86_400_000;

// Date strings are calendar dates; doing the arithmetic in UTC avoids DST shifts.
function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, n: number): string {
  return fromUtcMs(toUtcMs(date) + n * DAY_MS);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

export function weekdayOf(date: string): Weekday {
  return ((new Date(toUtcMs(date)).getUTCDay() + 6) % 7) as Weekday;
}

export function weekStart(date: string): string {
  return addDays(date, -weekdayOf(date));
}

export function weekDates(date: string): string[] {
  const monday = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function trainingFor(date: string, days: TrainingDays): TrainingKind | null {
  return days[weekdayOf(date)];
}

export function plannedFor(date: string, days: TrainingDays): SessionKind[] {
  const training = trainingFor(date, days);
  return training ? ['morning', training] : ['morning'];
}
