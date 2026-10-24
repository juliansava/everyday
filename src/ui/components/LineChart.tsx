export interface LinePoint {
  label: string;
  value: number;
}

const W = 320;
const PAD_X = 22;
const PAD_TOP = 16;
const PAD_BOTTOM = 18;

export function LineChart({ points, unit = '', height = 120 }: { points: LinePoint[]; unit?: string; height?: number }) {
  if (points.length === 0) return <p class="muted small">Your first session will show up here.</p>;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (points.length - 1));
  const y = (v: number) => height - PAD_BOTTOM - ((v - min) / span) * (height - PAD_TOP - PAD_BOTTOM);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg
      class="chart"
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={points.map((p) => `${p.label} ${p.value}${unit}`).join(', ')}
    >
      <line class="grid" x1={0} x2={W} y1={height - PAD_BOTTOM} y2={height - PAD_BOTTOM} />
      <path d={path} style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 2 }} />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={3} fill="currentColor" />
      ))}
      <text x={x(0)} y={height - 4}>
        {points[0].label}
      </text>
      {points.length > 1 && (
        <text x={x(points.length - 1)} y={height - 4}>
          {last.label}
        </text>
      )}
      <text x={x(points.length - 1)} y={y(last.value) - 6}>
        {last.value}
        {unit}
      </text>
    </svg>
  );
}
