import { useEffect, useRef, useState } from 'preact/hooks';
import { browserOutputs, stopSpeech } from '../cues/browser';
import { createCuePlayer, type CuePlayer, type CuePrefs } from '../cues/player';
import { keepAwake } from '../cues/wakeLock';
import { Runner, type RunnerEvent } from '../engine/runner';
import type { Step } from '../program/types';
import { now } from './clock';

export interface RunnerHooks {
  onStep?(index: number): void;
  onFinish?(): void;
  /** Called on every tick (4 times a second), after the tick's events. */
  onTick?(runner: Runner): void;
}

/**
 * Runs `steps` with cues and the screen kept awake; re-renders the caller 4 times a second.
 * `startOffsetSec` resumes part-way into the start step (rides).
 */
export function useRunner(
  steps: Step[],
  startIndex: number,
  prefs: CuePrefs,
  hooks: RunnerHooks = {},
  startOffsetSec = 0,
) {
  const runnerRef = useRef<Runner | null>(null);
  runnerRef.current ??= new Runner(steps, now, startIndex, startOffsetSec);
  const runner = runnerRef.current;

  const cuesRef = useRef<CuePlayer | null>(null);
  cuesRef.current ??= createCuePlayer(prefs, browserOutputs);
  const cues = cuesRef.current;

  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  const [, setFrame] = useState(0);
  const rerender = () => setFrame((f) => f + 1);

  const handle = (events: RunnerEvent[]) => {
    cues.handle(events);
    for (const e of events) {
      if (e.type === 'step') hooksRef.current.onStep?.(e.index);
      if (e.type === 'finished') hooksRef.current.onFinish?.();
    }
    rerender();
  };

  useEffect(() => {
    handle(runner.start());
    const release = keepAwake();
    const id = setInterval(() => {
      handle(runner.tick());
      hooksRef.current.onTick?.(runner);
    }, 250);
    return () => {
      clearInterval(id);
      release();
      // A finished runner unmounts right after "Workout complete" is queued; cancelling would clip it.
      if (!runner.finished) stopSpeech();
    };
  }, []);

  return {
    runner,
    say: (text: string) => cues.say(text),
    done: () => handle(runner.done()),
    back: () => handle(runner.back()),
    pause: () => {
      runner.pause();
      rerender();
    },
    resume: () => {
      runner.resume();
      rerender();
    },
  };
}
