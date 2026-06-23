import { CompareView } from "@/components/evals/compare-view";

export default function ComparePage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Compare</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Diff two archived runs cell-by-cell to hunt regressions when you change
          a model or tweak a prompt.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <CompareView />
      </div>
    </div>
  );
}
