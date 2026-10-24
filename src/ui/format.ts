import type { SessionRecord } from '../model';
import { nextZone2MainMin } from '../progress/cardio';
import type { SessionKind } from '../program/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Heart-rate recovery is the drop in bpm: shown as "−32 bpm", a rise as "+3 bpm". */
export function recoveryText(drop: number | null | undefined): string {
  if (drop == null) return '–';
  if (drop === 0) return '0 bpm';
  return drop > 0 ? `−${drop} bpm` : `+${-drop} bpm`;
}

/** Zone 5 interval peaks; an interval without a reading (0) is left out. */
export function peaksText(peaks: number[] | undefined): string {
  const real = (peaks ?? []).filter((p) => p > 0);
  return real.length ? `${real.join(' · ')} bpm` : '–';
}

export const KIND_LABEL: Record<SessionKind, string> = {
  morning: 'Morning routine',
  kb: 'Kettlebell',
  z2: 'Zone 2 ride',
  z5: 'Zone 5 ride',
};

export function estimatedMinutes(kind: SessionKind, sessions: SessionRecord[]): number {
  switch (kind) {
    case 'morning':
      return 5;
    case 'kb':
      return 35;
    case 'z2':
      return 10 + nextZone2MainMin(sessions);
    case 'z5':
      return 40;
  }
}

function localDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayName(date: string): string {
  return localDate(date).toLocaleDateString('en-GB', { weekday: 'long' });
}

export function shortDate(date: string): string {
  return localDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
