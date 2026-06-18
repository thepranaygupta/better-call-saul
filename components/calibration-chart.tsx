'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  LabelList,
  Tooltip,
} from 'recharts';
import type { CalibrationBand } from '@/app/(app)/analytics/actions';

/** Band colors from the design system */
const BAND_COLORS: Record<string, string> = {
  call_now: '#991B1B', // red-800
  qualify: '#D97706',  // amber-600
  nurture: '#0F766E',  // teal-700
  cold: '#A8A29E',     // stone-400
};

interface CalibrationChartProps {
  bands: CalibrationBand[];
}

/** Custom label rendered above each bar showing enrolled/total = rate% */
function BarLabel(props: Record<string, unknown>) {
  const { x, y, width, value } = props as {
    x: number;
    y: number;
    width: number;
    value: number;
    index: number;
  };
  const band = (props as { payload?: CalibrationBand }).payload;
  if (!band) return null;

  const label =
    band.total > 0
      ? `${band.enrolled}/${band.total}`
      : '0/0';

  return (
    <g>
      <text
        x={x + width / 2}
        y={y - 8}
        fill="#1C1917"
        fontSize={13}
        fontWeight={600}
        fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
        textAnchor="middle"
        dominantBaseline="auto"
      >
        {value}%
      </text>
      <text
        x={x + width / 2}
        y={y - 22}
        fill="#78716C"
        fontSize={11}
        fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
        textAnchor="middle"
        dominantBaseline="auto"
      >
        {label}
      </text>
    </g>
  );
}

/** Custom tooltip on hover */
function CalibrationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CalibrationBand }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  if (!entry) return null;
  const band = entry.payload;

  return (
    <div className="border border-stone-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-widest text-stone-500">
        {band.label}
      </p>
      <p
        className="mt-1 text-[15px] font-semibold text-stone-950"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
      >
        {band.conversionRate}% conversion
      </p>
      <p className="text-[12px] text-stone-500">
        {band.enrolled} enrolled of {band.total} leads
      </p>
    </div>
  );
}

export function CalibrationChart({ bands }: CalibrationChartProps) {
  if (!bands.length || bands.every((b) => b.total === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-[13px] text-stone-500">
        No calibration data available.
      </div>
    );
  }

  // Max conversion rate for Y-axis domain (pad slightly above max)
  const maxRate = Math.max(...bands.map((b) => b.conversionRate), 1);
  const yMax = Math.ceil(maxRate / 10) * 10 + 10;

  return (
    <div className="w-full">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={bands}
            margin={{ top: 36, right: 16, bottom: 8, left: 8 }}
            barCategoryGap="25%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E7E5E4"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{
                fill: '#78716C',
                fontSize: 11,
                fontWeight: 500,
              }}
              tickLine={false}
              axisLine={{ stroke: '#E7E5E4' }}
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{
                fill: '#A8A29E',
                fontSize: 11,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              width={48}
            />
            <Tooltip
              content={<CalibrationTooltip />}
              cursor={{ fill: '#F5F5F4' }}
            />
            <Bar
              dataKey="conversionRate"
              radius={[2, 2, 0, 0]}
              maxBarSize={80}
            >
              {bands.map((band) => (
                <Cell
                  key={band.band}
                  fill={BAND_COLORS[band.band] ?? '#A8A29E'}
                />
              ))}
              <LabelList
                dataKey="conversionRate"
                content={<BarLabel />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary row */}
      <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-stone-200 pt-3">
        {bands.map((band) => (
          <div key={band.band} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5"
              style={{ backgroundColor: BAND_COLORS[band.band] ?? '#A8A29E' }}
            />
            <span className="text-[11px] text-stone-500">
              {band.label}
            </span>
            <span
              className="text-[12px] font-medium text-stone-950"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
            >
              {band.conversionRate}%
            </span>
            <span className="text-[11px] text-stone-400">
              ({band.enrolled}/{band.total})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
