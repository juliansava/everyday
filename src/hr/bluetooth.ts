import { parseHeartRate } from './parse';
import type { HrReading, HrSource, HrStatus } from './types';

export interface StrapMemory {
  get(): string | undefined;
  set(id: string | undefined): void;
}

export const RETRY_MS = 5000;
export const CONNECT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function createBluetoothSource(
  memory: StrapMemory,
  bt: Bluetooth | undefined = globalThis.navigator?.bluetooth,
): HrSource {
  let status: HrStatus = bt ? 'idle' : 'unavailable';
  let latest: HrReading | null = null;
  let device: BluetoothDevice | null = null;
  let wanted = false;
  let retry: ReturnType<typeof setInterval> | null = null;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((cb) => cb());
  const setStatus = (next: HrStatus) => {
    status = next;
    emit();
  };

  const onValue = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    latest = { bpm: parseHeartRate(value), at: Date.now() };
    emit();
  };

  async function subscribeTo(d: BluetoothDevice): Promise<void> {
    if (!d.gatt) throw new Error('This device has no GATT server');
    const server = await withTimeout(d.gatt.connect(), CONNECT_TIMEOUT_MS);
    const service = await server.getPrimaryService('heart_rate');
    const ch = await service.getCharacteristic('heart_rate_measurement');
    ch.removeEventListener('characteristicvaluechanged', onValue);
    ch.addEventListener('characteristicvaluechanged', onValue);
    await ch.startNotifications();
  }

  function stopRetry() {
    if (retry) clearInterval(retry);
    retry = null;
  }

  function startRetry() {
    if (retry) return;
    retry = setInterval(() => {
      if (!device || !wanted) {
        stopRetry();
        return;
      }
      subscribeTo(device).then(
        () => {
          stopRetry();
          setStatus('connected');
        },
        () => {
          // Still out of range; the next interval tries again.
        },
      );
    }, RETRY_MS);
  }

  const onDisconnected = () => {
    if (!wanted) return;
    setStatus('reconnecting');
    startRetry();
  };

  async function remembered(): Promise<BluetoothDevice | null> {
    const id = memory.get();
    if (!id || !bt || typeof bt.getDevices !== 'function') return null;
    const devices = await bt.getDevices();
    return devices.find((d) => d.id === id) ?? null;
  }

  return {
    status: () => status,
    latest: () => latest,
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    async connect({ pick }) {
      if (!bt) {
        setStatus('unavailable');
        return;
      }
      wanted = true;
      setStatus('connecting');
      try {
        const d =
          (pick ? null : await remembered()) ??
          (await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] }));
        if (device !== d) {
          device?.removeEventListener('gattserverdisconnected', onDisconnected);
          d.addEventListener('gattserverdisconnected', onDisconnected);
          device = d;
        }
        memory.set(d.id);
        await subscribeTo(d);
        setStatus('connected');
      } catch (err) {
        wanted = false;
        setStatus('idle');
        throw err;
      }
    },
    disconnect() {
      wanted = false;
      stopRetry();
      device?.gatt?.disconnect();
      setStatus('idle');
    },
  };
}
