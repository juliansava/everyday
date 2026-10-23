import type { Range } from './types';

export const DEFAULT_MAX_HR = 193;

export function zone2(maxHr: number): Range {
  return { low: Math.round(maxHr * 0.6), high: Math.round(maxHr * 0.7) };
}

export function zone5(maxHr: number): Range {
  return { low: Math.round(maxHr * 0.9), high: Math.round(maxHr * 0.95) };
}

export type ZonePosition = 'below' | 'in' | 'above';

export function positionIn(bpm: number, range: Range): ZonePosition {
  if (bpm < range.low) return 'below';
  if (bpm > range.high) return 'above';
  return 'in';
}
