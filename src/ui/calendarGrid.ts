import { addDays, weekStart } from '../program/schedule';

/** 6 weeks × 7 days of dates covering `month` (1–12) of `year`, Monday first. */
export function monthGrid(year: number, month: number): string[] {
  const start = weekStart(`${year}-${String(month).padStart(2, '0')}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function monthOf(date: string): { year: number; month: number } {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthTitle(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
