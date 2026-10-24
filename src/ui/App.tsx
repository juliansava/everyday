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
import { closeInterrupted } from './flow';
import { Calendar } from './screens/Calendar';
import { Day } from './screens/Day';
import { Finish } from './screens/Finish';
import { Gallery } from './screens/Gallery';
import { KbPlayer } from './screens/KbPlayer';
import { KbStart } from './screens/KbStart';
import { MorningPlayer } from './screens/MorningPlayer';
import { Progress } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';
import { SpinPlayer } from './screens/SpinPlayer';
import { SpinStart } from './screens/SpinStart';
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

// ---------- History ----------
// Each history entry's state holds the screens Back walks through, oldest first; Today is always the
// first. The URL never changes, so dev switches like ?fakehr and ?speed stay put.

const TODAY: Route = { name: 'today' };
/** Screens that are safe to show again after a reload. Players and Finish never are. */
const RESTORE_ON_LOAD: Route['name'][] = ['progress', 'calendar', 'day', 'settings'];
/** Screens Back (or Forward) may land on. A player or Finish entry is only reached by Forward. */
const RESTORE_ON_POP: Route['name'][] = ['today', 'kb-start', 'spin-start', ...RESTORE_ON_LOAD];

const routeKey = (r: Route) => JSON.stringify(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));
const sameRoute = (a: Route, b: Route) => routeKey(a) === routeKey(b);

function stackOf(state: unknown): Route[] {
  const stack = (state as { stack?: Route[] } | null)?.stack;
  return Array.isArray(stack) && stack.length > 0 ? stack : [TODAY];
}

function initialRoute(): Route {
  const stack = stackOf(history.state);
  const top = stack[stack.length - 1];
  return RESTORE_ON_LOAD.includes(top.name) ? top : TODAY;
}
/** IndexedDB failures surface as these DOMException names. */
const STORAGE_ERRORS = ['QuotaExceededError', 'UnknownError', 'InvalidStateError', 'DataError', 'ConstraintError', 'TransactionInactiveError', 'ReadOnlyError', 'VersionError'];

export function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(initialRoute);
  const [saveFailed, setSaveFailed] = useState(false);
  const storeRef = useRef<Store | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  /** The route on screen and the history stack of the current entry, kept in step with each other. */
  const routeRef = useRef<Route>(route);
  const stackRef = useRef<Route[]>([TODAY]);
  const backHandler = useRef<(() => void) | null>(null);

  const show = (r: Route, stack: Route[]) => {
    stackRef.current = stack;
    routeRef.current = r;
    setRoute(r);
    window.scrollTo(0, 0);
  };

  const go = (r: Route, opts: { replace?: boolean } = {}) => {
    const stack = stackRef.current;
    if (sameRoute(r, stack[stack.length - 1])) return window.scrollTo(0, 0);
    if (r.name === 'today') {
      // Back to the first entry, so Back on Today leaves the app.
      const depth = stack.length - 1;
      show(TODAY, [TODAY]);
      if (depth > 0) history.go(-depth);
      return;
    }
    if (!opts.replace && stack.length > 1 && sameRoute(r, stack[stack.length - 2])) {
      // Going to the previous screen (e.g. Day's back arrow) is the same as Back.
      show(r, stack.slice(0, -1));
      history.back();
      return;
    }
    // Today stays the first entry, so a one-way move from it still adds an entry.
    const replace = opts.replace && stack.length > 1;
    const next = replace ? [...stack.slice(0, -1), r] : [...stack, r];
    if (replace) history.replaceState({ stack: next }, '');
    else history.pushState({ stack: next }, '');
    show(r, next);
  };

  useEffect(() => {
    const stack = stackOf(history.state);
    if (!(history.state as { stack?: unknown } | null)?.stack) history.replaceState({ stack }, '');
    if (RESTORE_ON_LOAD.includes(stack[stack.length - 1].name)) stackRef.current = stack;
    // After a reload on a player or Finish, Today shows (with the resume banner): return to its entry.
    else if (stack.length > 1) history.go(-(stack.length - 1));

    const onPop = (e: PopStateEvent) => {
      const stack = stackOf(e.state);
      const top = stack[stack.length - 1];
      // Our own go() already showed this screen.
      if (sameRoute(top, routeRef.current)) {
        stackRef.current = stack;
        return;
      }
      // Players and Finish handle Back themselves: put their entry back and ask.
      if (backHandler.current) {
        history.pushState({ stack: stackRef.current }, '');
        backHandler.current();
        return;
      }
      if (RESTORE_ON_POP.includes(top.name)) show(top, stack);
      else {
        // Forward onto an old player or Finish entry: return to Today instead.
        stackRef.current = stack;
        go(TODAY);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
          await store.putSession(await closeInterrupted(store, s, s.startedAt));
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
    go,
    interceptBack(handler) {
      backHandler.current = handler;
      return () => {
        if (backHandler.current === handler) backHandler.current = null;
      };
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
          <button
            class="btn"
            // A closed share sheet or a failed export leaves the banner up, so they can try again.
            onClick={() => void exportBackup(store).then((b) => shareOrDownload(b)).catch(() => undefined)}
          >
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
    case 'morning':
      return <MorningPlayer key={route.sessionId} sessionId={route.sessionId} next={route.next} />;
    case 'kb-start':
      return <KbStart plannedDate={route.plannedDate} />;
    case 'kb':
      return <KbPlayer key={route.sessionId} sessionId={route.sessionId} />;
    case 'spin-start':
      return <SpinStart kind={route.kind} plannedDate={route.plannedDate} />;
    case 'spin':
      return <SpinPlayer key={route.sessionId} sessionId={route.sessionId} />;
    case 'finish':
      return <Finish key={route.sessionId} sessionId={route.sessionId} />;
    case 'progress':
      return <Progress />;
    case 'calendar':
      return <Calendar />;
    case 'day':
      return <Day date={route.date} />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <Today />;
  }
}
