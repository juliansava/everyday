import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openStore } from '../../src/db/store';
import { DEFAULT_SETTINGS, type SessionRecord, type SetRecord, type Settings } from '../../src/model';

let dbCount = 0;
const fresh = () => openStore(`store-test-${++dbCount}`);

const session = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 's1', kind: 'kb', plannedDate: '2026-10-19', status: 'in_progress',
  startedAt: 1000, stepIndex: 0, params: {}, ...over,
});

const set = (over: Partial<SetRecord> = {}): SetRecord => ({
  id: 'x1', sessionId: 's1', exerciseId: 'single-arm-swing', block: 'circuit', round: 1,
  repsPerSide: 10, plannedRepsPerSide: 10, weightKg: 12, at: 2000, ...over,
});

describe('store', () => {
  it('returns default settings until settings are saved', async () => {
    const store = await fresh();
    expect(await store.getSettings()).toEqual(DEFAULT_SETTINGS);
    await store.saveSettings({ ...DEFAULT_SETTINGS, maxHr: 197 });
    expect((await store.getSettings()).maxHr).toBe(197);
  });

  it('fills in settings fields that were missing when saved', async () => {
    const store = await fresh();
    const old: Partial<Settings> = { ...DEFAULT_SETTINGS };
    delete old.vibration;
    await store.saveSettings(old as Settings);
    expect((await store.getSettings()).vibration).toBe(true);
  });

  it('saves, updates and lists sessions oldest first', async () => {
    const store = await fresh();
    await store.putSession(session({ id: 'b', startedAt: 2000 }));
    await store.putSession(session({ id: 'a', startedAt: 1000 }));
    await store.putSession(session({ id: 'a', startedAt: 1000, status: 'done' }));
    const all = await store.listSessions();
    expect(all.map((s) => s.id)).toEqual(['a', 'b']);
    expect(all[0].status).toBe('done');
    expect(await store.getSession('b')).toMatchObject({ id: 'b' });
  });

  it('stores sets per session and deletes one', async () => {
    const store = await fresh();
    await store.addSet(set({ id: 'x1', sessionId: 's1' }));
    await store.addSet(set({ id: 'x2', sessionId: 's1' }));
    await store.addSet(set({ id: 'y1', sessionId: 's2' }));
    expect((await store.setsFor('s1')).map((s) => s.id).sort()).toEqual(['x1', 'x2']);
    await store.deleteSet('x1');
    expect((await store.setsFor('s1')).map((s) => s.id)).toEqual(['x2']);
    expect(await store.allSets()).toHaveLength(2);
  });

  it('keeps one heart-rate trace per session', async () => {
    const store = await fresh();
    await store.putTrace({ sessionId: 's1', startedAt: 1000, bpm: [120, 121] });
    await store.putTrace({ sessionId: 's1', startedAt: 1000, bpm: [120, 121, 122] });
    expect((await store.getTrace('s1'))?.bpm).toEqual([120, 121, 122]);
    expect(await store.allTraces()).toHaveLength(1);
  });

  it('replaces everything in one transaction', async () => {
    const store = await fresh();
    await store.putSession(session({ id: 'old' }));
    await store.addSet(set({ id: 'old-set' }));
    await store.replaceAll({
      settings: { ...DEFAULT_SETTINGS, maxHr: 190 },
      sessions: [session({ id: 'new' })],
      sets: [],
      traces: [],
    });
    expect((await store.listSessions()).map((s) => s.id)).toEqual(['new']);
    expect(await store.allSets()).toEqual([]);
    expect((await store.getSettings()).maxHr).toBe(190);
  });
});
