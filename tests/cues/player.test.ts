import { describe, expect, it } from 'vitest';
import { createCuePlayer, type CueOutputs, type CuePrefs } from '../../src/cues/player';
import type { TapStep, TimedStep } from '../../src/program/types';

function fakeOutputs(canSpeak = true) {
  const calls: string[] = [];
  const out: CueOutputs = {
    canSpeak: () => canSpeak,
    speak: (text) => calls.push(`speak:${text}`),
    beep: (kind) => calls.push(`beep:${kind}`),
    vibrate: (pattern) => calls.push(`vibrate:${JSON.stringify(pattern)}`),
  };
  return { out, calls };
}

const ALL: CuePrefs = { voice: true, beeps: true, vibration: true };
const NONE: CuePrefs = { voice: false, beeps: false, vibration: false };
const timed: TimedStep = { kind: 'timed', id: 'rest-1', title: 'Rest', durationSec: 90, cues: [] };
const tap: TapStep = {
  kind: 'tap', id: 'c-1-0', title: 'Single-arm swing', block: 'circuit', round: 1,
  items: [{ exerciseId: 'single-arm-swing', reps: 10 }], weightKg: 12,
};

describe('cue player', () => {
  it('speaks cues and ticks the countdown', () => {
    const { out, calls } = fakeOutputs();
    createCuePlayer(ALL, out).handle([{ type: 'say', text: 'Next: Halo' }, { type: 'beep', remaining: 3 }]);
    expect(calls).toEqual(['speak:Next: Halo', 'beep:tick']);
  });

  it('buzzes and beeps when a timed step starts', () => {
    const { out, calls } = fakeOutputs();
    createCuePlayer(ALL, out).handle([{ type: 'step', index: 0, step: timed }]);
    expect(calls).toEqual(['vibrate:150', 'beep:go']);
  });

  it('announces a tap step out loud', () => {
    const { out, calls } = fakeOutputs();
    createCuePlayer(ALL, out).handle([{ type: 'step', index: 3, step: tap }]);
    expect(calls).toEqual(['vibrate:150', 'speak:Single-arm swing. 10 per side. 12 kilos']);
  });

  it('beeps instead of speaking when voice is off or unavailable', () => {
    const off = fakeOutputs();
    createCuePlayer({ ...ALL, voice: false }, off.out).handle([{ type: 'say', text: 'Switch sides' }]);
    expect(off.calls).toEqual(['beep:go']);
    const noVoice = fakeOutputs(false);
    createCuePlayer(ALL, noVoice.out).handle([{ type: 'say', text: 'Switch sides' }]);
    expect(noVoice.calls).toEqual(['beep:go']);
  });

  it('stays silent with every cue turned off', () => {
    const { out, calls } = fakeOutputs();
    createCuePlayer(NONE, out).handle([
      { type: 'say', text: 'x' },
      { type: 'beep', remaining: 1 },
      { type: 'step', index: 0, step: tap },
    ]);
    expect(calls).toEqual([]);
  });

  it('signals the end of the workout', () => {
    const { out, calls } = fakeOutputs();
    createCuePlayer(ALL, out).handle([{ type: 'finished' }]);
    expect(calls).toEqual(['vibrate:[200,100,200]', 'beep:end', 'speak:Workout complete']);
  });
});
