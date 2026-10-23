import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
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
  go(route: Route): void;
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
