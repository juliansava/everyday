import type { ExerciseId } from '../program/types';

/**
 * 11 joints as x,y pairs in a 100×100 box (y grows downward, floor at y = 93):
 * head, neck, hip, left elbow, left hand, right elbow, right hand,
 * left knee, left foot, right knee, right foot.
 */
export type Pose = readonly number[];
export const JOINTS = 11;

export type BellHand = 'l' | 'r' | 'both' | null;

export interface Drawing {
  /** Keyframes; the last one repeats the first so the loop is seamless. */
  frames: Pose[];
  durationSec: number;
  bell: BellHand;
  /** Keyframe times as fractions of the loop, one per frame. Evenly spaced when absent. */
  stops?: number[];
}

// Front view, standing
const STAND: Pose = [50,14, 50,22, 50,52, 43,37, 41,52, 57,37, 59,52, 46,72, 45,92, 54,72, 55,92];
const ARMS_UP: Pose = [50,13, 50,21, 50,52, 40,14, 34,6, 60,14, 66,6, 46,72, 45,92, 54,72, 55,92];
const HOP_DOWN: Pose = [50,14, 50,22, 50,52, 44,37, 43,52, 56,37, 57,52, 47,72, 47,92, 53,72, 53,92];
const HOP_UP: Pose = [50,9, 50,17, 50,47, 44,32, 43,47, 56,32, 57,47, 47,67, 47,87, 53,67, 53,87];
const TWIST_L: Pose = [49,14, 50,22, 50,52, 40,32, 30,38, 50,30, 38,30, 44,72, 40,92, 56,72, 60,92];
const TWIST_R: Pose = [51,14, 50,22, 50,52, 50,30, 62,30, 60,32, 70,38, 44,72, 40,92, 56,72, 60,92];
const COSSACK_L: Pose = [41,34, 40,42, 36,70, 40,54, 44,62, 46,54, 46,62, 28,74, 22,92, 57,81, 78,92];
const COSSACK_R: Pose = [59,34, 60,42, 64,70, 60,54, 56,62, 54,54, 54,62, 43,81, 22,92, 72,74, 78,92];
const HALO_L: Pose = [50,14, 50,22, 50,52, 30,28, 38,14, 46,30, 40,14, 46,72, 45,92, 54,72, 55,92];
const HALO_TOP: Pose = [50,14, 50,22, 50,52, 36,16, 48,6, 64,16, 52,6, 46,72, 45,92, 54,72, 55,92];
const HALO_R: Pose = [50,14, 50,22, 50,52, 54,30, 60,14, 70,28, 62,14, 46,72, 45,92, 54,72, 55,92];
const HALO_FRONT: Pose = [50,14, 50,22, 50,52, 40,34, 47,32, 60,34, 53,32, 46,72, 45,92, 54,72, 55,92];
const CP_HANG: Pose = [50,20, 50,28, 50,54, 42,40, 40,54, 54,44, 53,60, 45,73, 45,92, 55,73, 55,92];
const CP_RACK: Pose = [50,14, 50,22, 50,52, 42,37, 40,52, 60,34, 56,24, 46,72, 45,92, 54,72, 55,92];
const CP_OVERHEAD: Pose = [50,14, 50,22, 50,52, 42,37, 40,52, 56,14, 58,6, 46,72, 45,92, 54,72, 55,92];
const LUNGE_STAND: Pose = [50,14, 50,22, 50,52, 42,34, 48,34, 58,34, 52,34, 46,72, 45,92, 54,72, 55,92];
const LUNGE_RIGHT: Pose = [50,22, 50,30, 50,60, 56,42, 64,52, 64,40, 68,52, 45,76, 44,92, 56,82, 57,92];
const LUNGE_BOTTOM: Pose = [50,28, 50,36, 50,66, 36,48, 32,58, 44,46, 36,58, 44,78, 44,92, 56,88, 58,92];
const LUNGE_UP: Pose = [50,20, 50,28, 50,58, 42,40, 46,46, 58,40, 54,46, 45,75, 44,92, 55,80, 56,92];

// Side view, facing right
const SIDE_STAND: Pose = [52,12, 50,22, 48,52, 52,36, 54,50, 52,37, 55,51, 50,72, 50,92, 51,72, 51,92];
const SIDE_SQUAT: Pose = [52,38, 48,46, 36,72, 58,44, 70,44, 58,45, 70,45, 58,72, 50,92, 59,72, 51,92];
const SQUAT_HOLD_A: Pose = [50,44, 46,52, 40,80, 55,66, 63,61, 56,67, 64,62, 59,71, 54,92, 60,72, 52,92];
const SQUAT_HOLD_B: Pose = [50,45, 46,53, 40,80, 55,67, 63,62, 56,68, 64,63, 59,71, 54,92, 60,72, 52,92];
const WGS_DOWN: Pose = [71,40, 64,46, 48,66, 64,62, 62,90, 62,64, 60,90, 68,72, 70,92, 30,84, 14,90];
const WGS_OPEN: Pose = [66,38, 64,46, 48,66, 64,62, 62,90, 60,32, 56,16, 68,72, 70,92, 30,84, 14,90];
const HURDLER_UP: Pose = [42,50, 40,58, 36,86, 46,70, 56,82, 46,72, 56,84, 58,88, 80,88, 50,80, 40,90];
const HURDLER_FOLD: Pose = [63,64, 56,68, 36,86, 66,78, 76,86, 66,80, 76,88, 58,88, 80,88, 50,80, 40,90];
const PLANK_TOP: Pose = [82,52, 74,56, 44,73, 73,73, 72,90, 74,73, 73,90, 29,81, 14,90, 30,81, 15,90];
const PLANK_BOTTOM: Pose = [82,77, 74,80, 44,85, 62,74, 72,90, 63,74, 73,90, 29,88, 14,90, 30,88, 15,90];
const SWING_BACK: Pose = [63,33, 56,38, 34,52, 60,48, 62,58, 48,52, 40,66, 44,72, 44,92, 45,72, 45,92];
const SWING_TOP: Pose = [52,13, 48,22, 46,52, 50,36, 52,50, 62,24, 76,24, 47,72, 44,92, 48,72, 45,92];
const RR_PLANK: Pose = [82,52, 74,56, 44,73, 73,73, 72,90, 74,72, 73,86, 29,81, 14,90, 30,81, 15,90];
const RR_ROW: Pose = [82,52, 74,56, 44,73, 73,73, 72,90, 62,50, 66,64, 29,81, 14,90, 30,81, 15,90];
const RR_BOTTOM: Pose = [82,77, 74,80, 44,85, 62,74, 72,90, 63,73, 73,86, 29,88, 14,90, 30,88, 15,90];

export const DRAWINGS: Record<ExerciseId, Drawing> = {
  'lymphatic-hops': { frames: [HOP_DOWN, HOP_UP, HOP_DOWN], durationSec: 0.6, bell: null },
  'trunk-twists': { frames: [TWIST_L, TWIST_R, TWIST_L], durationSec: 1.6, bell: null },
  'worlds-greatest-stretch': { frames: [WGS_DOWN, WGS_OPEN, WGS_DOWN], durationSec: 3, bell: null },
  'cossack-squat': { frames: [COSSACK_L, COSSACK_R, COSSACK_L], durationSec: 4, bell: null },
  'deep-squat-hold': { frames: [SQUAT_HOLD_A, SQUAT_HOLD_B, SQUAT_HOLD_A], durationSec: 4, bell: null },
  'hurdler-stretch': { frames: [HURDLER_UP, HURDLER_FOLD, HURDLER_UP], durationSec: 4, bell: null },
  // 4 s in, 6 s out
  'deep-breaths': { frames: [STAND, ARMS_UP, STAND], durationSec: 10, bell: null, stops: [0, 0.4, 1] },
  'bw-squat': { frames: [SIDE_STAND, SIDE_SQUAT, SIDE_STAND], durationSec: 2.4, bell: null },
  'push-up': { frames: [PLANK_TOP, PLANK_BOTTOM, PLANK_TOP], durationSec: 2.4, bell: null },
  halo: { frames: [HALO_L, HALO_TOP, HALO_R, HALO_FRONT, HALO_L], durationSec: 3.2, bell: 'both' },
  'single-arm-swing': { frames: [SWING_BACK, SWING_TOP, SWING_BACK], durationSec: 1.4, bell: 'r' },
  'clean-and-press': { frames: [CP_HANG, CP_RACK, CP_OVERHEAD, CP_RACK, CP_HANG], durationSec: 4, bell: 'r' },
  // The bell circles the torso: front, right, round the back, front again.
  'around-world-lunge': {
    frames: [LUNGE_STAND, LUNGE_RIGHT, LUNGE_BOTTOM, LUNGE_UP, LUNGE_STAND],
    durationSec: 3.6,
    bell: 'both',
  },
  'renegade-row-push-up': {
    frames: [RR_PLANK, RR_ROW, RR_PLANK, RR_BOTTOM, RR_PLANK],
    durationSec: 4.5,
    bell: 'r',
  },
};
