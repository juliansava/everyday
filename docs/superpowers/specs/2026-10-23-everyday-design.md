# Everyday — design spec

Date: 2026-10-23
Status: draft for review

A personal training app for an Android phone. It runs a daily 5-minute morning mobility routine, three kettlebell sessions and two spinning sessions per week, guides each workout hands-free, records the results (including live heart rate from a Bluetooth chest strap), and shows progress over time.

Single user, no accounts, no server. Data lives on the phone.

## 1. Goals and non-goals

**Goals**

- A clear weekly schedule: what to do today, what's done, what was missed.
- Run each workout with as little phone handling as possible:
  - Morning routine: one tap, then fully timed.
  - Kettlebell: one tap per completed exercise.
  - Spinning: one tap to start, live heart rate and zone on screen.
- An animated drawing for every exercise.
- Track progress in three areas: consistency, strength, cardio.
- Suggest when to progress (heavier bell, more reps, longer zone 2).

**Non-goals (out of scope for v1)**

- Strava, Health Connect, Zepp or any other import/export integration.
- Cloud sync, accounts, multiple users.
- Body weight or measurement tracking.
- Editing the program inside the app (exercises, reps and timings change in code; settings cover max HR, schedule days, bells and rest).
- Reminders or push notifications.

## 2. User and equipment

- Android phone, Chrome browser.
- Coospo Bluetooth heart-rate chest strap (standard BLE Heart Rate Service).
- Kettlebells: 8, 12 and 16 kg (one of each).
- Age under 30, max HR not tested. Default max HR: **193 bpm** (editable in Settings).
- Trains in the morning.

## 3. The program

### 3.1 Weekly schedule

| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|
| Morning + Kettlebell | Morning + Zone 2 | Morning + Kettlebell | Morning + Zone 5 | Morning + Kettlebell | Morning | Morning |

- Training days are editable in Settings (default as above).
- On training days, finishing the morning routine leads directly to the start screen of that day's workout.
- The week runs Monday to Sunday.

**Session status**

- `done`: completed on its planned day.
- `moved`: completed on a later day in the same week.
- `partial`: started but ended early.
- `missed`: planned day has passed and the session hasn't been done or made up. Derived, not stored. A missed session can still become `moved` until the week ends.
- If an earlier session this week is missed, Today shows a secondary "Make up: Wednesday kettlebell" button. Doing it marks that session as `moved`.

### 3.2 Morning routine (every day, 5:00)

| # | Exercise | Duration | Cues |
|---|---|---|---|
| 1 | Lymphatic hops | 40 s | |
| 2 | Trunk twists | 30 s | |
| 3 | World's greatest stretch | 60 s | "Switch sides" at 30 s |
| 4 | Cossack squat | 40 s | Alternating sides |
| 5 | Deep squat hold | 40 s | |
| 6 | Hurdler stretch | 40 s | "Switch sides" at 20 s |
| 7 | Deep breaths | 50 s | Guided: 4 s in, 6 s out (5 breaths) |

- Total exactly 300 s. No separate transition steps; the next exercise is announced in the last 5 s of the current one.
- A 5 s "get ready" countdown runs before exercise 1 (not counted in the 5:00).

### 3.3 Kettlebell session (Mon, Wed, Fri)

**Warm-up: 2 rounds**, one tap per round

- 10 bodyweight squats
- 10 push-ups
- 10 halos (5 each direction)

Then a 60 s countdown: "Get your bells".

**Circuit: 3 rounds**, one tap per exercise (both sides count as one tap)

| # | Exercise | Reps (start) | Default bell |
|---|---|---|---|
| 1 | Single-arm swing | 10 per side | 12 kg |
| 2 | Clean & press | 10 per side | 8 kg |
| 3 | Low windmill (bell in bottom hand) | 10 per side | 8 kg |
| 4 | Renegade row + push-up (one bell, other hand on the floor) | 5 per side | 8 kg |

- Between exercises: no timer. A small count-up shows rest time since the last tap.
- Between rounds: 90 s countdown (setting: 90 / 75 / 60 s), skippable with a tap.
- Default bells are only used the first time; after that, each exercise starts from its last used bell (or an accepted suggestion).
- After the last exercise: rate the session with one tap: Easy / Right / Hard.

### 3.4 Spinning

Zones are calculated from max HR (default 193):

| Zone | % of max HR | bpm at 193 |
|---|---|---|
| Zone 2 | 60–70 % | 116–135 |
| Zone 5 target | 90–95 % | 174–183 |

**Zone 2 (Tuesday), 55 min at start**

- 5 min easy, 45 min main block in zone 2, 5 min cool-down.
- Progression: after 2 completed zone 2 rides at the current main-block length with at least 80 % of the main block in zone, the next ride's main block grows by 5 min. Cap: 60 min.
- Out-of-zone cue: if bpm stays outside zone 2 for more than 20 s, voice says "Ease off" (above) or "Push a bit" (below). Repeats at most every 60 s.

**Zone 5 (Thursday), 40 min**

- 10 min warm-up, then 4 × (4 min hard + 3 min easy; no easy block after the 4th interval), then 5 min cool-down. 10 + 16 + 9 + 5 = 40 min.
- Voice counts down the last 5 s of every phase and announces "Interval 2 of 4, go".
- During hard intervals: no "push" cue in the first 90 s (heart rate lags); after that, "Push a bit" if below 174. "Ease off slightly" if above 183 for more than 20 s.

## 4. Screens and in-workout flow

Navigation: three tabs (Today, Progress, Calendar) plus a gear icon for Settings. The theme follows the system light/dark setting.

### 4.1 Today

- Day name, today's plan, estimated duration, one primary Start button.
- This-week strip: 7 days, each marked done / moved / missed / today / upcoming.
- Morning streak (consecutive days the morning routine was finished).
- "Sessions this week: X of 5" (morning routine not counted).
- Make-up button when an earlier session this week was missed (see 3.1).
- On Mondays: one line summarising last week (e.g. "5 of 5. Swings moved up to 16 kg").
- Weekly backup nudge (see 6.5).
- Resume banner if a session was interrupted (see 6.6).

### 4.2 Timed player (morning routine; also rest countdowns)

- Large looping animated drawing, exercise name, side/instruction line.
- Large countdown and progress bar for the current exercise.
- "Next: …" line.
- Controls: back, pause/resume, skip.

### 4.3 Kettlebell flow

1. **Start screen:** list of circuit exercises, each with its bell for today. Tap a bell to change it (8 / 12 / 16). Progression suggestions appear here with an Accept button (see 5.2). Start button.
2. **Player:** drawing, exercise name, "10 per side · 12 kg", "Round 2 of 3", rest count-up, and a Done button filling the bottom ~third of the screen.
   - Tap Done: logs planned reps at the shown bell, advances.
   - Hold Done: opens a reps picker for that set (per side), then advances.
   - After any tap, an Undo link shows for 5 s.
3. **Round rest:** timed player showing the countdown and the first exercise of the next round.
4. **Finish:** summary (total reps, time), Easy / Right / Hard rating, optional note, Save.

Approximate taps for a full session: Start (1) + warm-up (2) + circuit (12) + rating (1) = 16.

### 4.4 Spin player

- First use: pair the strap through Chrome's Bluetooth device chooser. The device is remembered.
- Later rides: reconnects automatically when Start is tapped, where Chrome allows it (see 8, risk 1).
- Screen shows: phase name, current bpm (very large), target range, time left in phase, interval progress, total elapsed.
- Background colour encodes the zone: blue = below target, green = in target, red = above target. In warm-up, easy and cool-down phases there's no target; the background stays neutral.
- If the strap disconnects: voice says "Heart rate lost", the timer keeps running, the app retries the connection every 5 s, and the missing seconds are recorded as gaps.
- No strap or Bluetooth unavailable: the ride runs as a timer only, and the finish screen asks for average bpm (optional).
- Finish: summary (time in zone, average bpm, per-interval peaks and recovery for zone 5), Save.

### 4.5 Progress

Three cards; each opens a detail view.

- **Consistency:** morning streak (current and best), sessions per week for the last 12 weeks (bar chart).
- **Strength:** per circuit exercise, a chart of bell weight and reps per side over time, plus its current step on the ladder (see 5.2).
- **Cardio:** zone 2 minutes per week; zone 2 main-block length over time; zone 5 average interval peak and average 60 s heart-rate recovery per session.

### 4.6 Calendar

- Month view; each day shows a dot per session, coloured by type (morning / kettlebell / zone 2 / zone 5) and marked by status.
- Tap a day to see that day's sessions with their details (sets, bells, rating, HR summary).

### 4.7 Settings

- Max HR (and the derived zone bpm shown live).
- Training days.
- Bells owned (default 8, 12, 16 kg).
- Rest between rounds (90 / 75 / 60 s).
- Voice on/off, beeps on/off, vibration on/off.
- Backup: export, import.
- Forget paired strap.

## 5. Progress logic

### 5.1 Consistency

- **Morning streak:** consecutive calendar days with a finished morning routine. "Finished" means the player reached the end; skipped exercises still count.
- **Sessions this week:** count of kettlebell and spin sessions with status `done` or `moved` in the current week, out of 5.

### 5.2 Strength ladder

Each circuit exercise has a ladder of steps. A step is (variant, bell, reps per side).

- **Clean session for an exercise:** every set of that exercise in all 3 rounds was logged at the planned reps or more, at the step's bell, and the session rating was Easy or Right.
- **Advance rule:** two consecutive clean sessions at the same step → the start screen suggests the next step. Accept = next session uses it. Decline = stays, suggested again next time.
- **Reset:** a Hard rating, or fewer reps than planned on any set of an exercise, resets that exercise's clean count to 0 (Hard resets all exercises).

Ladders (with bells 8, 12, 16 kg):

| Exercise | Ladder |
|---|---|
| Single-arm swing, Clean & press | climb the owned bells at 10 reps from wherever you start (8 → 12 → 16) → then 16 kg × 12 → 16 kg × 15 → end |
| Low windmill | low windmill at start bell → **overhead windmill** 8 kg × 10 → 12 → 16 → 16 × 12 → 16 × 15 → end |
| Renegade row + push-up | 5 per side: 8 → 12 → 16 → then 16 × 6 → 16 × 8 → end |

- Ladder steps are generated from the owned bells in Settings, so adding a bell (e.g. 20 kg) extends the ladders automatically.
- At the end of any ladder: "Ready for a heavier bell" message on the start screen.
- **Rest progression:** when every circuit exercise is at the heaviest owned bell, the app suggests shortening rest between rounds by one step (90 → 75 → 60 s), using the same two-clean-sessions rule applied to the whole circuit.
- The current step is derived from history (last used values plus accepted suggestions), not stored separately.

### 5.3 Cardio metrics

Calculated when a ride is saved and stored in the session summary.

- **Time in zone:** seconds with bpm inside the target range during target phases.
- **Zone 2 share:** time in zone 2 ÷ main-block duration (used for the zone 2 progression rule).
- **Interval peak:** highest bpm in each zone 5 hard interval.
- **HR recovery:** bpm at the last second of a hard interval minus bpm 60 s later. Session value = mean across intervals with valid samples at both points.
- **Max HR check:** if any ride records a bpm higher than the current max HR for at least 5 consecutive seconds, the finish screen offers "Update max HR to N?". Accepting recalculates all zones.

## 6. Technical design

### 6.1 Stack

- TypeScript, Preact, Vite.
- `vite-plugin-pwa` for the web app manifest and service worker (installable, fully offline after first load).
- IndexedDB via the `idb` wrapper for storage.
- Charts: hand-written SVG components (no chart library).
- Tests: Vitest.
- Hosting: GitHub Pages, deployed by a GitHub Actions workflow on push to `main`. Free Pages needs a public repository; it contains code only, never user data.

### 6.2 Modules

Each module has one job, a small public interface, and no UI code unless it is `ui/` or `art/`.

| Module | Responsibility | Depends on |
|---|---|---|
| `program/` | Exercises, routines, week schedule, zone calculation. Pure data and functions. | — |
| `engine/` | Turns a routine into steps (timed, tap, rest, interval) and runs them. Time is derived from the wall clock (`Date.now()` against step start), so throttled timers or a brief screen lock never drift the countdown. Emits events (step started, cue due, finished). | `program/` |
| `cues/` | Voice (Web Speech API), beeps (Web Audio), vibration, screen wake lock. Reacts to engine events. Audio is unlocked by the Start tap. | — |
| `hr/` | Web Bluetooth heart-rate connection: pair, reconnect, parse the Heart Rate Measurement characteristic (8- and 16-bit formats), emit one bpm sample per second. Includes a fake source for development and tests. | — |
| `progress/` | Strength ladders and suggestions, streaks, week status (done/moved/missed), cardio metrics. Pure functions over stored history. | `program/` |
| `db/` | IndexedDB stores, queries, backup export/import. | — |
| `art/` | Animated stick-figure drawings: each exercise is 2–4 keyframe poses (joint coordinates) interpolated in a loop. One shared `Figure` component. | — |
| `ui/` | Screens and shared components. The only module that wires the others together. | all |

Exercises needing a drawing (15): lymphatic hops, trunk twists, world's greatest stretch, Cossack squat, deep squat hold, hurdler stretch, deep breaths, bodyweight squat, push-up, halo, single-arm swing, clean & press, low windmill, overhead windmill, renegade row + push-up.

### 6.3 Data model (IndexedDB)

- `settings` (single record): `maxHr`, `trainingDays`, `bellsKg`, `roundRestSec`, `voice`, `beeps`, `vibration`, `pairedStrapId?`, `lastBackupAt?`.
- `sessions`: `id`, `kind` (`morning` | `kb` | `z2` | `z5`), `plannedDate`, `doneDate?`, `status` (`in_progress` | `done` | `moved` | `partial`), `startedAt`, `endedAt?`, `rating?` (`easy` | `right` | `hard`), `note?`, `params` (e.g. zone 2 main-block minutes, round rest), `summary` (computed metrics).
- `sets`: `id`, `sessionId`, `exerciseId`, `block` (`warmup` | `circuit`), `round`, `repsPerSide`, `weightKg`, `variant?`, `at`.
- `hrTraces`: `sessionId`, `startedAt`, `bpm` (array, one value per second, `0` = no signal).
- `accepted`: accepted progression suggestions (`exerciseId` or `circuit`, `step`, `at`).

`missed` status and current ladder steps are derived, not stored.

### 6.4 Data flow during a workout

1. Start tap → `ui` asks `engine` to run a routine built by `program`, creates an `in_progress` session in `db`, unlocks audio and requests wake lock via `cues`.
2. `engine` emits events → `cues` speaks/beeps/vibrates, `ui` re-renders.
3. Kettlebell: each Done tap writes a `sets` record immediately.
4. Spin: `hr` emits bpm samples → `ui` shows them, the trace buffer is flushed to `db` every 10 s.
5. Finish → `progress` computes the summary → session saved as `done` / `moved` / `partial`.

### 6.5 Storage safety and backup

- On first launch, request persistent storage (`navigator.storage.persist()`).
- Export: a single JSON file with all stores and a schema version. Shared via the Android share sheet (Web Share API with files), so it can go straight to Google Drive; falls back to a download.
- Import: validates the schema version, shows what it contains, replaces all data after confirmation.
- Today shows a backup nudge if the last export was more than 7 days ago.

### 6.6 Error handling

| Situation | Behaviour |
|---|---|
| App closed or crashed mid-workout | The session stays `in_progress`. Today shows "Resume" (continues from the next step) or "End here" (saves as `partial`). In-progress sessions older than 12 hours are auto-saved as `partial`. |
| Bluetooth unavailable or permission denied | Spin runs as a timer; optional manual average bpm at the end. |
| Strap disconnects | Voice cue, retry every 5 s, gaps recorded as `0`, excluded from metrics. |
| Speech voices not available | Fall back to beeps only. |
| Wake lock released (tab hidden) | Re-requested when the page becomes visible again. |
| Storage write fails | Banner: "Couldn't save. Export a backup now", with the export button. |

### 6.7 Testing

- **Unit (Vitest):**
  - `program`: morning routine totals exactly 300 s; zone 2 ride totals 55 min at start; zone 5 ride totals 40 min; zone bpm at max HR 193 match the table in 3.4.
  - `engine`: step order, side switches, pause/resume, wall-clock catch-up after a simulated time jump, undo.
  - `hr`: parsing of 8-bit and 16-bit heart-rate measurements; reconnect state transitions with the fake source.
  - `progress`: clean-session detection, advance and reset rules, ladder generation from owned bells, rest progression, zone 2 progression, streaks, done/moved/missed, time in zone, interval peaks, HR recovery, max HR detection.
  - `db`: backup export → import round trip.
- **UI check:** run in a phone-sized browser window with the fake strap: one full session of each type.
- **On the phone:** install from GitHub Pages and complete one real session of each type, including pairing the strap.

### 6.8 Project layout

```
everyday/
  index.html
  vite.config.ts
  src/
    program/   exercises.ts, routines.ts, schedule.ts, zones.ts
    engine/    steps.ts, runner.ts
    cues/      voice.ts, beep.ts, vibrate.ts, wakeLock.ts
    hr/        bluetooth.ts, parse.ts, fakeSource.ts
    progress/  ladder.ts, week.ts, streaks.ts, cardio.ts
    db/        store.ts, backup.ts
    art/       Figure.tsx, poses/
    ui/        screens/, components/
  tests/
  .github/workflows/deploy.yml
```

## 7. Decisions log

| Decision | Choice | Reason |
|---|---|---|
| Windmill | Low windmill, progressing to overhead windmill | Keeps the hinge and side-core pattern; easier on the shoulder while learning. Halos moved to the warm-up. |
| Warm-up | 2 × (10 squats + 10 push-ups + 10 halos) | The original 5 × 20 + 20 tired pressing muscles before the circuit. |
| Schedule | Fixed days, Mon/Wed/Fri KB, Tue Z2, Thu Z5 | Clear plan, easy to see misses. |
| Morning routine | Every day | Mobility works best daily; supports a streak. |
| Platform | Installable web app (PWA) on Android Chrome | Web Bluetooth lets the app record rides directly; one codebase; no app store. |
| Spin data | Recorded in-app with the Coospo strap; no Strava | Removes the record-then-upload step. |
| Hosting | GitHub Pages | Free HTTPS, simple deploys. |
| Visuals | Animated stick-figure drawings | Consistent, offline, no licensing. |
| Cues | Voice + beeps (vibration optional) | Phone can stay on the floor or the bike. |
| Progress focus | Consistency, strength, cardio | Body metrics out of scope. |
| Zone 5 protocol | Norwegian 4×4 | Best-studied VO2max protocol; fits 40 min. |

## 8. Risks and open points

1. **Strap reconnection.** Automatic reconnect without the Chrome device chooser depends on `navigator.bluetooth.getDevices()` support on the phone's Chrome version. If it's unavailable, each ride needs one extra tap to pick the strap in the chooser. Verified during the on-phone test.
2. **Strap shared with the watch.** If the Amazfit watch is connected to the Coospo strap, the strap may refuse a second connection. Fix: don't pair the strap with the watch, or disconnect it before riding.
3. **Screen must stay on during rides.** If Chrome is backgrounded, Bluetooth notifications and timers may pause. The wake lock keeps the screen on; a phone mount on the bike is assumed.
4. **Max HR is an estimate.** 193 bpm is an age-based estimate. The max HR check (5.3) corrects it upward from real rides; the user can also enter a tested value.
5. **Drawing quality.** Stick figures convey the movement, not detailed form. Form cues are given as one short text line per exercise.
