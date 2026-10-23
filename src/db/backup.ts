import type { HrTraceRecord, SessionRecord, SetRecord, Settings } from '../model';
import { todayISO } from '../program/schedule';
import type { Store } from './store';

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'everyday';
  version: number;
  exportedAt: number;
  settings: Settings;
  sessions: SessionRecord[];
  sets: SetRecord[];
  traces: HrTraceRecord[];
}

export async function exportBackup(store: Store, now = Date.now()): Promise<Backup> {
  const [settings, sessions, sets, traces] = await Promise.all([
    store.getSettings(),
    store.listSessions(),
    store.allSets(),
    store.allTraces(),
  ]);
  return { app: 'everyday', version: BACKUP_VERSION, exportedAt: now, settings, sessions, sets, traces };
}

const SESSION_KINDS: readonly string[] = ['morning', 'kb', 'z2', 'z5'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A YYYY-MM-DD string that is a real calendar date (2026-02-30 is not). */
function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidSettings(value: unknown): boolean {
  return isObject(value) && isFiniteNumber(value.maxHr);
}

function isValidSession(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    SESSION_KINDS.includes(value.kind) &&
    isValidDate(value.plannedDate) &&
    isFiniteNumber(value.startedAt) &&
    isFiniteNumber(value.stepIndex) &&
    isObject(value.params)
  );
}

function isValidSet(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.exerciseId === 'string' &&
    isFiniteNumber(value.round) &&
    isFiniteNumber(value.repsPerSide) &&
    isFiniteNumber(value.plannedRepsPerSide)
  );
}

function isValidTrace(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.sessionId === 'string' &&
    isFiniteNumber(value.startedAt) &&
    Array.isArray(value.bpm) &&
    value.bpm.every(isFiniteNumber)
  );
}

export function parseBackup(text: string): Backup {
  let data: Partial<Backup> | null;
  try {
    data = JSON.parse(text) as Partial<Backup> | null;
  } catch {
    throw new Error("That file isn't a backup. Pick an Everyday backup file.");
  }
  if (data?.app !== 'everyday') throw new Error("That file isn't an Everyday backup.");
  if (data.version !== BACKUP_VERSION) {
    throw new Error(`This backup is version ${data.version}. This app reads version ${BACKUP_VERSION}.`);
  }
  if (!data.settings || !Array.isArray(data.sessions) || !Array.isArray(data.sets) || !Array.isArray(data.traces)) {
    throw new Error('This backup is incomplete.');
  }
  if (
    !isValidSettings(data.settings) ||
    !data.sessions.every(isValidSession) ||
    !data.sets.every(isValidSet) ||
    !data.traces.every(isValidTrace)
  ) {
    throw new Error('This backup has damaged entries.');
  }
  return data as Backup;
}

export function describeBackup(backup: Backup): string {
  const n = backup.sessions.length;
  if (n === 0) return 'No sessions';
  const dates = backup.sessions.map((s) => s.plannedDate).sort();
  return `${n} session${n === 1 ? '' : 's'} from ${dates[0]} to ${dates[dates.length - 1]}`;
}

export async function importBackup(store: Store, backup: Backup): Promise<void> {
  await store.replaceAll({
    settings: backup.settings,
    sessions: backup.sessions,
    sets: backup.sets,
    traces: backup.traces,
  });
}

export function backupFileName(now = new Date()): string {
  return `everyday-backup-${todayISO(now)}.json`;
}

/** Opens the Android share sheet (e.g. to Google Drive); falls back to a download. */
export async function shareOrDownload(backup: Backup, now = new Date()): Promise<'shared' | 'downloaded'> {
  const name = backupFileName(now);
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Everyday backup' });
    return 'shared';
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
