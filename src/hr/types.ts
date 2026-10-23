export type HrStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unavailable';

export interface HrReading {
  bpm: number;
  /** ms timestamp when the reading arrived */
  at: number;
}

export interface HrSource {
  status(): HrStatus;
  latest(): HrReading | null;
  /** `pick: true` always shows Chrome's device chooser; otherwise the remembered strap is tried first. */
  connect(opts: { pick: boolean }): Promise<void>;
  disconnect(): void;
  /** Called on every status change and reading. Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void;
}
