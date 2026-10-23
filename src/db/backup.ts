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
