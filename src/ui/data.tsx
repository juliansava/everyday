import { createContext } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';
import type { Store } from '../db/store';
import type { HrSource } from '../hr/types';
import type { SessionRecord, SetRecord, Settings } from '../model';
import type { TrainingKind } from '../program/types';

/** The training to run straight after the morning routine. */
export type Next = { kind: TrainingKind; plannedDate: string } | null;

export type Route =
  | { name: 'today' }
  | { name: 'progress' }
  | { name: 'calendar' }
  | { name: 'settings' }
  | { name: 'day'; date: string }
  | { name: 'morning'; sessionId: string; next: Next }
  | { name: 'kb-start'; plannedDate: string }
  | { name: 'kb'; sessionId: string }
  | { name: 'spin-start'; kind: 'z2' | 'z5'; plannedDate: string }
  | { name: 'spin'; sessionId: string }
  | { name: 'finish'; sessionId: string };

export interface AppData {
  store: Store;
  settings: Settings;
  /** Oldest first. */
  sessions: SessionRecord[];
  sets: SetRecord[];
  today: string;
  hr: HrSource;
  route: Route;
  /**
   * Opens a screen and adds it to the browser history, so Android Back returns to the previous one.
   * Today is the first entry: going there goes back to it. `replace` swaps the current entry instead,
   * for one-way moves (start screen → player → Finish, morning → the training after it).
   */
  go(route: Route, opts?: { replace?: boolean }): void;
  /** Makes Back call `handler` instead of leaving the screen. Returns the undo. */
  interceptBack(handler: () => void): () => void;
  reload(): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
}

export const DataContext = createContext<AppData | null>(null);

export function useData(): AppData {
  const data = useContext(DataContext);
  if (!data) throw new Error('useData must be used inside <App>');
  return data;
}

export function useSession(id: string): SessionRecord | undefined {
  return useData().sessions.find((s) => s.id === id);
}

/** While the calling screen is shown, Back calls `handler` (e.g. to ask "End here?") instead of leaving. */
export function useInterceptBack(handler: () => void): void {
  const d = useData();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => d.interceptBack(() => ref.current()), []);
}
