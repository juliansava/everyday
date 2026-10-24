import { useMemo, useState } from 'preact/hooks';
import type { SessionRecord } from '../../model';
import { trainingFor } from '../../program/schedule';
import { firstDay, trainingSessionFor } from '../../progress/week';
import { monthGrid, monthOf, monthTitle, shiftMonth } from '../calendarGrid';
import { Header } from '../components/Header';
import { useData } from '../data';
import { KIND_LABEL, WEEKDAY_LETTERS } from '../format';

export function Calendar() {
  const d = useData();
  const [ym, setYm] = useState(() => monthOf(d.today));
  const grid = monthGrid(ym.year, ym.month);
  const prefix = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
  const since = firstDay(d.sessions) ?? d.today;

  const byDate = useMemo(() => {
    const map = new Map<string, SessionRecord[]>();
    for (const s of d.sessions) {
      if (s.status === 'in_progress') continue;
      map.set(s.plannedDate, [...(map.get(s.plannedDate) ?? []), s]);
    }
    return map;
  }, [d.sessions]);

  return (
    <main class="screen">
      <Header
        title={monthTitle(ym.year, ym.month)}
        right={
          <>
            <button class="icon-btn" aria-label="Previous month" onClick={() => setYm(shiftMonth(ym.year, ym.month, -1))}>
              ‹
            </button>
            <button class="icon-btn" aria-label="Next month" onClick={() => setYm(shiftMonth(ym.year, ym.month, 1))}>
              ›
            </button>
          </>
        }
      />

      <div class="cal">
        {WEEKDAY_LETTERS.map((l, i) => (
          <div key={i} class="cal-head">
            {l}
          </div>
        ))}
        {grid.map((date) => {
          const list = byDate.get(date) ?? [];
          const training = trainingFor(date, d.settings.trainingDays);
          const missed = training && date < d.today && date >= since && !trainingSessionFor(date, training, d.sessions);
          const cls = `cal-day${date.startsWith(prefix) ? '' : ' other'}${date === d.today ? ' is-today' : ''}`;
          return (
            <button key={date} class={cls} onClick={() => d.go({ name: 'day', date })}>
              <span>{Number(date.slice(8))}</span>
              <span class="cal-dots">
                {list.map((s) => (
                  <span key={s.id} class={`cal-dot kind-${s.kind}${s.status === 'partial' ? ' partial' : ''}`} />
                ))}
                {missed && <span class={`cal-dot missed kind-${training}`} />}
              </span>
            </button>
          );
        })}
      </div>

      <div class="chips small muted">
        {(['morning', 'kb', 'z2', 'z5'] as const).map((k) => (
          <span key={k} class="row" style={{ gap: '6px' }}>
            <span class={`cal-dot kind-${k}`} /> {KIND_LABEL[k]}
          </span>
        ))}
        <span class="row" style={{ gap: '6px' }}>
          <span class="cal-dot missed" /> Missed
        </span>
      </div>
    </main>
  );
}
