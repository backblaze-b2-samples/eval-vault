"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Loader2,
  ClipboardList,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api-client";
import { useDeleteEval, useEvals, useRunEval } from "@/lib/queries";
import type { EvalDefinitionSummary } from "@eval-vault/shared";

function EvalCard({ definition }: { definition: EvalDefinitionSummary }) {
  const router = useRouter();
  const runMutation = useRunEval();
  const deleteMutation = useDeleteEval();
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const handleDelete = () => {
    deleteMutation.mutate(definition.name, {
      onSuccess: () => {
        toast.success(`Eval "${definition.name}" deleted`);
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Failed to delete eval";
        toast.error(detail);
      },
      onSettled: () => setConfirmOpen(false),
    });
  };

  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-start justify-between border-b border-border py-4 px-5 space-y-0 gap-4">
        <div className="min-w-0">
          <CardTitle className="card-title">{definition.name}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{definition.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" className="h-8" onClick={handleRun} disabled={runMutation.isPending}>
            {runMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {runMutation.isPending ? "Running..." : "Run"}
          </Button>
          {definition.editable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Eval actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/evals/${encodeURIComponent(definition.name)}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete eval?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the definition &quot;{definition.name}&quot; from
              B2. Archived runs are not affected. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        description="Create an eval from the UI, or add a YAML file to the repo's /evals directory."
        action={
          <Button asChild>
            <Link href="/evals/new">
              <Plus className="h-4 w-4" />
              Create eval
            </Link>
          </Button>
        }
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
