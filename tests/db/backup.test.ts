import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  BACKUP_VERSION,
  backupFileName,
  describeBackup,
  exportBackup,
  importBackup,
  parseBackup,
} from '../../src/db/backup';
import { openStore } from '../../src/db/store';
import { DEFAULT_SETTINGS, type SessionRecord } from '../../src/model';

const session = (id: string, plannedDate: string, startedAt: number): SessionRecord => ({
  id, kind: 'morning', plannedDate, status: 'done', startedAt, stepIndex: 0, params: {},
});

describe('backup', () => {
  it('round-trips all data through a backup file', async () => {
    const a = await openStore('backup-a');
    await a.saveSettings({ ...DEFAULT_SETTINGS, maxHr: 196 });
    await a.putSession(session('s1', '2026-10-19', 1));
    await a.putSession(session('s2', '2026-10-26', 2));
    await a.addSet({
      id: 'x', sessionId: 's1', exerciseId: 'halo', block: 'warmup', round: 1,
      repsPerSide: 10, plannedRepsPerSide: 10, weightKg: null, at: 3,
    });
    await a.putTrace({ sessionId: 's2', startedAt: 2, bpm: [120, 130] });
    const text = JSON.stringify(await exportBackup(a, 99));

    const b = await openStore('backup-b');
    await b.putSession(session('stale', '2026-01-01', 0));
    await importBackup(b, parseBackup(text));

    expect((await b.getSettings()).maxHr).toBe(196);
    expect((await b.listSessions()).map((s) => s.id)).toEqual(['s1', 's2']);
    expect(await b.allSets()).toHaveLength(1);
    expect((await b.getTrace('s2'))?.bpm).toEqual([120, 130]);
  });

  it('stamps the backup with app, version and time', async () => {
    const store = await openStore('backup-c');
    expect(await exportBackup(store, 1234)).toMatchObject({
      app: 'everyday', version: BACKUP_VERSION, exportedAt: 1234,
    });
  });

  it('rejects files that are not Everyday backups', () => {
    expect(() => parseBackup('not json')).toThrow("That file isn't a backup.");
    expect(() => parseBackup('{"app":"other"}')).toThrow("That file isn't an Everyday backup.");
    expect(() => parseBackup('{"app":"everyday","version":2}')).toThrow(
      'This backup is version 2. This app reads version 1.',
    );
    expect(() => parseBackup('{"app":"everyday","version":1,"sessions":[]}')).toThrow(
      'This backup is incomplete.',
    );
  });

  it('describes what a backup contains', async () => {
    const store = await openStore('backup-d');
    const empty = await exportBackup(store, 1);
    expect(describeBackup(empty)).toBe('No sessions');
    expect(
      describeBackup({ ...empty, sessions: [session('a', '2026-11-02', 2), session('b', '2026-10-19', 1)] }),
    ).toBe('2 sessions from 2026-10-19 to 2026-11-02');
  });

  describe('damaged entries', () => {
    const damaged = 'This backup has damaged entries.';
    const backupWith = (over: Record<string, unknown>) =>
      JSON.stringify({
        app: 'everyday', version: BACKUP_VERSION, exportedAt: 1,
        settings: DEFAULT_SETTINGS, sessions: [], sets: [], traces: [], ...over,
      });

    it('rejects a session with a bad plannedDate', () => {
      expect(() => parseBackup(backupWith({ sessions: [session('s1', 'garbage', 1)] }))).toThrow(damaged);
      expect(() => parseBackup(backupWith({ sessions: [session('s1', '2026-02-30', 1)] }))).toThrow(damaged);
    });

    it('rejects a session without startedAt', () => {
      const noStartedAt = {
        id: 's1', kind: 'morning', plannedDate: '2026-10-19', status: 'done', stepIndex: 0, params: {},
      };
      expect(() => parseBackup(backupWith({ sessions: [noStartedAt] }))).toThrow(damaged);
    });

    it('rejects a null session', () => {
      expect(() => parseBackup(backupWith({ sessions: [null] }))).toThrow(damaged);
    });

    it('rejects a set without a sessionId', () => {
      const noSessionId = {
        id: 'x', exerciseId: 'halo', block: 'warmup', round: 1,
        repsPerSide: 10, plannedRepsPerSide: 10, weightKg: null, at: 3,
      };
      expect(() => parseBackup(backupWith({ sets: [noSessionId] }))).toThrow(damaged);
    });

    it('rejects settings without a maxHr', () => {
      expect(() => parseBackup(backupWith({ settings: {} }))).toThrow(damaged);
    });

    it('still accepts a valid backup from exportBackup', async () => {
      const store = await openStore('backup-valid');
      await store.putSession(session('s1', '2026-10-19', 1));
      await store.addSet({
        id: 'x', sessionId: 's1', exerciseId: 'halo', block: 'warmup', round: 1,
        repsPerSide: 10, plannedRepsPerSide: 10, weightKg: null, at: 3,
      });
      await store.putTrace({ sessionId: 's1', startedAt: 1, bpm: [120, 0, 130] });
      const parsed = parseBackup(JSON.stringify(await exportBackup(store, 5)));
      expect(parsed.sessions.map((s) => s.id)).toEqual(['s1']);
      expect(parsed.traces[0].bpm).toEqual([120, 0, 130]);
    });
  });

  it('names the file after the date', () => {
    expect(backupFileName(new Date(2026, 9, 23))).toBe('everyday-backup-2026-10-23.json');
  });
});
