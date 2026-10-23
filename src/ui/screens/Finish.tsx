import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Rating, SessionRecord, SetRecord } from '../../model';
import type { TimedStep } from '../../program/types';
import { spinSummary } from '../../progress/cardio';
import { kbTotalReps, routineFor } from '../../progress/session';
import { Header } from '../components/Header';
import { MissingSession } from '../components/MissingSession';
import { useData, useSession } from '../data';
import { completeSession } from '../flow';
import { KIND_LABEL, mmss } from '../format';

const RATINGS: { value: Rating; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'right', label: 'Right' },
  { value: 'hard', label: 'Hard' },
];

export function Finish({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  if (!session) return <MissingSession />;
  return session.kind === 'kb' ? <KbFinish session={session} /> : <SpinFinish session={session} />;
}

function KbFinish({ session }: { session: SessionRecord }) {
  const d = useData();
  const [sets, setSets] = useState<SetRecord[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void d.store.setsFor(session.id).then(setSets);
  }, [session.id]);

  const durationSec = Math.round(((session.endedAt ?? Date.now()) - session.startedAt) / 1000);
  const rate = async (rating: Rating) => {
    setBusy(true);
    await completeSession(d, session, {
      rating,
      note: note.trim() || undefined,
      summary: { totalReps: kbTotalReps(sets ?? []), durationSec },
    });
    d.go({ name: 'today' });
  };

  return (
    <main class="screen">
      <Header title="Kettlebell done" />
      <section class="stats">
        <div class="stat">
          <div class="stat-label">Total reps</div>
          <div class="stat-value">{sets ? kbTotalReps(sets) : '…'}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Time</div>
          <div class="stat-value">{mmss(durationSec)}</div>
        </div>
      </section>
      <label class="field">
        <span>Note (optional)</span>
        <textarea
          value={note}
          placeholder="Left shoulder felt tight on the press"
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </label>
      <h2>How did it feel?</h2>
      <div class="btn-row">
        {RATINGS.map((r) => (
          <button key={r.value} class="btn" disabled={busy || !sets} onClick={() => rate(r.value)}>
            {r.label}
          </button>
        ))}
      </div>
      <p class="muted small">Easy or Right twice in a row moves you up. Hard keeps you where you are.</p>
    </main>
  );
}

function SpinFinish({ session }: { session: SessionRecord }) {
  const d = useData();
  const steps = useMemo(() => routineFor(session) as TimedStep[], [session.id]);
  const [bpm, setBpm] = useState<number[] | null>(null);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [updateMax, setUpdateMax] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void d.store.getTrace(session.id).then((t) => setBpm(t?.bpm ?? []));
  }, [session.id]);

  if (!bpm) {
    return (
      <main class="screen">
        <p class="muted">Loading…</p>
      </main>
    );
  }

  const summary = spinSummary(bpm, steps);
  const hasHr = summary.avgBpm !== undefined;
  const peak = summary.sustainedPeak ?? 0;
  const newMax = peak > d.settings.maxHr ? peak : null;

  const save = async () => {
    let manualAvgBpm: number | undefined;
    if (!hasHr && manual.trim()) {
      const n = Number(manual);
      if (!Number.isInteger(n) || n < 40 || n > 230) {
        setManualError('Enter a whole number between 40 and 230.');
        return;
      }
      manualAvgBpm = n;
    }
    setBusy(true);
    if (newMax && updateMax) await d.saveSettings({ ...d.settings, maxHr: newMax });
    await completeSession(d, session, { summary: { ...summary, ...(manualAvgBpm ? { manualAvgBpm } : {}) } });
    d.go({ name: 'today' });
  };

  return (
    <main class="screen">
      <Header title={`${KIND_LABEL[session.kind]} done`} />
      <section class="stats">
        <div class="stat">
          <div class="stat-label">Time</div>
          <div class="stat-value">{mmss(summary.durationSec ?? 0)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Average</div>
          <div class="stat-value">{hasHr ? `${summary.avgBpm} bpm` : '–'}</div>
        </div>
        {session.kind === 'z2' && hasHr && (
          <>
            <div class="stat">
              <div class="stat-label">In zone 2</div>
              <div class="stat-value">{mmss(summary.timeInZoneSec ?? 0)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Share of main block</div>
              <div class="stat-value">{Math.round((summary.zone2Share ?? 0) * 100)} %</div>
            </div>
          </>
        )}
        {session.kind === 'z5' && hasHr && (
          <>
            <div class="stat">
              <div class="stat-label">Interval peaks</div>
              <div class="stat-value">{(summary.intervalPeaks ?? []).join(' · ')}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Recovery after 60 s</div>
              <div class="stat-value">{summary.hrRecovery === null ? '–' : `−${summary.hrRecovery} bpm`}</div>
            </div>
          </>
        )}
      </section>

      {!hasHr && (
        <label class="field">
          <span>Average bpm (optional)</span>
          <input
            inputMode="numeric"
            value={manual}
            placeholder="128"
            onInput={(e) => {
              setManual(e.currentTarget.value);
              setManualError(null);
            }}
          />
          {manualError && <span class="error">{manualError}</span>}
        </label>
      )}

      {newMax && (
        <label class="row card">
          <span>
            Your strap held {newMax} bpm, above your max of {d.settings.maxHr}. Update max HR to {newMax}? Your zones
            will be recalculated.
          </span>
          <input type="checkbox" checked={updateMax} onChange={(e) => setUpdateMax(e.currentTarget.checked)} />
        </label>
      )}

      <button class="btn btn-primary" disabled={busy} onClick={save}>
        Save ride
      </button>
    </main>
  );
}
