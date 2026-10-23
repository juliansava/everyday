import type { HrReading, HrSource, HrStatus } from './types';

/** Swings between ~125 and ~180 bpm every few minutes; good enough to exercise every zone colour. */
export function defaultFakeBpm(sec: number): number {
  return Math.round(125 + 55 * Math.max(0, Math.sin(sec / 70)) + 3 * Math.sin(sec / 7));
}

export interface FakeOptions {
  /** bpm for a given second since connecting; 0 simulates a lost signal. */
  bpmAt?: (sec: number) => number;
  now?: () => number;
  connectDelayMs?: number;
}

export function createFakeSource({
  bpmAt = defaultFakeBpm,
  now = Date.now,
  connectDelayMs = 300,
}: FakeOptions = {}): HrSource {
  let status: HrStatus = 'idle';
  let latest: HrReading | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((cb) => cb());

  return {
    status: () => status,
    latest: () => latest,
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    connect() {
      status = 'connecting';
      emit();
      return new Promise((resolve) => {
        setTimeout(() => {
          status = 'connected';
          startedAt = now();
          emit();
          timer ??= setInterval(() => {
            const bpm = bpmAt(Math.floor((now() - startedAt) / 1000));
            if (bpm > 0) latest = { bpm, at: now() };
            status = bpm > 0 ? 'connected' : 'reconnecting';
            emit();
          }, 1000);
          resolve();
        }, connectDelayMs);
      });
    },
    disconnect() {
      if (timer) clearInterval(timer);
      timer = null;
      status = 'idle';
      emit();
    },
  };
}
