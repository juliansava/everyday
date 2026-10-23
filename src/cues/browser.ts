import type { CueOutputs } from './player';

let ctx: AudioContext | null = null;
let voice: SpeechSynthesisVoice | null = null;
const hasSpeech = typeof speechSynthesis !== 'undefined';

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice =
    voices.find((v) => v.lang.startsWith('en') && v.localService) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null;
}

if (hasSpeech) {
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

/** Call inside a tap handler: browsers only allow sound after a user gesture. */
export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  if (hasSpeech) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
}

export function stopSpeech(): void {
  if (hasSpeech) speechSynthesis.cancel();
}

function tone(freq: number, ms: number, delayMs = 0) {
  if (!ctx) return;
  const start = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.3, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + ms / 1000);
}

export const browserOutputs: CueOutputs = {
  canSpeak: () => hasSpeech && voice !== null,
  speak(text) {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = 1.05;
    speechSynthesis.speak(u);
  },
  beep(kind) {
    if (kind === 'tick') tone(880, 120);
    else if (kind === 'go') tone(1320, 250);
    else {
      tone(660, 200);
      tone(990, 400, 220);
    }
  },
  vibrate(pattern) {
    navigator.vibrate?.(pattern);
  },
};
