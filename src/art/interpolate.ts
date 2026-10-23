import type { Drawing } from './poses';

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** Joint coordinates `tSec` seconds into the drawing's loop. */
export function poseAt(d: Drawing, tSec: number): number[] {
  const n = d.frames.length;
  if (n === 1) return [...d.frames[0]];
  const stops = d.stops ?? d.frames.map((_, i) => i / (n - 1));
  const p = (((tSec % d.durationSec) + d.durationSec) % d.durationSec) / d.durationSec;

  let i = 0;
  while (i < n - 2 && p > stops[i + 1]) i++;
  const span = stops[i + 1] - stops[i];
  const local = span > 0 ? Math.min(1, (p - stops[i]) / span) : 0;
  const e = easeInOut(local);

  const a = d.frames[i];
  const b = d.frames[i + 1];
  return a.map((v, k) => v + (b[k] - v) * e);
}
