"use client";

import Link from "next/link";
import { ClipboardList, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useEvals } from "@/lib/queries";
import { EvalForm } from "./eval-form";
import { fromDefinition } from "./eval-create-schema";

/** Loads the named eval from the (cached) list and renders the edit form.
 * Shipped (non-editable) evals and unknown names get a clear message instead
 * of a form — the backend enforces the same rule, this is just good UX. */
export function EvalEditView({ name }: { name: string }) {
  const { data: evals = [], isLoading, error, refetch } = useEvals();

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const definition = evals.find((d) => d.name === name);

  if (!definition) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Eval not found"
        description={`No eval named "${name}" exists.`}
        action={
          <Button asChild variant="outline">
            <Link href="/evals">Back to evals</Link>
          </Button>
        }
      />
    );
  }

  if (!definition.editable) {
    return (
      <EmptyState
        icon={Lock}
        title="This eval can't be edited"
        description={`"${name}" ships with the app as a read-only YAML example. Create a new eval from the UI to customize it.`}
        action={
          <Button asChild variant="outline">
            <Link href="/evals">Back to evals</Link>
          </Button>
        }
      />
    );
  }

  return <EvalForm mode="edit" initial={fromDefinition(definition)} />;
}
