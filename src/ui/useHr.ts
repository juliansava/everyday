import { useEffect, useState } from 'preact/hooks';
import type { HrSource } from '../hr/types';

/** Re-renders on every strap status change and reading. */
export function useHr(hr: HrSource) {
  const [, setTick] = useState(0);
  useEffect(() => hr.subscribe(() => setTick((n) => n + 1)), [hr]);
  return { status: hr.status(), latest: hr.latest() };
}
