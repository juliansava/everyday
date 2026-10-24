import { describe, expect, it } from 'vitest';
import { monthGrid, monthOf, monthTitle, shiftMonth } from '../../src/ui/calendarGrid';

describe('calendar grid', () => {
  it('lays out 6 Monday-first weeks around the month', () => {
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-09-28');
    expect(grid[3]).toBe('2026-10-01');
    expect(grid[41]).toBe('2026-11-08');
  });

  it('moves between months across years', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthOf('2026-10-23')).toEqual({ year: 2026, month: 10 });
  });

  it('titles the month', () => {
    expect(monthTitle(2026, 10)).toBe('October 2026');
  });
});
