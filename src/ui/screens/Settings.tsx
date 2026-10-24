import { useRef, useState } from 'preact/hooks';
import { describeBackup, exportBackup, importBackup, parseBackup, shareOrDownload, type Backup } from '../../db/backup';
import type { RoundRest, Settings } from '../../model';
import type { TrainingKind, Weekday } from '../../program/types';
import { zone2, zone5 } from '../../program/zones';
import { Header } from '../components/Header';
import { useData } from '../data';
import { KIND_LABEL } from '../format';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const BELL_SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32];
const RESTS: RoundRest[] = [90, 75, 60];
const TRAINING: TrainingKind[] = ['kb', 'z2', 'z5'];

export function SettingsScreen() {
  const d = useData();
  const s = d.settings;
  const [maxHr, setMaxHr] = useState(String(s.maxHr));
  const [maxHrError, setMaxHrError] = useState<string | null>(null);
  const [bellError, setBellError] = useState<string | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Writes run one at a time, each merged onto freshly read settings, so a tap straight after a
  // blur-triggered save never writes back a stale snapshot.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const save = (patch: Partial<Settings>): Promise<void> => {
    // The swallow sits on the next link, so a failed write doesn't block later saves but is still
    // reported as unhandled when nobody awaits it (App shows its "Couldn't save" banner then).
    const run = chain.current.catch(() => {}).then(async () => d.saveSettings({ ...(await d.store.getSettings()), ...patch }));
    chain.current = run;
    return run;
  };

  const typed = Number(maxHr);
  const validHr = Number.isInteger(typed) && typed >= 120 && typed <= 230;
  const z2 = zone2(validHr ? typed : s.maxHr);
  const z5 = zone5(validHr ? typed : s.maxHr);
  const saveMaxHr = () => {
    if (!validHr) {
      setMaxHrError('Enter a whole number between 120 and 230.');
      return;
    }
    setMaxHrError(null);
    if (typed !== s.maxHr) void save({ maxHr: typed });
  };

  const toggleBell = (kg: number) => {
    const owned = s.bellsKg.includes(kg);
    if (owned && s.bellsKg.length === 1) {
      setBellError('Keep at least one bell.');
      return;
    }
    setBellError(null);
    void save({ bellsKg: owned ? s.bellsKg.filter((b) => b !== kg) : [...s.bellsKg, kg].sort((a, b) => a - b) });
  };

  const setDay = (day: Weekday, value: string) =>
    void save({ trainingDays: { ...s.trainingDays, [day]: value === 'rest' ? null : (value as TrainingKind) } });

  const exportNow = async () => {
    setBackupError(null);
    setBackupMsg(null);
    try {
      const how = await shareOrDownload(await exportBackup(d.store));
      await save({ lastBackupAt: Date.now() });
      setBackupMsg(how === 'shared' ? 'Backup shared' : 'Backup downloaded');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setBackupError("Couldn't save the backup. Try again.");
    }
  };

  const pickFile = async (file: File | undefined) => {
    setBackupError(null);
    setBackupMsg(null);
    setPending(null);
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : String(e));
    }
  };

  const restore = async () => {
    if (!pending) return;
    try {
      await importBackup(d.store, pending);
      setMaxHr(String(pending.settings.maxHr));
      setPending(null);
      await d.reload();
      setBackupMsg('Backup restored');
    } catch {
      setPending(null);
      setBackupError("Couldn't import this backup. Your data wasn't changed.");
    }
  };

  const forgetStrap = () => {
    d.hr.disconnect();
    void save({ pairedStrapId: undefined });
  };

  const toggleRow = (label: string, checked: boolean, patch: (v: boolean) => Partial<Settings>) => (
    <label class="row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => void save(patch(e.currentTarget.checked))} />
    </label>
  );

  return (
    <main class="screen">
      <Header title="Settings" onBack={() => d.go({ name: 'today' })} />

      <section class="card">
        <h2>Heart rate</h2>
        <label class="field">
          <span>Max heart rate</span>
          <input
            inputMode="numeric"
            value={maxHr}
            onInput={(e) => {
              setMaxHr(e.currentTarget.value);
              setMaxHrError(null);
            }}
            onBlur={saveMaxHr}
          />
        </label>
        {maxHrError && <p class="error">{maxHrError}</p>}
        <p class="muted small">
          Zone 2: {z2.low}–{z2.high} bpm · Zone 5: {z5.low}–{z5.high} bpm
        </p>
      </section>

      <section class="card">
        <h2>Training days</h2>
        {WEEKDAYS.map((name, i) => (
          <label key={name} class="row">
            <span>{name}</span>
            <select
              value={s.trainingDays[i as Weekday] ?? 'rest'}
              onChange={(e) => setDay(i as Weekday, e.currentTarget.value)}
            >
              <option value="rest">Rest</option>
              {TRAINING.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>

      <section class="card">
        <h2>Kettlebells you own</h2>
        <div class="chips">
          {BELL_SIZES.map((kg) => (
            <button key={kg} class={s.bellsKg.includes(kg) ? 'chip on' : 'chip'} onClick={() => toggleBell(kg)}>
              {kg} kg
            </button>
          ))}
        </div>
        {bellError && <p class="error">{bellError}</p>}
        <h2>Rest between rounds</h2>
        <div class="chips">
          {RESTS.map((r) => (
            <button key={r} class={s.roundRestSec === r ? 'chip on' : 'chip'} onClick={() => void save({ roundRestSec: r })}>
              {r} s
            </button>
          ))}
        </div>
      </section>

      <section class="card">
        <h2>Cues</h2>
        {toggleRow('Voice', s.voice, (v) => ({ voice: v }))}
        {toggleRow('Beeps', s.beeps, (v) => ({ beeps: v }))}
        {toggleRow('Vibration', s.vibration, (v) => ({ vibration: v }))}
      </section>

      <section class="card">
        <h2>Backup</h2>
        <p class="muted small">
          {s.lastBackupAt ? `Last backup ${new Date(s.lastBackupAt).toLocaleDateString('en-GB')}.` : 'No backup yet.'} Your
          data only lives on this phone.
        </p>
        <button class="btn" onClick={exportNow}>
          Export backup
        </button>
        <label class="btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Import backup
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => void pickFile(e.currentTarget.files?.[0])}
          />
        </label>
        {pending && (
          <div class="banner">
            <p>Replace all data on this phone with {describeBackup(pending).toLowerCase()}?</p>
            <div class="btn-row">
              <button class="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button class="btn" onClick={restore}>
                Replace all data
              </button>
            </div>
          </div>
        )}
        {backupMsg && <p class="small">{backupMsg}</p>}
        {backupError && <p class="error">{backupError}</p>}
      </section>

      <section class="card">
        <h2>Heart-rate strap</h2>
        <p class="muted small">
          {s.pairedStrapId
            ? 'A strap is paired. It reconnects when you start a ride.'
            : 'No strap paired yet. You pair it at the start of your first ride.'}
        </p>
        {s.pairedStrapId && (
          <button class="btn" onClick={forgetStrap}>
            Forget strap
          </button>
        )}
      </section>
    </main>
  );
}
