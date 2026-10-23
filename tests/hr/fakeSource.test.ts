import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSource } from '../../src/hr/fakeSource';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('fake heart-rate source', () => {
  it('connects, then reports one reading per second', async () => {
    const source = createFakeSource({ bpmAt: (sec) => 100 + sec });
    const connecting = source.connect({ pick: false });
    expect(source.status()).toBe('connecting');
    await vi.advanceTimersByTimeAsync(300);
    await connecting;
    expect(source.status()).toBe('connected');
    await vi.advanceTimersByTimeAsync(2000);
    expect(source.latest()?.bpm).toBe(102);
    source.disconnect();
    expect(source.status()).toBe('idle');
  });

  it('reports reconnecting while the simulated signal is lost', async () => {
    const source = createFakeSource({ bpmAt: (sec) => (sec >= 2 ? 0 : 130) });
    const connecting = source.connect({ pick: false });
    await vi.advanceTimersByTimeAsync(300);
    await connecting;
    await vi.advanceTimersByTimeAsync(1000);
    expect(source.status()).toBe('connected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(source.status()).toBe('reconnecting');
    source.disconnect();
  });
});
