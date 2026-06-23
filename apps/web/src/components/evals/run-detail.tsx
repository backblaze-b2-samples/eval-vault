"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ScoreBadge } from "@/components/evals/score-badge";
import { ArtifactViewer } from "@/components/evals/artifact-viewer";
import { useRunGrid, useRunManifest } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import type { ScoreCell } from "@eval-vault/shared";

interface Selection {
  caseId: string;
  targetId: string;
}

export function RunDetail({ runId }: { runId: string }) {
  const { data: manifest, isLoading: mLoading, error: mError, refetch: refetchM } =
    useRunManifest(runId);
  const { data: grid, isLoading: gLoading } = useRunGrid(runId);
  const [selection, setSelection] = useState<Selection | null>(null);

  const { caseIds, targetIds, cellMap } = useMemo(() => {
    const cells = grid?.cells ?? [];
    const cMap = new Map<string, ScoreCell>();
    const cset = new Set<string>();
    const tset = new Set<string>();
    for (const cell of cells) {
      cset.add(cell.case_id);
      tset.add(cell.target_id);
      cMap.set(`${cell.case_id}::${cell.target_id}`, cell);
    }
    return {
      caseIds: Array.from(cset).sort(),
      targetIds: manifest?.target_ids ?? Array.from(tset).sort(),
      cellMap: cMap,
    };
  }, [grid, manifest]);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Library
        </Link>
        {mError ? (
          <ErrorState error={mError} onRetry={() => refetchM()} />
        ) : mLoading || !manifest ? (
          <Skeleton className="h-8 w-72" />
        ) : (
          <>
            <h1 className="page-title">{manifest.eval_name}</h1>
            <p className="text-sm text-muted-foreground mt-1.5 font-mono">{manifest.run_id}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
              <span>{formatDate(manifest.created_at)}</span>
              <span>·</span>
              <span>
                {manifest.summary.passed}/{manifest.summary.total_calls} passed
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                avg <ScoreBadge score={manifest.summary.avg_score} />
              </span>
            </div>
          </>
        )}
      </div>

      <Card className="animate-fade-in-up stagger-2">
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Cases × Targets</CardTitle>
        </CardHeader>
        <CardContent className="p-5 overflow-x-auto">
          {gLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <table className="w-full text-sm border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground p-2">
                    Case
                  </th>
                  {targetIds.map((t) => (
                    <th
                      key={t}
                      className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground p-2"
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {caseIds.map((caseId) => (
                  <tr key={caseId}>
                    <td className="font-mono text-xs p-2 whitespace-nowrap">{caseId}</td>
                    {targetIds.map((targetId) => {
                      const cell = cellMap.get(`${caseId}::${targetId}`);
                      return (
                        <td key={targetId} className="text-center p-1">
                          {cell ? (
                            <button
                              onClick={() => setSelection({ caseId, targetId })}
                              className="rounded-md px-2 py-1 hover:bg-accent/60 transition-colors"
                              title="View input / output / score / trace"
                            >
                              <ScoreBadge score={cell.score} passed={cell.passed} />
                            </button>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              —
                            </Badge>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ArtifactViewer
        runId={runId}
        caseId={selection?.caseId}
        targetId={selection?.targetId}
        open={!!selection}
        onOpenChange={(open) => !open && setSelection(null)}
      />
    </div>
  );
}
