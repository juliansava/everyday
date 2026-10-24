import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ZoneCoach } from '../../engine/zoneCoach';
import { freshBpm } from '../../hr/parse';
import { TraceRecorder } from '../../hr/trace';
import type { HrStatus } from '../../hr/types';
import type { SessionRecord } from '../../model';
import { totalSec } from '../../program/routines';
import type { TimedStep } from '../../program/types';
import { positionIn } from '../../program/zones';
import { spinSummary, stepWindows } from '../../progress/cardio';
import { routineFor } from '../../progress/session';
import { SPEED } from '../clock';
import { MissingSession } from '../components/MissingSession';
import { useData, useSession } from '../data';
import { endPartial, saveProgress } from '../flow';
import { KIND_LABEL, mmss } from '../format';
import { useHr } from '../useHr';
import { useRunner } from '../useRunner';

const STATUS_LABEL: Record<HrStatus, string> = {
  idle: 'Strap off',
  connecting: 'Connecting…',
  connected: 'Strap on',
  reconnecting: 'Reconnecting…',
  unavailable: 'No Bluetooth',
};

/** Save the trace this often (seconds of ride). */
const FLUSH_SEC = 10;

export function SpinPlayer({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  return session ? <Ride session={session} /> : <MissingSession />;
}

function Ride({ session }: { session: SessionRecord }) {
  const d = useData();
  const steps = useMemo(() => routineFor(session) as TimedStep[], [session.id]);
  const windows = useMemo(() => stepWindows(steps), [steps]);
  const total = totalSec(steps);
  const startIndex = session.stepIndex;
  // Seconds of the ride before the step we (re)start at; the trace is aligned to step boundaries.
  const offset = windows[startIndex]?.start ?? total;

  const trace = useRef<TraceRecorder | null>(null);
  trace.current ??= new TraceRecorder();
  const coach = useRef<ZoneCoach | null>(null);
  coach.current ??= new ZoneCoach();
  const lastSample = useRef(offset - 1);
  const lastFlush = useRef(offset);
  const prevStatus = useRef<HrStatus>(d.hr.status());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const { status, latest } = useHr(d.hr);

  useEffect(() => {
    if (offset === 0) return;
    void d.store.getTrace(session.id).then((t) => {
      if (t) trace.current = new TraceRecorder(t.bpm.slice(0, offset));
    });
  }, []);

  const flush = () =>
    d.store.putTrace({ sessionId: session.id, startedAt: session.startedAt, bpm: trace.current!.snapshot() });

  const { runner, say, pause, resume } = useRunner(steps, startIndex, d.settings, {
    onStep: (i) => void saveProgress(d, session, i),
    onTick: (r) => {
      if (r.paused || r.finished) return;
      const sec = offset + Math.floor(r.totalElapsed());
      if (sec <= lastSample.current) return;
      const bpm = freshBpm(d.hr.latest(), Date.now());
      // At ?speed=N several ride seconds pass per tick; fill them so test rides have a full trace.
      for (let s = lastSample.current + 1; s < sec; s++) trace.current!.record(s, SPEED > 1 ? bpm : 0);
      trace.current!.record(sec, bpm);
      lastSample.current = sec;
      const step = r.current();
      if (step?.kind === 'timed') {
        const phrase = coach.current!.update(step, r.elapsedInStep(), bpm);
        if (phrase) say(phrase);
      }
      if (sec - lastFlush.current >= FLUSH_SEC) {
        lastFlush.current = sec;
        void flush();
      }
    },
    onFinish: async () => {
      d.hr.disconnect();
      await flush();
      await saveProgress(d, session, steps.length);
      d.go({ name: 'finish', sessionId: session.id });
    },
  });

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (prev === 'connected' && status === 'reconnecting') say('Heart rate lost');
    if (prev === 'reconnecting' && status === 'connected') say('Heart rate back');
  }, [status]);

  const step = runner.current();
  if (!step || step.kind !== 'timed') return null;

  const bpm = freshBpm(latest, Date.now());
  const zone = step.target && bpm > 0 ? `zone-${positionIn(bpm, step.target)}` : '';
  const hard = steps.filter((s) => s.phase === 'hard');
  const hardDone = steps.slice(0, runner.stepIndex).filter((s) => s.phase === 'hard').length;
  const elapsed = Math.min(total, offset + runner.totalElapsed());

  const endRide = async () => {
    d.hr.disconnect();
    await flush();
    await endPartial(d, session, { summary: spinSummary(trace.current!.snapshot(), steps) });
    d.go({ name: 'today' });
  };

  return (
    <main class={`player spin ${zone}`}>
      <div class="player-top">
        <span>{KIND_LABEL[session.kind]}</span>
        <span>{STATUS_LABEL[status]}</span>
        <button class="btn btn-quiet" onClick={() => setConfirmEnd(true)}>
          End
        </button>
      </div>

      {confirmEnd && (
        <div class="banner">
          <p>End the ride here? It's saved as partly done.</p>
          <div class="btn-row">
            <button class="btn" onClick={() => setConfirmEnd(false)}>
              Keep riding
            </button>
            <button class="btn" onClick={endRide}>
              End here
            </button>
          </div>
        </div>
      )}

      <h1 class="player-title">{step.title}</h1>
      <p class="player-detail">{step.detail}</p>
      <div class="bpm">{bpm > 0 ? bpm : '––'}</div>
      <p style={{ textAlign: 'center' }}>
        {bpm > 0 ? 'bpm' : status === 'connected' ? 'Waiting for heart rate' : 'No heart rate'}
      </p>
      <div class="countdown">{mmss(Math.ceil(runner.remainingInStep()))}</div>
      <p class="player-next" style={{ textAlign: 'center' }}>
        left in this phase
      </p>
      {hard.length > 0 && (
        <div class="intervals" aria-label={`${hardDone} of ${hard.length} intervals done`}>
          {hard.map((s, i) => (
            <span key={s.id} class={i < hardDone ? 'done' : ''} />
          ))}
        </div>
      )}
      <div class="bar">
        <span style={{ width: `${(elapsed / total) * 100}%` }} />
      </div>
      <p class="player-next">
        Elapsed {mmss(elapsed)} of {mmss(total)}
      </p>

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
        {(status === 'idle' || status === 'reconnecting') && (
          <button class="btn" onClick={() => d.hr.connect({ pick: false }).catch(() => undefined)}>
            Reconnect strap
          </button>
        )}
      </div>
    </main>
  );
}
