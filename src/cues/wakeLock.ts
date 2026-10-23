/** Keeps the screen on until the returned function is called. Re-acquires after the app is hidden and shown. */
export function keepAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let active = true;

  const request = async () => {
    if (!active || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      // Not allowed right now (e.g. battery saver); the workout still runs.
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void request();
  };

  document.addEventListener('visibilitychange', onVisibility);
  void request();

  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisibility);
    void lock?.release();
    lock = null;
  };
}
