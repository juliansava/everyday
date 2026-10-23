import type { RunnerEvent } from '../engine/runner';
import { announce } from '../program/routines';

export interface CueOutputs {
  canSpeak(): boolean;
  speak(text: string): void;
  beep(kind: 'tick' | 'go' | 'end'): void;
  vibrate(pattern: number | number[]): void;
}

export interface CuePrefs {
  voice: boolean;
  beeps: boolean;
  vibration: boolean;
}

export interface CuePlayer {
  say(text: string): void;
  handle(events: RunnerEvent[]): void;
}

export function createCuePlayer(prefs: CuePrefs, out: CueOutputs): CuePlayer {
  const voiceOn = () => prefs.voice && out.canSpeak();
  const say = (text: string) => {
    if (voiceOn()) out.speak(text);
    else if (prefs.beeps) out.beep('go');
  };

  return {
    say,
    handle(events) {
      for (const e of events) {
        switch (e.type) {
          case 'say':
            say(e.text);
            break;
          case 'beep':
            if (prefs.beeps) out.beep('tick');
            break;
          case 'step':
            if (prefs.vibration) out.vibrate(150);
            if (e.step.kind === 'tap') say(announce(e.step));
            else if (prefs.beeps) out.beep('go');
            break;
          case 'finished':
            if (prefs.vibration) out.vibrate([200, 100, 200]);
            if (prefs.beeps) out.beep('end');
            if (voiceOn()) out.speak('Workout complete');
            break;
        }
      }
    },
  };
}
