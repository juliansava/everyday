import { useState } from 'preact/hooks';
import { unlockAudio } from '../../cues/browser';
import { zone2, zone5 } from '../../program/zones';
import { nextZone2MainMin } from '../../progress/cardio';
import { Header } from '../components/Header';
import { useData } from '../data';
import { beginSpin } from '../flow';
import { KIND_LABEL, dayName } from '../format';
import { useHr } from '../useHr';

export function SpinStart({ kind, plannedDate }: { kind: 'z2' | 'z5'; plannedDate: string }) {
  const d = useData();
  const { status } = useHr(d.hr);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const z = kind === 'z2' ? zone2(d.settings.maxHr) : zone5(d.settings.maxHr);
  const plan =
    kind === 'z2'
      ? `5 min easy · ${nextZone2MainMin(d.sessions)} min at ${z.low}–${z.high} bpm · 5 min cool-down`
      : `10 min warm-up · 4 × 4 min at ${z.low}–${z.high} bpm with 3 min easy between · 5 min cool-down`;

  const go = async () => {
    setBusy(true);
    await beginSpin(d, kind, plannedDate);
  };

  const connectAndGo = async (pick: boolean) => {
    unlockAudio();
    setError(null);
    if (d.hr.status() === 'connected') return go();
    try {
      await d.hr.connect({ pick });
      await go();
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === 'NotFoundError'
          ? 'No strap was picked. Wet the pads, put the strap on and try again.'
          : "Couldn't connect to the strap. Try again, or ride without it.",
      );
    }
  };

  const withoutStrap = () => {
    unlockAudio();
    void go();
  };

  return (
    <main class="screen">
      <Header title={KIND_LABEL[kind]} onBack={() => d.go({ name: 'today' })} />
      {plannedDate !== d.today && <p class="muted">Making up {dayName(plannedDate)}'s ride.</p>}
      <section class="card">
        <p>{plan}</p>
        <p class="muted small">
          Wet the strap's pads, put it on and mount the phone where you can see it. The screen stays on during the ride.
        </p>
      </section>

      {status === 'unavailable' ? (
        <p class="muted">Bluetooth isn't available in this browser. You can still ride with the timer.</p>
      ) : (
        <button class="btn btn-primary" disabled={busy || status === 'connecting'} onClick={() => connectAndGo(false)}>
          {status === 'connecting' ? 'Connecting…' : 'Connect strap and start'}
        </button>
      )}
      {error && <p class="error">{error}</p>}
      {error && (
        <button class="btn" disabled={busy} onClick={() => connectAndGo(true)}>
          Pick a different strap
        </button>
      )}
      <button class="btn" disabled={busy} onClick={withoutStrap}>
        Ride without strap
      </button>
    </main>
  );
}
