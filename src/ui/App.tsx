import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { exportBackup, shareOrDownload } from '../db/backup';
import { openStore, type Store } from '../db/store';
import { createBluetoothSource } from '../hr/bluetooth';
import { createFakeSource } from '../hr/fakeSource';
import type { HrSource } from '../hr/types';
import type { SessionRecord, SetRecord, Settings } from '../model';
import { todayISO } from '../program/schedule';
import { staleInProgress } from '../progress/session';
import { TabBar } from './components/TabBar';
import { DataContext, type AppData, type Route } from './data';
import { Gallery } from './screens/Gallery';
import { Today } from './screens/Today';

interface Loaded {
  settings: Settings;
  sessions: SessionRecord[];
  sets: SetRecord[];
  today: string;
}

async function load(store: Store): Promise<Loaded> {
  const [settings, sessions, sets] = await Promise.all([store.getSettings(), store.listSessions(), store.allSets()]);
  return { settings, sessions, sets, today: todayISO() };
}

const params = new URLSearchParams(location.search);
const TABBED: Route['name'][] = ['today', 'progress', 'calendar', 'day'];
/** IndexedDB failures surface as these DOMException names. */
const STORAGE_ERRORS = ['QuotaExceededError', 'UnknownError', 'InvalidStateError', 'DataError', 'ConstraintError', 'TransactionInactiveError', 'ReadOnlyError', 'VersionError'];

export function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ name: 'today' });
  const [saveFailed, setSaveFailed] = useState(false);
  const storeRef = useRef<Store | null>(null);
  const settingsRef = useRef<Settings | null>(null);

  const reload = async () => {
    const store = storeRef.current;
    if (!store) return;
    const next = await load(store);
    settingsRef.current = next.settings;
    setData(next);
  };

  const hr = useMemo<HrSource>(
    () =>
      params.has('fakehr')
        ? createFakeSource()
        : createBluetoothSource({
            get: () => settingsRef.current?.pairedStrapId,
            set: (id) => {
              const s = settingsRef.current;
              if (!s || !storeRef.current || s.pairedStrapId === id) return;
              settingsRef.current = { ...s, pairedStrapId: id };
              void storeRef.current.saveSettings(settingsRef.current);
            },
          }),
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const store = await openStore();
        storeRef.current = store;
        void navigator.storage?.persist?.();
        const first = await load(store);
        for (const s of staleInProgress(first.sessions, Date.now())) {
          await store.putSession({ ...s, status: 'partial', endedAt: s.startedAt });
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    // Most writes are fire-and-forget; a failed one ends up here.
    const onRejection = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof DOMException && STORAGE_ERRORS.includes(e.reason.name)) setSaveFailed(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (params.has('gallery')) return <Gallery />;
  if (error) {
    return (
      <main class="screen">
        <p class="error">Couldn't open your data: {error}</p>
      </main>
    );
  }
  if (!data || !storeRef.current) {
    return (
      <main class="screen">
        <p class="muted">Loading…</p>
      </main>
    );
  }

  const store = storeRef.current;
  const value: AppData = {
    ...data,
    store,
    hr,
    route,
    go: (r) => {
      setRoute(r);
      window.scrollTo(0, 0);
    },
    reload,
    async saveSettings(s) {
      await store.saveSettings(s);
      await reload();
    },
  };

  return (
    <DataContext.Provider value={value}>
      {saveFailed && (
        <div class="banner" role="alert" style={{ margin: '16px' }}>
          <p class="error">Couldn't save. Export a backup now.</p>
          <button class="btn" onClick={() => void exportBackup(store).then((b) => shareOrDownload(b))}>
            Export backup
          </button>
        </div>
      )}
      {renderRoute(route)}
      {TABBED.includes(route.name) && <TabBar />}
    </DataContext.Provider>
  );
}

function renderRoute(route: Route) {
  switch (route.name) {
    // Later tasks add one case per screen here.
    default:
      return <Today />;
  }
}
