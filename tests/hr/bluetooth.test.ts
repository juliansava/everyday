import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRY_MS, createBluetoothSource, type StrapMemory } from '../../src/hr/bluetooth';

class FakeCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications = vi.fn(async () => this);
  send(bpm: number) {
    this.value = new DataView(new Uint8Array([0, bpm]).buffer);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }
}

function setup(opts: { remembered?: string } = {}) {
  const ch = new FakeCharacteristic();
  const server = {
    getPrimaryService: vi.fn(async () => ({ getCharacteristic: vi.fn(async () => ch) })),
  };
  let connectFails = false;
  let connectGate: Promise<void> | undefined;
  const device = Object.assign(new EventTarget(), {
    id: 'strap-1',
    gatt: {
      connect: vi.fn(async () => {
        if (connectFails) throw new Error('out of range');
        if (connectGate) await connectGate;
        return server;
      }),
      disconnect: vi.fn(),
    },
  });
  const bt = {
    requestDevice: vi.fn(async () => device),
    getDevices: vi.fn(async () => [device]),
  };
  let stored = opts.remembered;
  const memory: StrapMemory = {
    get: () => stored,
    set: (id) => {
      stored = id;
    },
  };
  const source = createBluetoothSource(memory, bt as unknown as Bluetooth);
  return {
    source,
    bt,
    device,
    ch,
    memory,
    failConnect: (v: boolean) => (connectFails = v),
    holdConnect: (gate?: Promise<void>) => (connectGate = gate),
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = () => r(undefined);
  });
  return { promise, resolve };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Bluetooth heart-rate source', () => {
  it('is unavailable without Web Bluetooth', () => {
    const source = createBluetoothSource({ get: () => undefined, set: () => {} }, undefined);
    expect(source.status()).toBe('unavailable');
  });

  it('pairs through the chooser, remembers the strap and reports readings', async () => {
    const { source, bt, ch, memory } = setup();
    await source.connect({ pick: true });
    expect(bt.requestDevice).toHaveBeenCalledWith({ filters: [{ services: ['heart_rate'] }] });
    expect(source.status()).toBe('connected');
    expect(memory.get()).toBe('strap-1');
    ch.send(142);
    expect(source.latest()?.bpm).toBe(142);
  });

  it('reconnects to the remembered strap without the chooser', async () => {
    const { source, bt } = setup({ remembered: 'strap-1' });
    await source.connect({ pick: false });
    expect(bt.getDevices).toHaveBeenCalled();
    expect(bt.requestDevice).not.toHaveBeenCalled();
    expect(source.status()).toBe('connected');
  });

  it('falls back to the chooser when the remembered strap is not known', async () => {
    const { source, bt } = setup({ remembered: 'someone-else' });
    await source.connect({ pick: false });
    expect(bt.requestDevice).toHaveBeenCalled();
  });

  it('retries every 5 s after the strap drops', async () => {
    const { source, device, failConnect } = setup();
    await source.connect({ pick: true });
    failConnect(true);
    device.dispatchEvent(new Event('gattserverdisconnected'));
    expect(source.status()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(source.status()).toBe('reconnecting');
    failConnect(false);
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(source.status()).toBe('connected');
  });

  it('does not reconnect after a deliberate disconnect', async () => {
    const { source, device } = setup();
    await source.connect({ pick: true });
    source.disconnect();
    device.dispatchEvent(new Event('gattserverdisconnected'));
    expect(source.status()).toBe('idle');
    await vi.advanceTimersByTimeAsync(RETRY_MS * 2);
    expect(device.gatt.connect).toHaveBeenCalledTimes(1);
  });

  it('returns to idle and rethrows when pairing is cancelled', async () => {
    const { source, bt } = setup();
    bt.requestDevice.mockRejectedValueOnce(new Error('User cancelled'));
    await expect(source.connect({ pick: true })).rejects.toThrow('User cancelled');
    expect(source.status()).toBe('idle');
  });

  it('disconnect() during an in-flight connect() stays idle and closes the late link', async () => {
    const { source, device, holdConnect } = setup();
    const gate = deferred();
    holdConnect(gate.promise);
    const pending = source.connect({ pick: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(device.gatt.connect).toHaveBeenCalledTimes(1);
    source.disconnect();
    expect(source.status()).toBe('idle');
    expect(device.gatt.disconnect).toHaveBeenCalledTimes(1);
    gate.resolve();
    await pending;
    expect(source.status()).toBe('idle');
    expect(device.gatt.disconnect).toHaveBeenCalledTimes(2);
  });

  it('a retry that completes after disconnect() stays idle and closes its link', async () => {
    const { source, device, holdConnect } = setup();
    await source.connect({ pick: true });
    device.dispatchEvent(new Event('gattserverdisconnected'));
    expect(source.status()).toBe('reconnecting');
    const gate = deferred();
    holdConnect(gate.promise);
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(device.gatt.connect).toHaveBeenCalledTimes(2);
    source.disconnect();
    expect(source.status()).toBe('idle');
    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(source.status()).toBe('idle');
    expect(device.gatt.disconnect).toHaveBeenCalledTimes(2);
  });

  it('a failed manual reconnect while reconnecting keeps the auto-retry going', async () => {
    const { source, device, failConnect } = setup();
    await source.connect({ pick: true });
    device.dispatchEvent(new Event('gattserverdisconnected'));
    failConnect(true);
    await expect(source.connect({ pick: false })).rejects.toThrow('out of range');
    expect(source.status()).toBe('reconnecting');
    failConnect(false);
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(source.status()).toBe('connected');
  });
});
