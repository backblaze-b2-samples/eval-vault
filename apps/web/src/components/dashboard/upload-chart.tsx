"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useEvalRuns } from "@/lib/queries";

const chartConfig = {
  score: {
    label: "Avg score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

// Score trend across the most recent archived runs (oldest → newest).
export function ScoreTrendChart() {
  const { data: runs, error, refetch } = useEvalRuns();

  const data = useMemo(() => {
    const recent = (runs ?? []).slice(0, 12).reverse();
    return recent.map((r) => ({
      label: new Date(r.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: Math.round(r.avg_score * 100),
    }));
  }, [runs]);

  const latest = data.length > 0 ? data[data.length - 1].score : 0;

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Score Trend</CardTitle>
        <CardDescription className="text-xs">Avg score per archived run</CardDescription>
        <CardAction className="text-right self-center">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Latest
          </div>
          <div className="text-lg font-semibold tabular-nums tracking-tight leading-tight">
            {latest}%
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-5">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={LineChartIcon}
            title="No runs yet"
            description="Run an eval to see score trends here."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-score)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-score)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                fontSize={11}
                width={32}
              />
              <ChartTooltip cursor={{ fill: "var(--accent-subtle)" }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="score"
                fill="url(#score-fill)"
                radius={[4, 4, 0, 0]}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
