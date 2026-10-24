import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openStore } from '../../src/db/store';
import type { SessionRecord } from '../../src/model';
import { DEFAULT_TRAINING_DAYS } from '../../src/program/schedule';
import { DEFAULT_CIRCUIT } from '../../src/progress/ladder';
import { routineFor } from '../../src/progress/session';
import { closeInterrupted, partialSummary, reachedEnd, resumeRoute } from '../../src/ui/flow';

const KB = { circuit: DEFAULT_CIRCUIT, roundRestSec: 90 };
/** 18:00 local time on 2026-10-20. */
const EVENING = new Date(2026, 9, 20, 18).getTime();

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
    expect(resumeRoute(mk({ kind: 'kb', params: KB }), '2026-10-23', DEFAULT_TRAINING_DAYS, [])).toEqual({ name: 'kb', sessionId: 's' });
    expect(resumeRoute(mk({ kind: 'z5' }), '2026-10-22', DEFAULT_TRAINING_DAYS, [])).toEqual({ name: 'spin', sessionId: 's' });
  });

  it('goes straight to Finish for a session that reached the end of its routine', () => {
    const ride = mk({ kind: 'z2', stepIndex: 1, params: { maxHr: 193, mainMin: 45 } });
    const rideAtEnd = { ...ride, stepIndex: routineFor(ride).length };
    const kb = mk({ kind: 'kb', params: KB });
    const kbAtEnd = { ...kb, stepIndex: routineFor(kb).length };
    expect(reachedEnd(rideAtEnd)).toBe(true);
    expect(reachedEnd(ride)).toBe(false);
    expect(resumeRoute(rideAtEnd, '2026-10-23', DEFAULT_TRAINING_DAYS, [])).toEqual({ name: 'finish', sessionId: 's' });
    expect(resumeRoute(kbAtEnd, '2026-10-23', DEFAULT_TRAINING_DAYS, [])).toEqual({ name: 'finish', sessionId: 's' });
    expect(resumeRoute({ ...kbAtEnd, stepIndex: 99 }, '2026-10-23', DEFAULT_TRAINING_DAYS, [])).toEqual({
      name: 'finish', sessionId: 's',
    });
  });
});

describe('closeInterrupted', () => {
  const ride = mk({ id: 'ride', kind: 'z2', plannedDate: '2026-10-20', startedAt: EVENING, params: { maxHr: 193, mainMin: 45 } });
  const rideLength = 3300;

  it('files a ride that reached its end as done, keeping its trace and summary', async () => {
    const store = await openStore('close-ride');
    await store.putTrace({ sessionId: 'ride', startedAt: EVENING, bpm: new Array(rideLength).fill(125) });
    const atEnd = { ...ride, stepIndex: routineFor(ride).length };
    await store.putSession(atEnd);
    const closed = await closeInterrupted(store, atEnd, EVENING + 3600_000);
    expect(closed).toMatchObject({ status: 'done', doneDate: '2026-10-20' });
    expect(closed.summary?.timeInZoneSec).toBe(2700);
    expect((await store.getTrace('ride'))?.bpm).toHaveLength(rideLength);
  });

  it('files a finished make-up session as moved to the day it was done', async () => {
    const store = await openStore('close-moved');
    const atEnd = { ...ride, plannedDate: '2026-10-19', stepIndex: routineFor(ride).length };
    expect(await closeInterrupted(store, atEnd, EVENING)).toMatchObject({ status: 'moved', doneDate: '2026-10-20' });
  });

  it('files a ride stopped part-way as partial with what its trace shows', async () => {
    const store = await openStore('close-partial');
    await store.putTrace({ sessionId: 'ride', startedAt: EVENING, bpm: new Array(1200).fill(125) });
    const closed = await closeInterrupted(store, { ...ride, stepIndex: 1 }, EVENING);
    expect(closed).toMatchObject({ status: 'partial', endedAt: EVENING });
    expect(closed.summary?.durationSec).toBe(1200);
  });

  it('files a finished kettlebell session as done with its reps and time', async () => {
    const store = await openStore('close-kb');
    const kb = mk({ id: 'kb', kind: 'kb', plannedDate: '2026-10-20', startedAt: EVENING, params: KB });
    await store.addSet({
      id: 'x', sessionId: 'kb', exerciseId: 'single-arm-swing', block: 'circuit', round: 1,
      repsPerSide: 10, plannedRepsPerSide: 10, weightKg: 12, at: EVENING + 60_000,
    });
    const atEnd = { ...kb, stepIndex: routineFor(kb).length, endedAt: EVENING + 1800_000 };
    expect(await closeInterrupted(store, atEnd, EVENING + 7200_000)).toMatchObject({
      status: 'done', doneDate: '2026-10-20', endedAt: EVENING + 1800_000,
      summary: { totalReps: 20, durationSec: 1800 },
    });
    expect(await closeInterrupted(store, { ...kb, stepIndex: 4 }, EVENING)).toMatchObject({ status: 'partial' });
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
