import { useMemo, useState } from 'preact/hooks';
import { unlockAudio } from '../../cues/browser';
import { EXERCISES } from '../../program/exercises';
import {
  applyStep,
  currentCircuit,
  describeSuggestion,
  kbHistory,
  suggestions,
  type Suggestion,
} from '../../progress/ladder';
import { Header } from '../components/Header';
import { useData } from '../data';
import { beginKb } from '../flow';
import { dayName } from '../format';

const keyOf = (s: Suggestion) => (s.kind === 'rest' ? 'rest' : `${s.kind}-${s.slot}`);

export function KbStart({ plannedDate }: { plannedDate: string }) {
  const d = useData();
  const { settings } = d;
  const history = useMemo(() => kbHistory(d.sessions, d.sets), [d.sessions, d.sets]);
  const [circuit, setCircuit] = useState(() => currentCircuit(history, settings.bellsKg));
  const [handled, setHandled] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const open = suggestions(history, settings.bellsKg, settings.roundRestSec).filter(
    (s) => !handled.includes(keyOf(s)),
  );
  const bells = [...settings.bellsKg].sort((a, b) => a - b);

  const dismiss = (s: Suggestion) => setHandled((h) => [...h, keyOf(s)]);
  const accept = async (s: Suggestion) => {
    if (s.kind === 'step') setCircuit((c) => applyStep(c, s));
    if (s.kind === 'rest') await d.saveSettings({ ...settings, roundRestSec: s.toSec });
    dismiss(s);
  };
  const setBell = (i: number, kg: number) =>
    setCircuit((c) => c.map((entry, j) => (j === i ? { ...entry, weightKg: kg } : entry)));

  const start = async () => {
    unlockAudio();
    setBusy(true);
    await beginKb(d, plannedDate, circuit);
  };

  return (
    <main class="screen">
      <Header title="Kettlebell" onBack={() => d.go({ name: 'today' })} />
      {plannedDate !== d.today && <p class="muted">Making up {dayName(plannedDate)}'s session.</p>}

      {open.map((s) => (
        <section key={keyOf(s)} class="banner">
          <p>{describeSuggestion(s)}</p>
          <div class="btn-row">
            {s.kind !== 'ladder-end' && (
              <button class="btn" onClick={() => accept(s)}>
                Accept
              </button>
            )}
            <button class="btn btn-quiet" onClick={() => dismiss(s)}>
              {s.kind === 'ladder-end' ? 'Got it' : 'Not now'}
            </button>
          </div>
        </section>
      ))}

      <section class="card">
        <h2>Today's bells</h2>
        {circuit.map((entry, i) => (
          <div key={entry.exerciseId} class="field">
            <span>
              {EXERCISES[entry.exerciseId].name} · {entry.repsPerSide} per side
            </span>
            <div class="chips">
              {bells.map((kg) => (
                <button key={kg} class={kg === entry.weightKg ? 'chip on' : 'chip'} onClick={() => setBell(i, kg)}>
                  {kg} kg
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <p class="muted small">
        Warm-up: 2 rounds of 10 squats, 10 push-ups and 10 halos. Then 3 rounds of the circuit with{' '}
        {settings.roundRestSec} s rest between rounds.
      </p>
      <button class="btn btn-primary" disabled={busy} onClick={start}>
        Start
      </button>
    </main>
  );
}
