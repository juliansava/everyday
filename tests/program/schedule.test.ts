import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRAINING_DAYS,
  addDays,
  daysBetween,
  plannedFor,
  todayISO,
  trainingFor,
  weekDates,
  weekStart,
  weekdayOf,
} from '../../src/program/schedule';

describe('dates', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 9, 23, 6, 30))).toBe('2026-10-23');
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('adds days across month ends and the October DST change', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-19', -1)).toBe('2026-10-18');
  });

  it('counts days between two dates', () => {
    expect(daysBetween('2026-10-19', '2026-10-26')).toBe(7);
    expect(daysBetween('2026-10-26', '2026-10-19')).toBe(-7);
  });

  it('numbers weekdays from Monday = 0', () => {
    expect(weekdayOf('2026-10-19')).toBe(0); // Monday
    expect(weekdayOf('2026-10-23')).toBe(4); // Friday
    expect(weekdayOf('2026-10-25')).toBe(6); // Sunday
  });

  it('finds the Monday of a week and lists its 7 days', () => {
    expect(weekStart('2026-10-23')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekDates('2026-10-23')).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
  });
});

describe('weekly schedule', () => {
  it('defaults to Mon/Wed/Fri kettlebell, Tue zone 2, Thu zone 5', () => {
    expect(trainingFor('2026-10-19', DEFAULT_TRAINING_DAYS)).toBe('kb');
    expect(trainingFor('2026-10-20', DEFAULT_TRAINING_DAYS)).toBe('z2');
    expect(trainingFor('2026-10-21', DEFAULT_TRAINING_DAYS)).toBe('kb');
    expect(trainingFor('2026-10-22', DEFAULT_TRAINING_DAYS)).toBe('z5');
    expect(trainingFor('2026-10-23', DEFAULT_TRAINING_DAYS)).toBe('kb');
    expect(trainingFor('2026-10-24', DEFAULT_TRAINING_DAYS)).toBeNull();
    expect(trainingFor('2026-10-25', DEFAULT_TRAINING_DAYS)).toBeNull();
  });

  it('plans the morning routine every day plus that day\'s training', () => {
    expect(plannedFor('2026-10-20', DEFAULT_TRAINING_DAYS)).toEqual(['morning', 'z2']);
    expect(plannedFor('2026-10-24', DEFAULT_TRAINING_DAYS)).toEqual(['morning']);
  });
});
