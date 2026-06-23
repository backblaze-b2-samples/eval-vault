"use client";

import { useState } from "react";
import { GitCompare, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ScoreBadge } from "@/components/evals/score-badge";
import { useComparison, useEvalRuns } from "@/lib/queries";

function RunPicker({
  label,
  value,
  onChange,
  runs,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  runs: { run_id: string; eval_name: string }[];
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a run" />
        </SelectTrigger>
        <SelectContent>
          {runs.map((r) => (
            <SelectItem key={r.run_id} value={r.run_id} className="font-mono text-xs">
              {r.run_id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CompareView() {
  const { data: runs = [], isLoading: runsLoading } = useEvalRuns();
  const [base, setBase] = useState<string | undefined>();
  const [head, setHead] = useState<string | undefined>();
  const { data: result, isLoading, error, refetch } = useComparison(base, head);

  if (runsLoading) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (runs.length < 2) {
    return (
      <EmptyState
        icon={GitCompare}
        title="Need at least two runs"
        description="Run an eval more than once (e.g. after a prompt change) to compare."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-4 p-5">
          <RunPicker label="Base run" value={base} onChange={setBase} runs={runs} />
          <RunPicker label="Head run" value={head} onChange={setHead} runs={runs} />
        </CardContent>
      </Card>

      {base && head && (
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title flex items-center gap-3">
              Diff
              {result && (
                <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                  {result.avg_delta < 0 ? (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-[var(--success)]" />
                  )}
                  {result.avg_delta >= 0 ? "+" : ""}
                  {Math.round(result.avg_delta * 100)}% avg ·{" "}
                  <span className="text-destructive">{result.regressions} regressions</span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <ErrorState error={error} onRetry={() => refetch()} />
            ) : result ? (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Case
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Target
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Base
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Head
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Δ
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.cells.map((cell) => (
                    <TableRow
                      key={`${cell.case_id}-${cell.target_id}`}
                      className={cell.regression ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="font-mono text-xs">{cell.case_id}</TableCell>
                      <TableCell className="font-mono text-xs">{cell.target_id}</TableCell>
                      <TableCell>
                        <ScoreBadge score={cell.base_score} />
                      </TableCell>
                      <TableCell>
                        <ScoreBadge score={cell.head_score} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono tabular-nums"
                          style={{
                            color: cell.regression
                              ? "var(--destructive)"
                              : cell.delta > 0
                                ? "var(--success)"
                                : undefined,
                          }}
                        >
                          {cell.delta >= 0 ? "+" : ""}
                          {Math.round(cell.delta * 100)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
