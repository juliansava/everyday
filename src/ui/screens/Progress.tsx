import { useMemo, useState } from 'preact/hooks';
import { EXERCISES } from '../../program/exercises';
import { weekStart } from '../../program/schedule';
import { weeklyZone2Minutes, z2MainTrend, z5Trend } from '../../progress/cardio';
import { SLOTS, currentCircuit, kbHistory, nextStep, slotHistory } from '../../progress/ladder';
import { morningStreak } from '../../progress/streaks';
import { weeklySessionCounts } from '../../progress/week';
import { BarChart, type BarDatum } from '../components/BarChart';
import { Header } from '../components/Header';
import { LineChart } from '../components/LineChart';
import { useData } from '../data';
import { shortDate } from '../format';

type Section = 'consistency' | 'strength' | 'cardio';

const everyFourth = (rows: { weekStart: string }[], value: (i: number) => number): BarDatum[] =>
  rows.map((r, i) => ({ label: i % 4 === 0 ? shortDate(r.weekStart) : '', value: value(i) }));

export function Progress() {
  const d = useData();
  const { today, sessions, sets, settings } = d;
  const [open, setOpen] = useState<Section | null>(null);
  const toggle = (s: Section) => setOpen((o) => (o === s ? null : s));

  const streak = morningStreak(today, sessions);
  const weekly = weeklySessionCounts(today, sessions, 12);
  const history = useMemo(() => kbHistory(sessions, sets), [sessions, sets]);
  const circuit = currentCircuit(history, settings.bellsKg);
  const z2Weekly = weeklyZone2Minutes(today, sessions, 12);
  const z2ThisWeek = z2Weekly.find((w) => w.weekStart === weekStart(today))?.minutes ?? 0;
  const z2Main = z2MainTrend(sessions);
  const z5 = z5Trend(sessions);

  return (
    <main class="screen">
      <Header title="Progress" />

      <section class="card">
        <button class="row btn-quiet" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => toggle('consistency')}>
          <h2>Consistency</h2>
          <span class="muted small">
            Streak {streak.current} · best {streak.best}
          </span>
        </button>
        {open === 'consistency' && (
          <>
            <p class="muted small">Training sessions per week, last 12 weeks</p>
            <BarChart data={everyFourth(weekly, (i) => weekly[i].count)} />
          </>
        )}
      </section>

      <section class="card">
        <button class="row btn-quiet" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => toggle('strength')}>
          <h2>Strength</h2>
          <span class="muted small">{circuit.map((c) => `${c.weightKg} kg`).join(' · ')}</span>
        </button>
        {open === 'strength' &&
          SLOTS.map((slot, i) => {
            const now = circuit[i];
            const up = nextStep(slot, now, settings.bellsKg);
            const points = slotHistory(slot, history).map((h) => ({ label: shortDate(h.date), value: h.weightKg }));
            return (
              <div key={slot} class="field">
                <span>
                  {EXERCISES[now.exerciseId].name}: {now.weightKg} kg × {now.repsPerSide} per side
                </span>
                <span class="muted small">
                  {up
                    ? `Next step: ${EXERCISES[up.exerciseId].name.toLowerCase()} ${up.weightKg} kg × ${up.repsPerSide}`
                    : 'Top of the ladder: ready for a heavier bell'}
                </span>
                <LineChart points={points} unit=" kg" />
              </div>
            );
          })}
      </section>

      <section class="card">
        <button class="row btn-quiet" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => toggle('cardio')}>
          <h2>Cardio</h2>
          <span class="muted small">Zone 2 this week: {z2ThisWeek} min</span>
        </button>
        {open === 'cardio' && (
          <>
            <p class="muted small">Minutes in zone 2 per week</p>
            <BarChart data={everyFourth(z2Weekly, (i) => z2Weekly[i].minutes)} />
            <p class="muted small">Zone 2 main block length</p>
            <LineChart points={z2Main.map((r) => ({ label: shortDate(r.date), value: r.mainMin }))} unit=" min" />
            <p class="muted small">Norwegian 4×4 average interval peak</p>
            <LineChart
              points={z5.flatMap((r) => (r.avgPeak === null ? [] : [{ label: shortDate(r.date), value: r.avgPeak }]))}
              unit=" bpm"
            />
            <p class="muted small">Heart-rate drop 60 s after each interval (higher is fitter)</p>
            <LineChart
              points={z5.flatMap((r) => (r.hrRecovery === null ? [] : [{ label: shortDate(r.date), value: r.hrRecovery }]))}
              unit=" bpm"
            />
          </>
        )}
      </section>
    </main>
  );
}
