import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Figure } from '../../art/Figure';
import type { SessionRecord, SetRecord } from '../../model';
import { EXERCISES } from '../../program/exercises';
import type { TapStep } from '../../program/types';
import { routineFor } from '../../progress/session';
import { MissingSession } from '../components/MissingSession';
import { useData, useSession } from '../data';
import { endPartial, saveProgress } from '../flow';
import { mmss } from '../format';
import { useRunner } from '../useRunner';

const HOLD_MS = 600;
const UNDO_MS = 5000;

export function KbPlayer({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  return session ? <KbRun session={session} /> : <MissingSession />;
}

function repsText(step: TapStep): string {
  if (step.block === 'warmup') {
    return step.items.map((i) => `${i.reps} ${EXERCISES[i.exerciseId].name.toLowerCase()}`).join(' · ');
  }
  const item = step.items[0];
  const reps = EXERCISES[item.exerciseId].perSide ? `${item.reps} per side` : `${item.reps}`;
  return `${reps} · ${step.weightKg} kg`;
}

function KbRun({ session }: { session: SessionRecord }) {
  const d = useData();
  const steps = useMemo(() => routineFor(session), [session.id]);
  const [picker, setPicker] = useState(false);
  const [undo, setUndo] = useState<string[] | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const { runner, done, back, pause, resume } = useRunner(steps, session.stepIndex, d.settings, {
    onStep: (i) => void saveProgress(d, session, i),
    onFinish: async () => {
      await saveProgress(d, session, steps.length);
      d.go({ name: 'finish', sessionId: session.id });
    },
  });

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo]);

  const step = runner.current();
  if (!step) return null;

  const complete = (reps?: number) => {
    if (step.kind !== 'tap') return;
    setPicker(false);
    const at = Date.now();
    const records: SetRecord[] = step.items.map((item) => ({
      id: crypto.randomUUID(),
      sessionId: session.id,
      exerciseId: item.exerciseId,
      block: step.block,
      round: step.round,
      repsPerSide: reps ?? item.reps,
      plannedRepsPerSide: item.reps,
      weightKg: step.weightKg,
      at,
    }));
    void Promise.all(records.map((r) => d.store.addSet(r)));
    setUndo(records.map((r) => r.id));
    done();
  };

  const undoLast = async () => {
    if (!undo) return;
    const ids = undo;
    setUndo(null);
    await Promise.all(ids.map((id) => d.store.deleteSet(id)));
    back();
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const onDown = () => {
    held.current = false;
    if (step.kind !== 'tap' || step.block !== 'circuit') return;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setPicker(true);
      navigator.vibrate?.(30);
    }, HOLD_MS);
  };
  const onUp = () => {
    cancelHold();
    if (!held.current) complete();
  };

  const endHere = async () => {
    await endPartial(d, session);
    d.go({ name: 'today' });
  };

  const nextTap = steps.slice(runner.stepIndex + 1).find((s): s is TapStep => s.kind === 'tap');
  const top =
    step.kind === 'tap'
      ? step.block === 'warmup'
        ? `Warm-up · round ${step.round} of 2`
        : `Circuit · round ${step.round} of 3`
      : step.title;

  return (
    <main class="player">
      <div class="player-top">
        <span>{top}</span>
        <button class="btn btn-quiet" onClick={() => setConfirmEnd(true)}>
          End
        </button>
      </div>

      {confirmEnd && (
        <div class="banner">
          <p>End this session here? It's saved as partly done.</p>
          <div class="btn-row">
            <button class="btn" onClick={() => setConfirmEnd(false)}>
              Keep going
            </button>
            <button class="btn" onClick={endHere}>
              End here
            </button>
          </div>
        </div>
      )}

      {step.kind === 'tap' ? (
        <>
          <div class="player-figure">
            {step.items.map((item) => (
              <Figure key={item.exerciseId} exerciseId={item.exerciseId} size={step.items.length > 1 ? 100 : 200} />
            ))}
          </div>
          <h1 class="player-title">{step.block === 'warmup' ? 'Warm-up' : step.title}</h1>
          <p class="player-detail">{repsText(step)}</p>
          {step.block === 'circuit' && <p class="small muted">{EXERCISES[step.items[0].exerciseId].cue}</p>}
          <p class="small muted">Since last set {mmss(runner.elapsedInStep())}</p>

          {picker ? (
            <section class="card">
              <h2>{EXERCISES[step.items[0].exerciseId].perSide ? 'Reps per side done' : 'Reps done'}</h2>
              <div class="reps-picker">
                {Array.from({ length: step.items[0].reps + 2 }, (_, i) => i + 1).map((n) => (
                  <button key={n} class="btn" onClick={() => complete(n)}>
                    {n}
                  </button>
                ))}
              </div>
              <button class="btn btn-quiet" onClick={() => setPicker(false)}>
                Cancel
              </button>
            </section>
          ) : (
            <button
              class="done-btn"
              onPointerDown={onDown}
              onPointerUp={onUp}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
            >
              Done
            </button>
          )}
          {!picker && step.block === 'circuit' && <p class="small muted">Hold Done to change reps</p>}
        </>
      ) : (
        <>
          <h1 class="player-title">{step.title}</h1>
          {step.detail && <p class="player-detail">{step.detail}</p>}
          <div class="countdown">{mmss(Math.ceil(runner.remainingInStep()))}</div>
          <div class="bar">
            <span style={{ width: `${(1 - runner.remainingInStep() / step.durationSec) * 100}%` }} />
          </div>
          {nextTap && (
            <p class="player-next">
              Next: {nextTap.block === 'warmup' ? 'Warm-up' : nextTap.title} · {repsText(nextTap)}
            </p>
          )}
          <div class="player-controls">
            {runner.paused ? (
              <button class="btn" onClick={resume}>
                Resume
              </button>
            ) : (
              <button class="btn" onClick={pause}>
                Pause
              </button>
            )}
            <button class="btn" onClick={done}>
              Skip rest
            </button>
          </div>
        </>
      )}

      {undo && (
        <button class="btn btn-quiet" onClick={undoLast}>
          Undo last set
        </button>
      )}
    </main>
  );
}
