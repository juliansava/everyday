import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openStore } from '../../src/db/store';
import type { SessionRecord } from '../../src/model';
import { DEFAULT_TRAINING_DAYS } from '../../src/program/schedule';
import { partialSummary, resumeRoute } from '../../src/ui/flow';

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

describe('partialSummary', () => {
  it("summarises an interrupted ride from its stored trace so it still counts", async () => {
    const store = await openStore('flow-test');
    const ride = mk({ id: 'r', kind: 'z2', params: { maxHr: 193, mainMin: 45 } });
    await store.putTrace({ sessionId: 'r', startedAt: 0, bpm: new Array(3300).fill(125) });
    expect((await partialSummary(store, ride))?.timeInZoneSec).toBe(2700);
  });

  it('has no summary for kettlebell sessions or a ride without a trace', async () => {
    const store = await openStore('flow-test');
    expect(await partialSummary(store, mk({ kind: 'kb' }))).toBeUndefined();
    expect((await partialSummary(store, mk({ id: 'none', kind: 'z5', params: { maxHr: 193 } })))?.durationSec).toBe(0);
  });
});
