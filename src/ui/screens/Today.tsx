import { useEffect, useState } from 'preact/hooks';
import { unlockAudio } from '../../cues/browser';
import { exportBackup, shareOrDownload } from '../../db/backup';
import { trainingFor } from '../../program/schedule';
import type { TrainingKind } from '../../program/types';
import { lastWeekLine } from '../../progress/ladder';
import { isComplete, resumable } from '../../progress/session';
import { morningStreak } from '../../progress/streaks';
import { makeUpCandidates, plannedPerWeek, sessionsThisWeek, trainingSessionFor, weekView } from '../../progress/week';
import { Header } from '../components/Header';
import { WeekStrip } from '../components/WeekStrip';
import { useData, type Next } from '../data';
import { beginMorning, beginTraining, closeInterrupted, reachedEnd, resumeRoute } from '../flow';
import { KIND_LABEL, dayName, estimatedMinutes } from '../format';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function Today() {
  const d = useData();
  const { today, settings, sessions, sets } = d;
  const [busy, setBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Dev shortcut: ?start=kb|z2|z5 jumps straight into that training.
  useEffect(() => {
    const kind = new URLSearchParams(location.search).get('start');
    if (kind !== 'kb' && kind !== 'z2' && kind !== 'z5') return;
    const url = new URL(location.href);
    url.searchParams.delete('start');
    history.replaceState(history.state, '', url);
    void beginTraining(d, kind, today);
  }, []);

  const training = trainingFor(today, settings.trainingDays);
  const morningDone = sessions.some((s) => s.kind === 'morning' && s.plannedDate === today && s.status === 'done');
  const todays = training ? trainingSessionFor(today, training, sessions) : undefined;
  const trainingDone = todays ? isComplete(todays) : false;
  const next: Next = training && !trainingDone ? { kind: training, plannedDate: today } : null;

  const streak = morningStreak(today, sessions);
  const week = weekView(today, settings.trainingDays, sessions);
  const makeUps = makeUpCandidates(today, settings.trainingDays, sessions);
  const mondayLine = lastWeekLine(today, settings.trainingDays, sessions, sets, settings.bellsKg);
  const backupDue = sessions.length > 0 && Date.now() - (settings.lastBackupAt ?? 0) > WEEK_MS;
  const interrupted = resumable(sessions, Date.now());

  const minutes = (morningDone ? 0 : 5) + (next ? estimatedMinutes(next.kind, sessions) : 0);
  const withMorning = (kind: TrainingKind | null) => (kind ? `Morning + ${KIND_LABEL[kind].toLowerCase()}` : 'Morning routine');
  // What's left to do today; once everything is done, what the day held.
  const title = !morningDone ? withMorning(next?.kind ?? null) : next ? KIND_LABEL[next.kind] : withMorning(training);

  const run = async (action: () => Promise<void>) => {
    unlockAudio();
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const start = () => run(() => (morningDone && next ? beginTraining(d, next.kind, next.plannedDate) : beginMorning(d, next)));
  const makeUp = (date: string, kind: TrainingKind) => run(() => beginTraining(d, kind, date));

  const backup = async () => {
    setBackupError(null);
    try {
      await shareOrDownload(await exportBackup(d.store));
      await d.saveSettings({ ...settings, lastBackupAt: Date.now() });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // share sheet closed
      setBackupError("Couldn't save the backup. Try again.");
    }
  };

  const endInterrupted = async () => {
    if (!interrupted) return;
    await d.store.putSession(await closeInterrupted(d.store, interrupted, Date.now()));
    await d.reload();
  };
  // Ran to the end but was never saved on its Finish screen.
  const unsaved = interrupted !== undefined && reachedEnd(interrupted);

  const allDone = morningDone && !next;

  return (
    <main class="screen">
      <Header
        title={dayName(today)}
        right={
          <button class="icon-btn" aria-label="Settings" onClick={() => d.go({ name: 'settings' })}>
            ⚙
          </button>
        }
      />

      {interrupted && (
        <section class="banner">
          <p>
            Your {KIND_LABEL[interrupted.kind].toLowerCase()} {unsaved ? "isn't saved yet." : 'was interrupted.'}
          </p>
          <div class="btn-row">
            <button
              class="btn"
              onClick={() => {
                unlockAudio();
                d.go(resumeRoute(interrupted, today, settings.trainingDays, sessions));
              }}
            >
              {unsaved ? 'Save' : 'Resume'}
            </button>
            <button class="btn btn-quiet" onClick={() => void endInterrupted()}>
              End here
            </button>
          </div>
        </section>
      )}

      <section class="card">
        <h2>{title}</h2>
        {allDone ? (
          <p class="muted">All done for today.</p>
        ) : (
          <>
            <p class="muted">About {minutes} min</p>
            {/* While a session is interrupted, it's resumed or ended first, so it can't be done twice. */}
            {!interrupted && (
              <button class="btn btn-primary" disabled={busy} onClick={start}>
                {morningDone && next ? `Start ${KIND_LABEL[next.kind].toLowerCase()}` : 'Start'}
              </button>
            )}
          </>
        )}
      </section>

      <section class="card">
        <h2>This week</h2>
        <WeekStrip days={week} today={today} />
      </section>

      <section class="stats">
        <div class="stat">
          <div class="stat-label">Morning streak</div>
          <div class="stat-value">
            {streak.current} {streak.current === 1 ? 'day' : 'days'}
          </div>
        </div>
        <div class="stat">
          <div class="stat-label">Sessions this week</div>
          <div class="stat-value">
            {sessionsThisWeek(today, sessions)} of {plannedPerWeek(settings.trainingDays)}
          </div>
        </div>
      </section>

      {mondayLine && <p class="banner">{mondayLine}</p>}

      {!interrupted && makeUps.slice(-1).map((m) => (
        <button key={m.date} class="btn" disabled={busy} onClick={() => makeUp(m.date, m.kind)}>
          Make up: {dayName(m.date)} {KIND_LABEL[m.kind].toLowerCase()}
        </button>
      ))}

      {backupDue && (
        <section class="banner">
          <p>Your data only lives on this phone. Save a backup to Google Drive.</p>
          <button class="btn" onClick={backup}>
            Back up now
          </button>
          {backupError && <p class="error">{backupError}</p>}
        </section>
      )}
    </main>
  );
}
