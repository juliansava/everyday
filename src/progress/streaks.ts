import type { SessionRecord } from '../model';
import { addDays, daysBetween } from '../program/schedule';

export function morningStreak(today: string, sessions: SessionRecord[]): { current: number; best: number } {
  const done = new Set(
    sessions.filter((s) => s.kind === 'morning' && s.status === 'done').map((s) => s.plannedDate),
  );

  // Today not done yet doesn't break the streak; it starts counting from yesterday.
  let current = 0;
  let day = done.has(today) ? today : addDays(today, -1);
  while (done.has(day)) {
    current++;
    day = addDays(day, -1);
  }

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of [...done].sort()) {
    run = prev && daysBetween(prev, date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return { current, best: Math.max(best, current) };
}
