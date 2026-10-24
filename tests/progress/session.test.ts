import { describe, expect, it } from 'vitest';
import type { SessionRecord, SetRecord } from '../../src/model';
import {
  STALE_IN_PROGRESS_MS,
  completedStatus,
  kbTotalReps,
  newSession,
  resumable,
  routineFor,
  staleInProgress,
} from '../../src/progress/session';
import { totalSec } from '../../src/program/routines';

const NOW = 1_000_000_000;
const mk = (over: Partial<SessionRecord>): SessionRecord => ({
  id: 'x', kind: 'morning', plannedDate: '2026-10-23', status: 'done',
  startedAt: NOW, stepIndex: 0, params: {}, ...over,
});

describe('session helpers', () => {
  it('creates an in-progress session at step 0 with a unique id', () => {
    const a = newSession('kb', '2026-10-23', NOW, { roundRestSec: 90 });
    const b = newSession('kb', '2026-10-23', NOW);
    expect(a).toMatchObject({ kind: 'kb', plannedDate: '2026-10-23', status: 'in_progress', stepIndex: 0, startedAt: NOW });
    expect(a.id).not.toBe(b.id);
  });

  it('is "done" on its planned day and "moved" on any other day', () => {
    expect(completedStatus('2026-10-21', '2026-10-21')).toBe('done');
    expect(completedStatus('2026-10-21', '2026-10-24')).toBe('moved');
  });

  it('splits open sessions into resumable and stale (older than 12 h)', () => {
    const stale = mk({ id: 'stale', status: 'in_progress', startedAt: NOW - STALE_IN_PROGRESS_MS - 1 });
    const open = mk({ id: 'open', status: 'in_progress', startedAt: NOW - 3_600_000 });
    const done = mk({ id: 'done' });
    expect(staleInProgress([stale, open, done], NOW).map((s) => s.id)).toEqual(['stale']);
    expect(resumable([stale, open, done], NOW)?.id).toBe('open');
    expect(resumable([done], NOW)).toBeUndefined();
  });

  it('rebuilds the routine a session was planned with', () => {
    expect(routineFor(mk({ kind: 'morning' }))).toHaveLength(8);
    expect(totalSec(routineFor(mk({ kind: 'z2', params: { maxHr: 193, mainMin: 50 } })))).toBe(60 * 60);
    expect(totalSec(routineFor(mk({ kind: 'z5', params: { maxHr: 193 } })))).toBe(40 * 60);
    const kb = mk({
      kind: 'kb',
      params: {
        roundRestSec: 90,
        circuit: [
          { exerciseId: 'single-arm-swing', repsPerSide: 10, weightKg: 12 },
          { exerciseId: 'clean-and-press', repsPerSide: 10, weightKg: 8 },
          { exerciseId: 'around-world-lunge', repsPerSide: 10, weightKg: 8 },
          { exerciseId: 'renegade-row-push-up', repsPerSide: 5, weightKg: 8 },
        ],
      },
    });
    expect(routineFor(kb)).toHaveLength(17);
    expect(() => routineFor(mk({ kind: 'kb' }))).toThrow('has no circuit');
  });

  it('counts total reps, doubling per-side exercises', () => {
    const sets: SetRecord[] = [
      { id: 'a', sessionId: 's', exerciseId: 'single-arm-swing', block: 'circuit', round: 1, repsPerSide: 10, plannedRepsPerSide: 10, weightKg: 12, at: 0 },
      { id: 'b', sessionId: 's', exerciseId: 'bw-squat', block: 'warmup', round: 1, repsPerSide: 10, plannedRepsPerSide: 10, weightKg: null, at: 0 },
    ];
    expect(kbTotalReps(sets)).toBe(30);
  });
});
