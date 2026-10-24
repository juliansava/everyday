import type { SessionRecord, SetRecord } from '../../model';
import { EXERCISES } from '../../program/exercises';
import type { ExerciseId } from '../../program/types';
import { Header } from '../components/Header';
import { useData } from '../data';
import { KIND_LABEL, dayName, mmss, shortDate } from '../format';

const RATING_LABEL = { easy: 'Easy', right: 'Right', hard: 'Hard' } as const;

function statusText(s: SessionRecord): string {
  if (s.status === 'moved' && s.doneDate) return `Done on ${dayName(s.doneDate)} ${shortDate(s.doneDate)}`;
  if (s.status === 'partial') return 'Partly done';
  return 'Done';
}

function KbDetail({ sets }: { sets: SetRecord[] }) {
  const circuit = sets.filter((s) => s.block === 'circuit').sort((a, b) => a.at - b.at);
  const order: ExerciseId[] = [];
  for (const s of circuit) if (!order.includes(s.exerciseId)) order.push(s.exerciseId);
  const warmupRounds = new Set(sets.filter((s) => s.block === 'warmup').map((s) => s.round)).size;
  return (
    <>
      <p class="small muted">Warm-up: {warmupRounds} of 2 rounds</p>
      {order.map((id) => {
        const rows = circuit.filter((s) => s.exerciseId === id);
        return (
          <div key={id} class="row small">
            <span>
              {EXERCISES[id].name} · {rows[0].weightKg} kg
            </span>
            <span class="muted">{rows.map((r) => r.repsPerSide).join(' · ')}</span>
          </div>
        );
      })}
    </>
  );
}

function SpinDetail({ s }: { s: SessionRecord }) {
  const sum = s.summary ?? {};
  const avg = sum.avgBpm ?? sum.manualAvgBpm;
  return (
    <>
      <div class="row small">
        <span>Time</span>
        <span>{mmss(sum.durationSec ?? 0)}</span>
      </div>
      <div class="row small">
        <span>Average</span>
        <span>{avg ? `${avg} bpm` : '–'}</span>
      </div>
      {s.kind === 'z2' && sum.zone2Share !== undefined && (
        <div class="row small">
          <span>In zone 2</span>
          <span>
            {mmss(sum.timeInZoneSec ?? 0)} ({Math.round(sum.zone2Share * 100)} %)
          </span>
        </div>
      )}
      {s.kind === 'z5' && sum.intervalPeaks && (
        <>
          <div class="row small">
            <span>Interval peaks</span>
            <span>{sum.intervalPeaks.join(' · ')}</span>
          </div>
          <div class="row small">
            <span>Recovery after 60 s</span>
            <span>{sum.hrRecovery == null ? '–' : `−${sum.hrRecovery} bpm`}</span>
          </div>
        </>
      )}
    </>
  );
}

export function Day({ date }: { date: string }) {
  const d = useData();
  const list = d.sessions.filter((s) => s.plannedDate === date && s.status !== 'in_progress');
  return (
    <main class="screen">
      <Header title={`${dayName(date)} ${shortDate(date)}`} onBack={() => d.go({ name: 'calendar' })} />
      {list.length === 0 && <p class="muted">No sessions on this day.</p>}
      {list.map((s) => (
        <section key={s.id} class="card">
          <div class="row">
            <h2>{KIND_LABEL[s.kind]}</h2>
            <span class="muted small">{statusText(s)}</span>
          </div>
          {s.kind === 'kb' && <KbDetail sets={d.sets.filter((x) => x.sessionId === s.id)} />}
          {(s.kind === 'z2' || s.kind === 'z5') && <SpinDetail s={s} />}
          {s.rating && <p class="small">Felt: {RATING_LABEL[s.rating]}</p>}
          {s.note && <p class="small muted">{s.note}</p>}
        </section>
      ))}
    </main>
  );
}
