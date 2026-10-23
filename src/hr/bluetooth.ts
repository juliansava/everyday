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
  // Bumped by every connect() and disconnect(). A connect or retry started under an older
  // number may only close the link it opened; it must not change status.
  let attempt = 0;
  let retry: ReturnType<typeof setInterval> | null = null;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((cb) => cb());
  const setStatus = (next: HrStatus) => {
    status = next;
    emit();
  };
  /** True while attempt `me` is still the one that should be connected. */
  const live = (me: number) => me === attempt && wanted;

  const onValue = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    latest = { bpm: parseHeartRate(value), at: Date.now() };
    emit();
  };

  /**
   * Closes a GATT link that nothing wants any more. The link belongs to the device, so it is
   * kept while the same strap is still wanted (a newer attempt may be using it).
   */
  function release(d: BluetoothDevice) {
    if (!wanted || d !== device) d.gatt?.disconnect();
  }

  async function subscribeTo(d: BluetoothDevice): Promise<void> {
    if (!d.gatt) throw new Error('This device has no GATT server');
    const link = d.gatt.connect();
    let server: BluetoothRemoteGATTServer;
    try {
      server = await withTimeout(link, CONNECT_TIMEOUT_MS);
    } catch (err) {
      // A connect that timed out may still succeed later; don't leave that link open.
      link.then(
        () => release(d),
        () => {},
      );
      throw err;
    }
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
      const me = attempt;
      const d = device;
      subscribeTo(d).then(
        () => {
          if (!live(me)) {
            release(d);
            return;
          }
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
      const me = ++attempt;
      wanted = true;
      setStatus('connecting');
      let d: BluetoothDevice | null = null;
      try {
        d =
          (pick ? null : await remembered()) ??
          (await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] }));
        if (!live(me)) return; // disconnected or superseded while choosing: nothing was opened
        if (device !== d) {
          device?.removeEventListener('gattserverdisconnected', onDisconnected);
          d.addEventListener('gattserverdisconnected', onDisconnected);
          device = d;
        }
        memory.set(d.id);
        await subscribeTo(d);
        if (!live(me)) {
          release(d);
          return;
        }
        stopRetry();
        setStatus('connected');
      } catch (err) {
        if (!live(me)) {
          // A newer attempt or disconnect() owns the status now; only close this attempt's link.
          if (d) release(d);
          return;
        }
        d?.gatt?.disconnect();
        if (retry) {
          // Auto-retry was running, so a failed manual attempt leaves it running.
          setStatus('reconnecting');
        } else {
          wanted = false;
          setStatus('idle');
        }
        throw err;
      }
    },
    disconnect() {
      attempt++;
      wanted = false;
      stopRetry();
      device?.gatt?.disconnect();
      setStatus('idle');
    },
  };
}
