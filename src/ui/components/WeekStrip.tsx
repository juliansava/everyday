import type { DayStatus, WeekDay } from '../../progress/week';
import { WEEKDAY_LETTERS } from '../format';

const MARK: Record<DayStatus, string> = {
  done: '✓',
  moved: '↪',
  partial: '◐',
  missed: '✕',
  today: '●',
  upcoming: '○',
  rest: '·',
};

const LABEL: Record<DayStatus, string> = {
  done: 'Done',
  moved: 'Done on another day',
  partial: 'Partly done',
  missed: 'Missed',
  today: 'Today',
  upcoming: 'Upcoming',
  rest: 'Rest day',
};

export function WeekStrip({ days, today }: { days: WeekDay[]; today: string }) {
  return (
    <ol class="week">
      {days.map((day, i) => (
        <li key={day.date} class={`week-day status-${day.status}${day.date === today ? ' is-today' : ''}`}>
          <span class="week-letter">{WEEKDAY_LETTERS[i]}</span>
          <span class="week-mark" aria-label={LABEL[day.status]} title={LABEL[day.status]}>
            {MARK[day.status]}
          </span>
          <span class={`week-dot${day.morningDone ? ' on' : ''}`} title="Morning routine" />
        </li>
      ))}
    </ol>
  );
}
