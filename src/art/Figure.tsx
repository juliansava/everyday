import { useEffect, useState } from 'preact/hooks';
import { EXERCISES } from '../program/exercises';
import type { ExerciseId } from '../program/types';
import { poseAt } from './interpolate';
import { DRAWINGS } from './poses';

type Pt = readonly [number, number];

const BODY = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function Figure({ exerciseId, size = 200 }: { exerciseId: ExerciseId; size?: number }) {
  const drawing = DRAWINGS[exerciseId];
  const [t, setT] = useState(0);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(drawing.durationSec * (drawing.stops?.[1] ?? 0.5));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [exerciseId]);

  const p = poseAt(drawing, t);
  const joints: Pt[] = Array.from({ length: 11 }, (_, j) => [p[j * 2], p[j * 2 + 1]] as const);
  const [head, neck, hip, lElbow, lHand, rElbow, rHand, lKnee, lFoot, rKnee, rFoot] = joints;
  const line = (...pts: Pt[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const bells: Pt[] =
    drawing.bell === 'l' ? [lHand]
    : drawing.bell === 'r' ? [rHand]
    : drawing.bell === 'both' ? [[(lHand[0] + rHand[0]) / 2, (lHand[1] + rHand[1]) / 2]]
    : [];

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} class="figure" role="img" aria-label={EXERCISES[exerciseId].name}>
      <line x1="4" y1="93" x2="96" y2="93" style={{ stroke: 'currentColor', strokeWidth: 1, opacity: 0.3 }} />
      <g style={BODY}>
        <polyline points={line(neck, hip)} />
        <polyline points={line(neck, lElbow, lHand)} />
        <polyline points={line(neck, rElbow, rHand)} />
        <polyline points={line(hip, lKnee, lFoot)} />
        <polyline points={line(hip, rKnee, rFoot)} />
        <circle cx={head[0]} cy={head[1]} r={6} />
      </g>
      {bells.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y + 4} r={4.5} style={{ fill: 'var(--accent)' }} />
      ))}
    </svg>
  );
}
