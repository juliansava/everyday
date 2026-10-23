import type { HrReading } from './types';

/** Bluetooth Heart Rate Measurement (0x2A37): flag bit 0 selects an 8- or 16-bit value. */
export function parseHeartRate(view: DataView): number {
  const flags = view.getUint8(0);
  return flags & 0x01 ? view.getUint16(1, true) : view.getUint8(1);
}

export const STALE_MS = 3000;

/** The latest bpm if it arrived within `maxAgeMs`, otherwise 0 (no signal). */
export function freshBpm(reading: HrReading | null, now: number, maxAgeMs = STALE_MS): number {
  return reading && now - reading.at <= maxAgeMs ? reading.bpm : 0;
}
