import { describe, expect, it } from 'vitest';
import type { Rating, SessionRecord, SetRecord } from '../../src/model';
import type { CircuitEntry } from '../../src/program/routines';
import { DEFAULT_TRAINING_DAYS } from '../../src/program/schedule';
import {
  DEFAULT_CIRCUIT,
  applyStep,
  cleanCount,
  currentCircuit,
  describeSuggestion,
  kbHistory,
  lastWeekLine,
  nextStep,
  slotHistory,
  suggestions,
} from '../../src/progress/ladder';

const BELLS = [8, 12, 16];

describe('nextStep', () => {
  it('moves to the next owned bell at base reps', () => {
    expect(nextStep('swing', { exerciseId: 'single-arm-swing', weightKg: 12, repsPerSide: 10 }, BELLS))
      .toEqual({ exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 10 });
  });

  it('adds reps once at the heaviest bell, then ends', () => {
    const at16 = { exerciseId: 'clean-and-press' as const, weightKg: 16, repsPerSide: 10 };
    expect(nextStep('press', at16, BELLS)).toEqual({ ...at16, repsPerSide: 12 });
    expect(nextStep('press', { ...at16, repsPerSide: 12 }, BELLS)).toEqual({ ...at16, repsPerSide: 15 });
    expect(nextStep('press', { ...at16, repsPerSide: 15 }, BELLS)).toBeNull();
  });

  it('moves from the low windmill to the overhead windmill with the lightest bell', () => {
    expect(nextStep('windmill', { exerciseId: 'low-windmill', weightKg: 12, repsPerSide: 10 }, BELLS))
      .toEqual({ exerciseId: 'overhead-windmill', weightKg: 8, repsPerSide: 10 });
  });

  it('uses 5 → 6 → 8 reps per side for renegade rows', () => {
    const at16 = { exerciseId: 'renegade-row-push-up' as const, weightKg: 16, repsPerSide: 5 };
    expect(nextStep('renegade', at16, BELLS)).toEqual({ ...at16, repsPerSide: 6 });
    expect(nextStep('renegade', { ...at16, repsPerSide: 8 }, BELLS)).toBeNull();
  });

  it('picks up a newly added heavier bell', () => {
    expect(nextStep('swing', { exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 15 }, [8, 12, 16, 20]))
      .toEqual({ exerciseId: 'single-arm-swing', weightKg: 20, repsPerSide: 10 });
  });
});

// ---- history fixtures ----

let seq = 0;

/** A finished KB session with all planned reps done, except where `missed` says otherwise. */
function kbSession(
  circuit: CircuitEntry[],
  opts: { rating?: Rating; date?: string; rest?: number; missed?: string[] } = {},
): { session: SessionRecord; sets: SetRecord[] } {
  const id = `kb${++seq}`;
  const session: SessionRecord = {
    id, kind: 'kb', plannedDate: opts.date ?? '2026-10-19', status: 'done', startedAt: seq,
    stepIndex: 0, rating: opts.rating ?? 'right',
    params: { circuit, roundRestSec: opts.rest ?? 90 },
  };
  const sets: SetRecord[] = [];
  for (let round = 1; round <= 3; round++) {
    for (const c of circuit) {
      const short = opts.missed?.includes(c.exerciseId) && round === 3;
      sets.push({
        id: `${id}-${round}-${c.exerciseId}`, sessionId: id, exerciseId: c.exerciseId, block: 'circuit', round,
        repsPerSide: short ? c.repsPerSide - 2 : c.repsPerSide, plannedRepsPerSide: c.repsPerSide,
        weightKg: c.weightKg, at: seq,
      });
    }
  }
  return { session, sets };
}

function history(...items: { session: SessionRecord; sets: SetRecord[] }[]) {
  return kbHistory(items.map((i) => i.session), items.flatMap((i) => i.sets));
}

describe('suggestions', () => {
  it('suggests the next step after two clean sessions at the same step', () => {
    const h = history(kbSession(DEFAULT_CIRCUIT), kbSession(DEFAULT_CIRCUIT));
    expect(cleanCount('swing', h).count).toBe(2);
    expect(suggestions(h, BELLS, 90)).toContainEqual({
      kind: 'step', slot: 'swing',
      from: { exerciseId: 'single-arm-swing', weightKg: 12, repsPerSide: 10 },
      to: { exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 10 },
    });
  });

  it('waits after only one clean session', () => {
    expect(suggestions(history(kbSession(DEFAULT_CIRCUIT)), BELLS, 90)).toEqual([]);
  });

  it('resets every exercise after a session rated Hard', () => {
    const h = history(kbSession(DEFAULT_CIRCUIT), kbSession(DEFAULT_CIRCUIT, { rating: 'hard' }));
    expect(suggestions(h, BELLS, 90)).toEqual([]);
  });

  it('resets only the exercise with missed reps', () => {
    const h = history(kbSession(DEFAULT_CIRCUIT), kbSession(DEFAULT_CIRCUIT, { missed: ['clean-and-press'] }));
    const slots = suggestions(h, BELLS, 90).map((s) => ('slot' in s ? s.slot : s.kind));
    expect(slots).toEqual(['swing', 'windmill', 'renegade']);
  });

  it('reports the end of a ladder', () => {
    const top: CircuitEntry[] = DEFAULT_CIRCUIT.map((c) =>
      c.exerciseId === 'single-arm-swing' ? { ...c, weightKg: 16, repsPerSide: 15 } : c,
    );
    const h = history(kbSession(top), kbSession(top));
    expect(suggestions(h, BELLS, 90)).toContainEqual({
      kind: 'ladder-end', slot: 'swing',
      current: { exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 15 },
    });
  });

  it('names the exercise on the ladder end, here the overhead windmill', () => {
    const overhead: CircuitEntry[] = DEFAULT_CIRCUIT.map((c) =>
      c.exerciseId === 'low-windmill' ? { exerciseId: 'overhead-windmill', weightKg: 16, repsPerSide: 15 } : c,
    );
    const h = history(kbSession(overhead), kbSession(overhead));
    expect(suggestions(h, BELLS, 90).filter((s) => s.kind === 'ladder-end').map(describeSuggestion))
      .toEqual(['Windmill: ready for a heavier bell']);
  });

  it('suggests shorter rest once every exercise is at the heaviest bell', () => {
    const top: CircuitEntry[] = [
      { exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 12 },
      { exerciseId: 'clean-and-press', weightKg: 16, repsPerSide: 10 },
      { exerciseId: 'overhead-windmill', weightKg: 16, repsPerSide: 10 },
      { exerciseId: 'renegade-row-push-up', weightKg: 16, repsPerSide: 5 },
    ];
    const h = history(kbSession(top), kbSession(top));
    expect(suggestions(h, BELLS, 90)).toContainEqual({ kind: 'rest', fromSec: 90, toSec: 75 });
    // Right after accepting 75 s, the sessions at 90 s don't count yet.
    expect(suggestions(h, BELLS, 75).some((s) => s.kind === 'rest')).toBe(false);
    const h2 = history(kbSession(top, { rest: 75 }), kbSession(top, { rest: 75 }));
    expect(suggestions(h2, BELLS, 75)).toContainEqual({ kind: 'rest', fromSec: 75, toSec: 60 });
    expect(suggestions(history(kbSession(top, { rest: 60 }), kbSession(top, { rest: 60 })), BELLS, 60)
      .some((s) => s.kind === 'rest')).toBe(false);
  });

  it('needs both of the last two sessions fully at the top bell before suggesting shorter rest', () => {
    const top: CircuitEntry[] = [
      { exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 12 },
      { exerciseId: 'clean-and-press', weightKg: 16, repsPerSide: 10 },
      { exerciseId: 'overhead-windmill', weightKg: 16, repsPerSide: 10 },
      { exerciseId: 'renegade-row-push-up', weightKg: 16, repsPerSide: 5 },
    ];
    const renegadeAt12: CircuitEntry[] = top.map((c) =>
      c.exerciseId === 'renegade-row-push-up' ? { ...c, weightKg: 12 } : c,
    );
    // One all-top session after a clean session with renegade rows at 12 kg is not enough yet.
    expect(suggestions(history(kbSession(renegadeAt12), kbSession(top)), BELLS, 90)
      .some((s) => s.kind === 'rest')).toBe(false);
    // A second all-top clean session makes the last two both fully at the top.
    expect(suggestions(history(kbSession(renegadeAt12), kbSession(top), kbSession(top)), BELLS, 90))
      .toContainEqual({ kind: 'rest', fromSec: 90, toSec: 75 });
  });

  it('describes suggestions in plain words', () => {
    expect(describeSuggestion({
      kind: 'step', slot: 'swing',
      from: { exerciseId: 'single-arm-swing', weightKg: 12, repsPerSide: 10 },
      to: { exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 10 },
    })).toBe('Single-arm swing: move up to 16 kg × 10 per side');
    expect(describeSuggestion({
      kind: 'ladder-end', slot: 'press',
      current: { exerciseId: 'clean-and-press', weightKg: 16, repsPerSide: 15 },
    }))
      .toBe('Clean and press: ready for a heavier bell');
    expect(describeSuggestion({ kind: 'rest', fromSec: 90, toSec: 75 }))
      .toBe('Rest between rounds: cut to 75 s');
  });
});

describe('current circuit', () => {
  it('starts from the default circuit', () => {
    expect(currentCircuit([], BELLS)).toEqual(DEFAULT_CIRCUIT);
  });

  it('uses the latest bells and reps for each exercise', () => {
    const later = DEFAULT_CIRCUIT.map((c) => (c.exerciseId === 'single-arm-swing' ? { ...c, weightKg: 16 } : c));
    const h = history(kbSession(DEFAULT_CIRCUIT), kbSession(later));
    expect(currentCircuit(h, BELLS)[0]).toEqual({ exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 10 });
  });

  it('clamps default bells you do not own to the nearest lighter one', () => {
    expect(currentCircuit([], [8, 10])[0]).toEqual({ exerciseId: 'single-arm-swing', weightKg: 10, repsPerSide: 10 });
  });

  it('applies an accepted step to the circuit', () => {
    const next = applyStep(DEFAULT_CIRCUIT, {
      kind: 'step', slot: 'windmill',
      from: DEFAULT_CIRCUIT[2],
      to: { exerciseId: 'overhead-windmill', weightKg: 8, repsPerSide: 10 },
    });
    expect(next[2]).toEqual({ exerciseId: 'overhead-windmill', weightKg: 8, repsPerSide: 10 });
    expect(next[0]).toEqual(DEFAULT_CIRCUIT[0]);
  });

  it('lists the bell and reps used for one exercise over time', () => {
    const later = DEFAULT_CIRCUIT.map((c) => (c.exerciseId === 'single-arm-swing' ? { ...c, weightKg: 16 } : c));
    const h = history(kbSession(DEFAULT_CIRCUIT, { date: '2026-10-19' }), kbSession(later, { date: '2026-10-21' }));
    expect(slotHistory('swing', h)).toEqual([
      { date: '2026-10-19', exerciseId: 'single-arm-swing', weightKg: 12, repsPerSide: 10 },
      { date: '2026-10-21', exerciseId: 'single-arm-swing', weightKg: 16, repsPerSide: 10 },
    ]);
  });
});

describe('last-week line', () => {
  it('summarises last week on Mondays only', () => {
    const before = kbSession(DEFAULT_CIRCUIT, { date: '2026-10-12' });
    const later = DEFAULT_CIRCUIT.map((c) => (c.exerciseId === 'single-arm-swing' ? { ...c, weightKg: 16 } : c));
    const during = kbSession(later, { date: '2026-10-21' });
    const sessions = [before.session, during.session];
    const sets = [...before.sets, ...during.sets];
    expect(lastWeekLine('2026-10-26', DEFAULT_TRAINING_DAYS, sessions, sets, BELLS))
      .toBe('Last week: 1 of 5. Swings moved up to 16 kg.');
    expect(lastWeekLine('2026-10-27', DEFAULT_TRAINING_DAYS, sessions, sets, BELLS)).toBeNull();
  });
});
