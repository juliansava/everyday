import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/model';
import { DEFAULT_TRAINING_DAYS } from '../../src/program/schedule';
import { resumeRoute } from '../../src/ui/flow';

const mk = (over: Partial<SessionRecord>): SessionRecord => ({
  id: 's', kind: 'morning', plannedDate: '2026-10-23', status: 'in_progress',
  startedAt: 0, stepIndex: 3, params: {}, ...over,
});

describe('resumeRoute', () => {
  it("resumes a morning routine and then runs the day's training", () => {
    expect(resumeRoute(mk({}), '2026-10-23', DEFAULT_TRAINING_DAYS, [])).toEqual({
      name: 'morning', sessionId: 's', next: { kind: 'kb', plannedDate: '2026-10-23' },
    });
  });

  it("doesn't chain training that's already done", () => {
    const kbDone = mk({ id: 'k', kind: 'kb', status: 'done' });
    expect(resumeRoute(mk({}), '2026-10-23', DEFAULT_TRAINING_DAYS, [kbDone])).toMatchObject({ next: null });
  });

  it('resumes a morning on a rest day without training', () => {
    expect(resumeRoute(mk({ plannedDate: '2026-10-24' }), '2026-10-24', DEFAULT_TRAINING_DAYS, [])).toMatchObject({
      next: null,
    });
  });

  it('resumes kettlebell and spin sessions in their players', () => {
    expect(resumeRoute(mk({ kind: 'kb' }), '2026-10-23', DEFAULT_TRAINING_DAYS, [])).toEqual({ name: 'kb', sessionId: 's' });
    expect(resumeRoute(mk({ kind: 'z5' }), '2026-10-22', DEFAULT_TRAINING_DAYS, [])).toEqual({ name: 'spin', sessionId: 's' });
  });
});
