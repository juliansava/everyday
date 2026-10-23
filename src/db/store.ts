import { openDB, type DBSchema } from 'idb';
import {
  DEFAULT_SETTINGS,
  type HrTraceRecord,
  type SessionRecord,
  type SetRecord,
  type Settings,
} from '../model';

interface EverydayDB extends DBSchema {
  settings: { key: string; value: Settings };
  sessions: { key: string; value: SessionRecord; indexes: { byStartedAt: number } };
  sets: { key: string; value: SetRecord; indexes: { bySession: string } };
  hrTraces: { key: string; value: HrTraceRecord };
}

export const DB_VERSION = 1;
const SETTINGS_KEY = 'settings';

export interface AllData {
  settings: Settings;
  sessions: SessionRecord[];
  sets: SetRecord[];
  traces: HrTraceRecord[];
}

export interface Store {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  putSession(session: SessionRecord): Promise<void>;
  getSession(id: string): Promise<SessionRecord | undefined>;
  /** Oldest first. */
  listSessions(): Promise<SessionRecord[]>;
  addSet(set: SetRecord): Promise<void>;
  deleteSet(id: string): Promise<void>;
  setsFor(sessionId: string): Promise<SetRecord[]>;
  allSets(): Promise<SetRecord[]>;
  putTrace(trace: HrTraceRecord): Promise<void>;
  getTrace(sessionId: string): Promise<HrTraceRecord | undefined>;
  allTraces(): Promise<HrTraceRecord[]>;
  replaceAll(data: AllData): Promise<void>;
}

export async function openStore(name = 'everyday'): Promise<Store> {
  const db = await openDB<EverydayDB>(name, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('settings');
      db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byStartedAt', 'startedAt');
      db.createObjectStore('sets', { keyPath: 'id' }).createIndex('bySession', 'sessionId');
      db.createObjectStore('hrTraces', { keyPath: 'sessionId' });
    },
  });

  return {
    async getSettings() {
      const saved = await db.get('settings', SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS, ...saved };
    },
    async saveSettings(settings) {
      await db.put('settings', settings, SETTINGS_KEY);
    },
    async putSession(session) {
      await db.put('sessions', session);
    },
    getSession: (id) => db.get('sessions', id),
    listSessions: () => db.getAllFromIndex('sessions', 'byStartedAt'),
    async addSet(set) {
      await db.put('sets', set);
    },
    async deleteSet(id) {
      await db.delete('sets', id);
    },
    setsFor: (sessionId) => db.getAllFromIndex('sets', 'bySession', sessionId),
    allSets: () => db.getAll('sets'),
    async putTrace(trace) {
      await db.put('hrTraces', trace);
    },
    getTrace: (sessionId) => db.get('hrTraces', sessionId),
    allTraces: () => db.getAll('hrTraces'),
    async replaceAll(data) {
      const tx = db.transaction(['settings', 'sessions', 'sets', 'hrTraces'], 'readwrite');
      // idb creates `done` eagerly; this stops an early abort from being reported as unhandled.
      tx.done.catch(() => {});
      try {
        await Promise.all([
          tx.objectStore('settings').clear(),
          tx.objectStore('sessions').clear(),
          tx.objectStore('sets').clear(),
          tx.objectStore('hrTraces').clear(),
        ]);
        await tx.objectStore('settings').put(data.settings, SETTINGS_KEY);
        for (const s of data.sessions) await tx.objectStore('sessions').put(s);
        for (const s of data.sets) await tx.objectStore('sets').put(s);
        for (const t of data.traces) await tx.objectStore('hrTraces').put(t);
        await tx.done;
      } catch (error) {
        // Roll back so a bad record leaves the old data in place. A failed request has
        // already aborted the transaction, in which case abort() throws and is ignored.
        try {
          tx.abort();
        } catch {
          // Already finished.
        }
        await tx.done.catch(() => {});
        throw error;
      }
    },
  };
}
