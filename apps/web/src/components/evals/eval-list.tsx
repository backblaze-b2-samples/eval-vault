"use client";

import { useRouter } from "next/navigation";
import { Play, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ApiError } from "@/lib/api-client";
import { useEvals, useRunEval } from "@/lib/queries";
import type { EvalDefinition } from "@eval-vault/shared";

function EvalCard({ definition }: { definition: EvalDefinition }) {
  const router = useRouter();
  const runMutation = useRunEval();

  const handleRun = () => {
    runMutation.mutate(definition.name, {
      onSuccess: (manifest) => {
        toast.success(`Run archived: ${manifest.run_id}`);
        router.push(`/library/${manifest.run_id}`);
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Run failed";
        toast.error(detail);
      },
    });
  };

  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-start justify-between border-b border-border py-4 px-5 space-y-0 gap-4">
        <div className="min-w-0">
          <CardTitle className="card-title">{definition.name}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{definition.description}</p>
        </div>
        <Button size="sm" className="h-8 shrink-0" onClick={handleRun} disabled={runMutation.isPending}>
          {runMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {runMutation.isPending ? "Running..." : "Run"}
        </Button>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Targets
          </p>
          <div className="flex flex-wrap gap-1.5">
            {definition.targets.map((t) => (
              <Badge key={t.id} variant="secondary" className="font-mono text-xs">
                {t.id}: {t.model}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Cases ({definition.cases.length})
          </p>
          <ul className="space-y-1">
            {definition.cases.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                <Badge variant="outline" className="text-[10px]">
                  {c.scorer.type}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function EvalList() {
  const { data: evals = [], isLoading, error, refetch } = useEvals();

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (evals.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No evals defined"
        description="Add a YAML file to the repo's /evals directory to define an eval."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {evals.map((d) => (
        <EvalCard key={d.name} definition={d} />
      ))}
    </div>
  );
}
