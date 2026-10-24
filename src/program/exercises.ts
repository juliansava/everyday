import type { Exercise, ExerciseId } from './types';

export const EXERCISES: Record<ExerciseId, Exercise> = {
  'lymphatic-hops': {
    id: 'lymphatic-hops',
    name: 'Lymphatic hops',
    cue: 'Small, quick bounces on the balls of your feet.',
    perSide: false,
  },
  'trunk-twists': {
    id: 'trunk-twists',
    name: 'Trunk twists',
    cue: 'Loose arms, turn from the waist, let the heels pivot.',
    perSide: false,
  },
  'worlds-greatest-stretch': {
    id: 'worlds-greatest-stretch',
    name: "World's greatest stretch",
    cue: 'Deep lunge, elbow to instep, then rotate the arm to the ceiling.',
    perSide: true,
  },
  'cossack-squat': {
    id: 'cossack-squat',
    name: 'Cossack squat',
    cue: 'Sit into one hip, other leg straight with toes up. Alternate.',
    perSide: true,
  },
  'deep-squat-hold': {
    id: 'deep-squat-hold',
    name: 'Deep squat hold',
    cue: 'Heels down, chest up, elbows pushing the knees out.',
    perSide: false,
  },
  'hurdler-stretch': {
    id: 'hurdler-stretch',
    name: 'Hurdler stretch',
    cue: 'One leg straight, other sole to the inner thigh, fold from the hips.',
    perSide: true,
  },
  'deep-breaths': {
    id: 'deep-breaths',
    name: 'Deep breaths',
    cue: 'In through the nose for 4, out slowly for 6.',
    perSide: false,
  },
  'bw-squat': {
    id: 'bw-squat',
    name: 'Bodyweight squat',
    cue: 'Feet shoulder-width, sit back and down, knees over the toes.',
    perSide: false,
  },
  'push-up': {
    id: 'push-up',
    name: 'Push-up',
    cue: 'Body in one line, chest to a fist above the floor.',
    perSide: false,
  },
  halo: {
    id: 'halo',
    name: 'Halo',
    cue: 'Bell by the horns, circle it close around your head. 5 each way.',
    perSide: false,
  },
  'single-arm-swing': {
    id: 'single-arm-swing',
    name: 'Single-arm swing',
    cue: 'Hinge, snap the hips, let the bell float to chest height.',
    perSide: true,
  },
  'clean-and-press': {
    id: 'clean-and-press',
    name: 'Clean and press',
    cue: 'Clean to the rack, brace, press straight up, lock out.',
    perSide: true,
  },
  'around-world-lunge': {
    id: 'around-world-lunge',
    name: 'Around-the-world reverse lunge',
    cue: 'Circle the bell around your torso as you step back into a lunge; drive up through the front heel.',
    perSide: true,
  },
  'renegade-row-push-up': {
    id: 'renegade-row-push-up',
    name: 'Renegade row and push-up',
    cue: 'Plank with one hand on the bell, row without twisting, then a push-up.',
    perSide: true,
  },
};
