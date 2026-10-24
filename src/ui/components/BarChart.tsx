export interface BarDatum {
  label: string;
  value: number;
}

const W = 320;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;

export function BarChart({ data, unit = '', height = 120 }: { data: BarDatum[]; unit?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = W / data.length;
  const plot = height - PAD_TOP - PAD_BOTTOM;
  return (
    <svg
      class="chart"
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={data.map((d) => `${d.label || '·'} ${d.value}${unit}`).join(', ')}
    >
      <line class="grid" x1={0} x2={W} y1={height - PAD_BOTTOM} y2={height - PAD_BOTTOM} />
      {data.map((d, i) => {
        const h = (plot * d.value) / max;
        const cx = i * slot + slot / 2;
        return (
          <g key={i}>
            <rect x={cx - slot * 0.35} y={height - PAD_BOTTOM - h} width={slot * 0.7} height={h} rx={3} fill="currentColor" />
            {d.value > 0 && (
              <text x={cx} y={height - PAD_BOTTOM - h - 3}>
                {d.value}
              </text>
            )}
            {d.label && (
              <text x={cx} y={height - 4}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
