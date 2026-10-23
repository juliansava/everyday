import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/model';
import { DEFAULT_TRAINING_DAYS } from '../../src/program/schedule';
import {
  makeUpCandidates,
  plannedPerWeek,
  sessionsThisWeek,
  weekView,
  weeklySessionCounts,
} from '../../src/progress/week';

let seq = 0;
const mk = (over: Partial<SessionRecord>): SessionRecord => ({
  id: `s${++seq}`, kind: 'kb', plannedDate: '2026-10-19', status: 'done',
  startedAt: seq, stepIndex: 0, params: {}, ...over,
});

const TODAY = '2026-10-23'; // Friday
const sessions: SessionRecord[] = [
  mk({ kind: 'kb', plannedDate: '2026-10-19', status: 'done' }),
  mk({ kind: 'kb', plannedDate: '2026-10-21', doneDate: '2026-10-22', status: 'moved' }),
  mk({ kind: 'z5', plannedDate: '2026-10-22', status: 'partial' }),
  mk({ kind: 'morning', plannedDate: '2026-10-19', status: 'done' }),
  mk({ kind: 'morning', plannedDate: '2026-10-23', status: 'done' }),
  mk({ kind: 'kb', plannedDate: '2026-10-16', status: 'done' }), // last week
];

describe('week view', () => {
  it('marks each day of the week', () => {
    const week = weekView(TODAY, DEFAULT_TRAINING_DAYS, sessions);
    expect(week.map((d) => d.status)).toEqual(['done', 'missed', 'moved', 'partial', 'today', 'rest', 'rest']);
    expect(week.map((d) => d.morningDone)).toEqual([true, false, false, false, true, false, false]);
    expect(week.map((d) => d.training)).toEqual(['kb', 'z2', 'kb', 'z5', 'kb', null, null]);
  });

  it('shows later days as upcoming', () => {
    const week = weekView('2026-10-20', DEFAULT_TRAINING_DAYS, [sessions[0]]); // Monday done
    expect(week.map((d) => d.status)).toEqual(['done', 'today', 'upcoming', 'upcoming', 'upcoming', 'rest', 'rest']);
  });

  it("doesn't count days before the first session as missed", () => {
    const week = weekView(TODAY, DEFAULT_TRAINING_DAYS, []);
    expect(week.map((d) => d.status)).toEqual(['rest', 'rest', 'rest', 'rest', 'today', 'rest', 'rest']);
    expect(makeUpCandidates(TODAY, DEFAULT_TRAINING_DAYS, [])).toEqual([]);
  });

  it('counts finished training sessions this week out of the planned 5', () => {
    expect(sessionsThisWeek(TODAY, sessions)).toBe(2);
    expect(plannedPerWeek(DEFAULT_TRAINING_DAYS)).toBe(5);
  });

  it('offers missed sessions from earlier this week as make-ups', () => {
    expect(makeUpCandidates(TODAY, DEFAULT_TRAINING_DAYS, sessions)).toEqual([{ date: '2026-10-20', kind: 'z2' }]);
  });

  it('counts finished sessions per week, oldest week first', () => {
    expect(weeklySessionCounts(TODAY, sessions, 2)).toEqual([
      { weekStart: '2026-10-12', count: 1 },
      { weekStart: '2026-10-19', count: 2 },
    ]);
  });
});
