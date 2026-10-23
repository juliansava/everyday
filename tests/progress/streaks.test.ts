import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/model';
import { morningStreak } from '../../src/progress/streaks';

const mornings = (...dates: string[]): SessionRecord[] =>
  dates.map((plannedDate, i) => ({
    id: `m${i}`, kind: 'morning', plannedDate, status: 'done', startedAt: i, stepIndex: 0, params: {},
  }));

describe('morning streak', () => {
  it('counts consecutive days up to today', () => {
    expect(morningStreak('2026-10-23', mornings('2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23')))
      .toEqual({ current: 4, best: 4 });
  });

  it('keeps the streak alive until today is over', () => {
    expect(morningStreak('2026-10-23', mornings('2026-10-21', '2026-10-22')).current).toBe(2);
  });

  it('resets after a missed day but remembers the best run', () => {
    const s = mornings('2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-20', '2026-10-21');
    expect(morningStreak('2026-10-23', s)).toEqual({ current: 0, best: 4 });
  });

  it('ignores unfinished mornings', () => {
    const s = mornings('2026-10-22', '2026-10-23');
    s[1].status = 'partial';
    expect(morningStreak('2026-10-23', s).current).toBe(1);
  });
});
