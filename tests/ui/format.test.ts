import { describe, expect, it } from 'vitest';
import { dayName, estimatedMinutes, mmss, peaksText, recoveryText, shortDate } from '../../src/ui/format';

describe('format', () => {
  it('formats seconds as m:ss or h:mm:ss, rounding down', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(65)).toBe('1:05');
    expect(mmss(59.9)).toBe('0:59');
    expect(mmss(3725)).toBe('1:02:05');
    expect(mmss(-3)).toBe('0:00');
  });

  it('names days and short dates', () => {
    expect(dayName('2026-10-23')).toBe('Friday');
    expect(shortDate('2026-10-23')).toBe('23 Oct');
  });

  it('signs heart-rate recovery: a drop is minus, a rise is plus', () => {
    expect(recoveryText(32)).toBe('−32 bpm');
    expect(recoveryText(-3)).toBe('+3 bpm');
    expect(recoveryText(0)).toBe('0 bpm');
    expect(recoveryText(null)).toBe('–');
    expect(recoveryText(undefined)).toBe('–');
  });

  it('lists interval peaks in bpm, leaving out intervals without a reading', () => {
    expect(peaksText([176, 0, 181])).toBe('176 · 181 bpm');
    expect(peaksText([0, 0])).toBe('–');
    expect(peaksText(undefined)).toBe('–');
  });

  it('estimates session length in minutes', () => {
    expect(estimatedMinutes('morning', [])).toBe(5);
    expect(estimatedMinutes('kb', [])).toBe(35);
    expect(estimatedMinutes('z2', [])).toBe(55);
    expect(estimatedMinutes('z5', [])).toBe(40);
  });
});
