import { useMemo, useState } from 'preact/hooks';
import { Figure } from '../../art/Figure';
import type { SessionRecord } from '../../model';
import { morningRoutine } from '../../program/routines';
import { MissingSession } from '../components/MissingSession';
import { useData, useInterceptBack, useSession, type Next } from '../data';
import { beginTraining, completeSession, endPartial, saveProgress } from '../flow';
import { mmss } from '../format';
import { useRunner } from '../useRunner';

export function MorningPlayer({ sessionId, next }: { sessionId: string; next: Next }) {
  const session = useSession(sessionId);
  return session ? <MorningRun session={session} next={next} /> : <MissingSession />;
}

function MorningRun({ session, next }: { session: SessionRecord; next: Next }) {
  const d = useData();
  const steps = useMemo(() => morningRoutine(), []);
  const [confirmEnd, setConfirmEnd] = useState(false);
  useInterceptBack(() => setConfirmEnd(true));

  const { runner, done, back, pause, resume } = useRunner(steps, session.stepIndex, d.settings, {
    onStep: (i) => void saveProgress(d, session, i),
    onFinish: async () => {
      await completeSession(d, session);
      if (next) await beginTraining(d, next.kind, next.plannedDate, true);
      else d.go({ name: 'today' });
    },
  });

  const step = runner.current();
  if (!step || step.kind !== 'timed') return null;

  const index = runner.stepIndex;
  const remaining = runner.remainingInStep();
  const upcoming = steps[index + 1];
  const endHere = async () => {
    await endPartial(d, session);
    d.go({ name: 'today' });
  };

  return (
    <main class="player">
      <div class="player-top">
        <span>{index === 0 ? 'Morning routine' : `Morning · ${index} of ${steps.length - 1}`}</span>
        <button class="btn btn-quiet" onClick={() => setConfirmEnd(true)}>
          End
        </button>
      </div>

      {confirmEnd && (
        <div class="banner">
          <p>End the morning routine here?</p>
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

      {step.exerciseId && (
        <div class="player-figure">
          <Figure exerciseId={step.exerciseId} size={200} />
        </div>
      )}
      <h1 class="player-title">{step.title}</h1>
      {step.detail && <p class="player-detail">{step.detail}</p>}
      <div class="countdown">{mmss(Math.ceil(remaining))}</div>
      <div class="bar">
        <span style={{ width: `${(1 - remaining / step.durationSec) * 100}%` }} />
      </div>
      {upcoming && <p class="player-next">Next: {upcoming.title}</p>}

      <div class="player-controls">
        <button class="btn" aria-label="Previous" onClick={back}>
          ⏮
        </button>
        {runner.paused ? (
          <button class="btn" onClick={resume}>
            Resume
          </button>
        ) : (
          <button class="btn" onClick={pause}>
            Pause
          </button>
        )}
        <button class="btn" aria-label="Skip" onClick={done}>
          ⏭
        </button>
      </div>
    </main>
  );
}
