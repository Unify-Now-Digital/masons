import React from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { ChartConfig } from '@/shared/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import type { SentryTrendPoint } from '@/modules/monitoring/types/sentry.types';

const chartConfig = {
  errors: {
    label: 'Errors',
    color: 'hsl(217 91% 45%)',
  },
} satisfies ChartConfig;

function formatTick(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface SentryErrorTrendChartProps {
  series: SentryTrendPoint[];
  isLoading?: boolean;
  error?: Error | null;
}

export const SentryErrorTrendChart: React.FC<SentryErrorTrendChartProps> = ({
  series,
  isLoading,
  error,
}) => {
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-md border bg-white p-8 text-center text-sm text-muted-foreground">
        Loading chart…
      </div>
    );
  }

  if (!series.length) {
    return (
      <div className="rounded-md border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">
        Not enough data yet for a trend chart. After more error volume is recorded, a daily series will appear
        here.
      </div>
    );
  }

  const data = series.map((p) => ({
    ...p,
    label: formatTick(p.ts),
  }));

  return (
    <div className="rounded-md border bg-white p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Error volume (daily)</h3>
      <ChartContainer config={chartConfig} className="h-[220px] w-full min-w-0">
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
          <YAxis tickLine={false} axisLine={false} width={40} className="text-xs" allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <Line
            type="monotone"
            dataKey="errors"
            stroke="var(--color-errors)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
};
