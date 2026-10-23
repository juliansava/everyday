import { EXERCISES } from './exercises';
import { zone2, zone5 } from './zones';
import type { Cue, ExerciseId, Range, SpinPhase, Step, TapItem, TapStep, TimedStep } from './types';

const nameOf = (id: ExerciseId) => EXERCISES[id].name;

// ---------- Morning ----------

interface MorningItem {
  id: ExerciseId;
  sec: number;
  detail: string;
  switchAt?: number;
}

const MORNING: MorningItem[] = [
  { id: 'lymphatic-hops', sec: 40, detail: EXERCISES['lymphatic-hops'].cue },
  { id: 'trunk-twists', sec: 30, detail: EXERCISES['trunk-twists'].cue },
  { id: 'worlds-greatest-stretch', sec: 60, switchAt: 30, detail: 'Left side first, switch at 0:30' },
  { id: 'cossack-squat', sec: 40, detail: 'Alternate sides' },
  { id: 'deep-squat-hold', sec: 40, detail: EXERCISES['deep-squat-hold'].cue },
  { id: 'hurdler-stretch', sec: 40, switchAt: 20, detail: 'Left leg straight first, switch at 0:20' },
  { id: 'deep-breaths', sec: 50, detail: '4 seconds in, 6 seconds out' },
];

export const MORNING_READY_ID = 'm-ready';

/** 10 s per breath: "In" on the 10s (the first one is in the opening cue), "Out" 4 s later. */
function breathCues(sec: number): Cue[] {
  const cues: Cue[] = [];
  for (let t = 0; t < sec; t += 10) {
    if (t > 0) cues.push({ at: t, say: 'In' });
    cues.push({ at: t + 4, say: 'Out' });
  }
  return cues;
}

export function morningRoutine(): TimedStep[] {
  const first = MORNING[0];
  const steps: TimedStep[] = [
    {
      kind: 'timed',
      id: MORNING_READY_ID,
      title: 'Get ready',
      detail: `First: ${nameOf(first.id)}`,
      exerciseId: first.id,
      durationSec: 5,
      cues: [{ at: 0, say: `Get ready. ${nameOf(first.id)}` }],
    },
  ];
  MORNING.forEach((item, i) => {
    const next = MORNING[i + 1];
    const breaths = item.id === 'deep-breaths';
    const cues: Cue[] = [{ at: 0, say: breaths ? 'Deep breaths. Breathe in' : nameOf(item.id) }];
    if (item.switchAt) cues.push({ at: item.switchAt, say: 'Switch sides' });
    if (breaths) cues.push(...breathCues(item.sec));
    if (next) cues.push({ at: item.sec - 5, say: `Next: ${nameOf(next.id)}` });
    steps.push({
      kind: 'timed',
      id: `m-${item.id}`,
      title: nameOf(item.id),
      detail: item.detail,
      exerciseId: item.id,
      durationSec: item.sec,
      cues,
    });
  });
  return steps;
}

// ---------- Kettlebell ----------

export interface CircuitEntry {
  exerciseId: ExerciseId;
  repsPerSide: number;
  weightKg: number;
}

export interface KbPlan {
  circuit: CircuitEntry[];
  roundRestSec: number;
}

export const WARMUP_ROUNDS = 2;
export const KB_ROUNDS = 3;
export const BELLS_SEC = 60;

const WARMUP_ITEMS: TapItem[] = [
  { exerciseId: 'bw-squat', reps: 10 },
  { exerciseId: 'push-up', reps: 10 },
  { exerciseId: 'halo', reps: 10 },
];

const WARMUP_SPOKEN: Partial<Record<ExerciseId, string>> = {
  'bw-squat': 'squats',
  'push-up': 'push-ups',
  halo: 'halos',
};

export function kbRoutine(plan: KbPlan): Step[] {
  const steps: Step[] = [];
  for (let round = 1; round <= WARMUP_ROUNDS; round++) {
    steps.push({
      kind: 'tap',
      id: `wu-${round}`,
      title: `Warm-up round ${round} of ${WARMUP_ROUNDS}`,
      block: 'warmup',
      round,
      items: WARMUP_ITEMS.map((item) => ({ ...item })),
      weightKg: null,
    });
  }

  const firstName = nameOf(plan.circuit[0].exerciseId);
  steps.push({
    kind: 'timed',
    id: 'bells',
    title: 'Get your bells',
    detail: plan.circuit.map((c) => `${nameOf(c.exerciseId)} ${c.weightKg} kg`).join(' · '),
    durationSec: BELLS_SEC,
    cues: [
      { at: 0, say: 'Get your bells' },
      { at: BELLS_SEC - 5, say: `Next: ${firstName}` },
    ],
  });

  for (let round = 1; round <= KB_ROUNDS; round++) {
    plan.circuit.forEach((c, i) => {
      steps.push({
        kind: 'tap',
        id: `c-${round}-${i}`,
        title: nameOf(c.exerciseId),
        block: 'circuit',
        round,
        items: [{ exerciseId: c.exerciseId, reps: c.repsPerSide }],
        weightKg: c.weightKg,
      });
    });
    if (round < KB_ROUNDS) {
      steps.push({
        kind: 'timed',
        id: `rest-${round}`,
        title: 'Rest',
        detail: `Next: round ${round + 1} of ${KB_ROUNDS}`,
        durationSec: plan.roundRestSec,
        cues: [
          { at: 0, say: `Round ${round} done. Rest` },
          { at: plan.roundRestSec - 5, say: `Round ${round + 1}. ${firstName}` },
        ],
      });
    }
  }
  return steps;
}

/** What the voice says when a tap step begins. */
export function announce(step: TapStep): string {
  if (step.block === 'warmup') {
    const parts = step.items.map((i) => `${i.reps} ${WARMUP_SPOKEN[i.exerciseId] ?? nameOf(i.exerciseId)}`);
    return `Warm-up round ${step.round}. ${parts.join(', ')}`;
  }
  const item = step.items[0];
  const reps = EXERCISES[item.exerciseId].perSide ? `${item.reps} per side` : `${item.reps}`;
  return `${step.title}. ${reps}. ${step.weightKg} kilos`;
}

// ---------- Spin ----------

export const Z2_START_MAIN_MIN = 45;
export const Z2_MAX_MAIN_MIN = 60;
export const Z2_STEP_MIN = 5;
export const Z5_INTERVALS = 4;

function spinStep(
  id: string,
  title: string,
  phase: SpinPhase,
  durationSec: number,
  target: Range | null,
  startSay: string,
  nextTitle?: string,
): TimedStep {
  const cues: Cue[] = [{ at: 0, say: startSay }];
  if (nextTitle) cues.push({ at: durationSec - 5, say: `In 5 seconds: ${nextTitle}` });
  return {
    kind: 'timed',
    id,
    title,
    phase,
    durationSec,
    target,
    cues,
    detail: target ? `Target ${target.low}–${target.high} bpm` : 'No target, easy spin',
  };
}

export function z2Routine(maxHr: number, mainMin: number): TimedStep[] {
  const z = zone2(maxHr);
  return [
    spinStep('z2-warmup', 'Easy warm-up', 'warmup', 5 * 60, null, 'Easy warm-up. 5 minutes', 'Zone 2'),
    spinStep('z2-main', 'Zone 2', 'main', mainMin * 60, z, `Zone 2. ${z.low} to ${z.high}`, 'Cool-down'),
    spinStep('z2-cooldown', 'Cool-down', 'cooldown', 5 * 60, null, 'Cool-down. 5 minutes'),
  ];
}

export function z5Routine(maxHr: number): TimedStep[] {
  const z = zone5(maxHr);
  const steps: TimedStep[] = [
    spinStep('z5-warmup', 'Warm-up', 'warmup', 10 * 60, null, 'Warm-up. 10 minutes easy', `Interval 1 of ${Z5_INTERVALS}`),
  ];
  for (let i = 1; i <= Z5_INTERVALS; i++) {
    const last = i === Z5_INTERVALS;
    steps.push(
      spinStep(`z5-hard-${i}`, `Interval ${i} of ${Z5_INTERVALS}`, 'hard', 4 * 60, z,
        `Interval ${i} of ${Z5_INTERVALS}. Go`, last ? 'Cool-down' : 'Easy'),
    );
    if (!last) {
      steps.push(
        spinStep(`z5-easy-${i}`, 'Easy', 'easy', 3 * 60, null, 'Easy. 3 minutes', `Interval ${i + 1} of ${Z5_INTERVALS}`),
      );
    }
  }
  steps.push(spinStep('z5-cooldown', 'Cool-down', 'cooldown', 5 * 60, null, 'Cool-down. 5 minutes'));
  return steps;
}

export function totalSec(steps: Step[]): number {
  return steps.reduce((sum, s) => sum + (s.kind === 'timed' ? s.durationSec : 0), 0);
}
