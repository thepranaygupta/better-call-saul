'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { FunnelStage } from '@/app/(app)/analytics/actions';

/** Warm amber gradient: darkest at top (Registered), lightest at bottom (Enrolled) */
const STAGE_COLORS = [
  '#92400E', // amber-800 -- Registered
  '#B45309', // amber-700 -- Attended
  '#D97706', // amber-600 -- Connected
  '#F59E0B', // amber-500 -- Enrolled
];

interface FunnelChartProps {
  stages: FunnelStage[];
}

interface ChartDatum {
  name: string;
  count: number;
  percentage: number;
  stageToStageRate: number | null;
}

/** Custom tooltip matching the warm-stone design system */
function CustomTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}) {
  const { active, payload } = props;
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="border border-stone-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-widest text-stone-500">
        {d.name}
      </p>
      <p
        className="text-[15px] font-semibold text-stone-950"
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        }}
      >
        {d.count.toLocaleString()}
      </p>
      <p className="text-[11px] text-stone-400">
        {d.percentage}% of registered
      </p>
      {d.stageToStageRate !== null && (
        <p className="text-[11px] text-stone-400">
          {d.stageToStageRate}% from previous stage
        </p>
      )}
    </div>
  );
}

/** Custom Y-axis tick: uppercase tracking-widest labels */
function CustomYTick(props: Record<string, unknown>) {
  const { x, y, payload } = props as {
    x: number;
    y: number;
    payload: { value: string };
  };
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="#78716C"
      fontSize={11}
      fontWeight={500}
      style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
    >
      {payload.value}
    </text>
  );
}

/** Custom bar label: count + percentage, monospace */
function CustomBarLabel(props: Record<string, unknown>) {
  const { x, y, width, height, value } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
  };
  const datum = (props as { payload?: ChartDatum }).payload;
  const pct = datum?.percentage ?? 0;

  return (
    <text
      x={(x ?? 0) + (width ?? 0) + 8}
      y={(y ?? 0) + (height ?? 0) / 2}
      fill="#1C1917"
      fontSize={13}
      fontWeight={500}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      dominantBaseline="middle"
    >
      {(value ?? 0).toLocaleString()}
      <tspan fill="#A8A29E" fontSize={11} dx={4}>
        ({pct}%)
      </tspan>
    </text>
  );
}

export function FunnelChart({ stages }: FunnelChartProps) {
  if (!stages.length) {
    return (
      <div className="flex h-48 items-center justify-center text-[13px] text-stone-500">
        No funnel data available.
      </div>
    );
  }

  // Prepare chart data with stage-to-stage conversion rates
  const chartData: ChartDatum[] = stages.map((stage, i) => {
    const prevStage = i > 0 ? stages[i - 1] : undefined;
    return {
      name: stage.name,
      count: stage.count,
      percentage: stage.percentage,
      stageToStageRate:
        prevStage && prevStage.count > 0
          ? Math.round((stage.count / prevStage.count) * 100)
          : null,
    };
  });

  return (
    <div className="w-full">
      {/* Recharts horizontal bar chart */}
      <ResponsiveContainer width="100%" height={stages.length * 56 + 16}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 120, bottom: 4, left: 80 }}
          barCategoryGap={12}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={CustomYTick}
            width={80}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: '#F5F5F4' }}
          />
          <Bar
            dataKey="count"
            radius={[0, 2, 2, 0]}
            label={<CustomBarLabel />}
            maxBarSize={36}
          >
            {chartData.map((_, i) => (
              <Cell
                key={`cell-${i}`}
                fill={STAGE_COLORS[i] ?? STAGE_COLORS[STAGE_COLORS.length - 1]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Stage-to-stage conversion rates */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        {chartData.map((d) =>
          d.stageToStageRate !== null ? (
            <span key={d.name} className="text-[11px] text-stone-400">
              <span className="text-stone-500">{d.name}:</span>{' '}
              <span
                className="font-medium text-stone-600"
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                }}
              >
                {d.stageToStageRate}%
              </span>{' '}
              from prev
            </span>
          ) : null,
        )}
      </div>

      {/* Overall conversion summary */}
      <div className="mt-3 flex items-center gap-4 border-t border-stone-200 pt-3">
        <span className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
          Overall conversion
        </span>
        <span
          className="text-[15px] font-semibold text-amber-800"
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          {(() => {
            const first = stages[0];
            const last = stages[stages.length - 1];
            if (stages.length >= 2 && first && last && first.count > 0) {
              return `${Math.round((last.count / first.count) * 100)}%`;
            }
            return '0%';
          })()}
        </span>
        <span className="text-[11px] text-stone-400">
          {(() => {
            const first = stages[0];
            const last = stages[stages.length - 1];
            if (stages.length >= 2 && first && last) {
              return `${last.count.toLocaleString()} of ${first.count.toLocaleString()}`;
            }
            return '';
          })()}
        </span>
      </div>
    </div>
  );
}
