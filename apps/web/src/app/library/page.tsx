import { RunList } from "@/components/evals/run-list";

export default function LibraryPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Library</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Archived eval runs, scoped to the{" "}
          <code className="font-mono text-xs">evals/runs/</code> prefix in your
          B2 bucket. Drill into a run to inspect every input, output, score, and
          trace.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <RunList />
      </div>
    </div>
  );
}
