import type { RoundRest, SessionRecord, SetRecord } from '../model';
import { EXERCISES } from '../program/exercises';
import { KB_ROUNDS, type CircuitEntry } from '../program/routines';
import { addDays, trainingFor, weekDates, weekStart, weekdayOf, type TrainingDays } from '../program/schedule';
import type { ExerciseId } from '../program/types';
import { isComplete } from './session';
import { firstDay } from './week';

export type SlotId = 'swing' | 'press' | 'lunge' | 'renegade';

export const SLOTS: SlotId[] = ['swing', 'press', 'lunge', 'renegade'];

export const SLOT_EXERCISES: Record<SlotId, ExerciseId[]> = {
  swing: ['single-arm-swing'],
  press: ['clean-and-press'],
  lunge: ['around-world-lunge'],
  renegade: ['renegade-row-push-up'],
};

export const REP_LADDER: Record<SlotId, number[]> = {
  swing: [10, 12, 15],
  press: [10, 12, 15],
  lunge: [10, 12, 15],
  renegade: [5, 6, 8],
};

/** Used in the Monday summary line. */
export const SLOT_LABEL: Record<SlotId, string> = {
  swing: 'Swings',
  press: 'Clean and press',
  lunge: 'Lunges',
  renegade: 'Renegade rows',
};

export const DEFAULT_CIRCUIT: CircuitEntry[] = [
  { exerciseId: 'single-arm-swing', repsPerSide: 10, weightKg: 12 },
  { exerciseId: 'clean-and-press', repsPerSide: 10, weightKg: 8 },
  { exerciseId: 'around-world-lunge', repsPerSide: 10, weightKg: 8 },
  { exerciseId: 'renegade-row-push-up', repsPerSide: 5, weightKg: 8 },
];

export const REST_STEPS: RoundRest[] = [90, 75, 60];

export function slotOf(id: ExerciseId): SlotId | null {
  return SLOTS.find((slot) => SLOT_EXERCISES[slot].includes(id)) ?? null;
}

const sorted = (bells: number[]) => [...bells].sort((a, b) => a - b);

export function nextStep(slot: SlotId, current: CircuitEntry, bellsKg: number[]): CircuitEntry | null {
  const bells = sorted(bellsKg);
  const reps = REP_LADDER[slot];
  const heavier = bells.find((b) => b > current.weightKg);
  if (heavier !== undefined) return { ...current, weightKg: heavier, repsPerSide: reps[0] };
  const moreReps = reps.find((r) => r > current.repsPerSide);
  return moreReps !== undefined ? { ...current, repsPerSide: moreReps } : null;
}

// ---------- History ----------

export interface KbHistoryItem {
  session: SessionRecord;
  sets: SetRecord[];
}

export function kbHistory(sessions: SessionRecord[], sets: SetRecord[]): KbHistoryItem[] {
  return sessions
    .filter((s) => s.kind === 'kb' && (isComplete(s) || s.status === 'partial'))
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) => ({ session, sets: sets.filter((x) => x.sessionId === session.id) }));
}

function slotSets(slot: SlotId, item: KbHistoryItem): SetRecord[] {
  return item.sets.filter((s) => s.block === 'circuit' && SLOT_EXERCISES[slot].includes(s.exerciseId));
}

export function stepUsed(slot: SlotId, item: KbHistoryItem): CircuitEntry | null {
  const first = slotSets(slot, item)[0];
  if (!first || first.weightKg === null) return null;
  return { exerciseId: first.exerciseId, weightKg: first.weightKg, repsPerSide: first.plannedRepsPerSide };
}

const sameStep = (a: CircuitEntry, b: CircuitEntry) =>
  a.exerciseId === b.exerciseId && a.weightKg === b.weightKg && a.repsPerSide === b.repsPerSide;

/** All rounds done at the planned reps with the planned bell, and the session rated Easy or Right. */
export function isClean(slot: SlotId, item: KbHistoryItem): boolean {
  const rating = item.session.rating;
  if (rating !== 'easy' && rating !== 'right') return false;
  const sets = slotSets(slot, item);
  const step = stepUsed(slot, item);
  if (!step || sets.length < KB_ROUNDS) return false;
  return sets.every(
    (s) => s.repsPerSide >= s.plannedRepsPerSide && s.weightKg === step.weightKg && s.exerciseId === step.exerciseId,
  );
}

/** Consecutive clean sessions at the newest step, counting back from the newest session. */
export function cleanCount(slot: SlotId, history: KbHistoryItem[]): { step: CircuitEntry | null; count: number } {
  let step: CircuitEntry | null = null;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const used = stepUsed(slot, history[i]);
    if (!step) step = used;
    if (!used || !step || !sameStep(used, step) || !isClean(slot, history[i])) break;
    count++;
  }
  return { step, count };
}

function ownedOrLighter(weightKg: number, bellsKg: number[]): number {
  const bells = sorted(bellsKg);
  return [...bells].reverse().find((b) => b <= weightKg) ?? bells[0];
}

export function currentCircuit(history: KbHistoryItem[], bellsKg: number[]): CircuitEntry[] {
  return SLOTS.map((slot, i) => {
    for (let j = history.length - 1; j >= 0; j--) {
      const used = stepUsed(slot, history[j]);
      if (used) return used;
    }
    const d = DEFAULT_CIRCUIT[i];
    return { ...d, weightKg: ownedOrLighter(d.weightKg, bellsKg) };
  });
}

// ---------- Suggestions ----------

export type Suggestion =
  | { kind: 'step'; slot: SlotId; from: CircuitEntry; to: CircuitEntry }
  | { kind: 'ladder-end'; slot: SlotId; current: CircuitEntry }
  | { kind: 'rest'; fromSec: RoundRest; toSec: RoundRest };

export function suggestions(history: KbHistoryItem[], bellsKg: number[], roundRestSec: RoundRest): Suggestion[] {
  const out: Suggestion[] = [];
  for (const slot of SLOTS) {
    const { step, count } = cleanCount(slot, history);
    if (!step || count < 2) continue;
    const to = nextStep(slot, step, bellsKg);
    out.push(to ? { kind: 'step', slot, from: step, to } : { kind: 'ladder-end', slot, current: step });
  }

  const top = Math.max(...bellsKg);
  const circuit = currentCircuit(history, bellsKg);
  const allAtTop = circuit.every((c) => c.weightKg >= top);
  const lastTwo = history.slice(-2);
  // Both of the last two sessions must be clean at the current step for every slot, i.e. fully at the top bell.
  const lastTwoAtTop =
    lastTwo.length === 2 &&
    lastTwo.every(
      (item) =>
        item.session.params.roundRestSec === roundRestSec &&
        SLOTS.every((slot, k) => {
          const used = stepUsed(slot, item);
          return used !== null && sameStep(used, circuit[k]) && isClean(slot, item);
        }),
    );
  const i = REST_STEPS.indexOf(roundRestSec);
  if (allAtTop && lastTwoAtTop && i >= 0 && i < REST_STEPS.length - 1) {
    out.push({ kind: 'rest', fromSec: roundRestSec, toSec: REST_STEPS[i + 1] });
  }
  return out;
}

export function applyStep(circuit: CircuitEntry[], s: Extract<Suggestion, { kind: 'step' }>): CircuitEntry[] {
  return circuit.map((c) => (slotOf(c.exerciseId) === s.slot ? { ...s.to } : c));
}

export function describeSuggestion(s: Suggestion): string {
  if (s.kind === 'rest') return `Rest between rounds: cut to ${s.toSec} s`;
  if (s.kind === 'ladder-end') return `${EXERCISES[s.current.exerciseId].name}: ready for a heavier bell`;
  const to = `${s.to.weightKg} kg × ${s.to.repsPerSide} per side`;
  return `${EXERCISES[s.from.exerciseId].name}: move up to ${to}`;
}

export function slotHistory(
  slot: SlotId,
  history: KbHistoryItem[],
): { date: string; exerciseId: ExerciseId; weightKg: number; repsPerSide: number }[] {
  return history.flatMap((item) => {
    const used = stepUsed(slot, item);
    return used ? [{ date: item.session.plannedDate, ...used }] : [];
  });
}

// ---------- Monday summary ----------

export function lastWeekLine(
  today: string,
  days: TrainingDays,
  sessions: SessionRecord[],
  sets: SetRecord[],
  bellsKg: number[],
): string | null {
  if (weekdayOf(today) !== 0) return null;
  const lastMonday = addDays(today, -7);
  // Only days since the first session count, so a first part-week isn't reported as missed.
  const since = firstDay(sessions) ?? today;
  const planned = weekDates(lastMonday).filter((date) => date >= since && trainingFor(date, days)).length;
  if (planned === 0) return null;
  const done = sessions.filter(
    (s) => s.kind !== 'morning' && isComplete(s) && weekStart(s.plannedDate) === lastMonday,
  ).length;
  let line = `Last week: ${done} of ${planned}.`;

  const history = kbHistory(sessions, sets);
  const before = history.filter((h) => h.session.plannedDate < lastMonday);
  const through = history.filter((h) => h.session.plannedDate < today);
  if (before.length > 0) {
    const a = currentCircuit(before, bellsKg);
    const b = currentCircuit(through, bellsKg);
    SLOTS.forEach((slot, i) => {
      if (b[i].exerciseId !== a[i].exerciseId) {
        line += ` ${EXERCISES[b[i].exerciseId].name} replaces ${EXERCISES[a[i].exerciseId].name.toLowerCase()}.`;
      } else if (b[i].weightKg > a[i].weightKg) {
        line += ` ${SLOT_LABEL[slot]} moved up to ${b[i].weightKg} kg.`;
      }
    });
  }
  return line;
}
