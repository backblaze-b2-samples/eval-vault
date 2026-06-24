import Link from "next/link";
import { Plus } from "lucide-react";

import { EvalList } from "@/components/evals/eval-list";
import { Button } from "@/components/ui/button";

export default function EvalsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Evals</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Pick an eval and run it against the configured Claude targets. Every
            input, output, score, and trace is archived to B2.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/evals/new">
            <Plus className="h-4 w-4" />
            Create eval
          </Link>
        </Button>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <EvalList />
      </div>
    </div>
  );
}
