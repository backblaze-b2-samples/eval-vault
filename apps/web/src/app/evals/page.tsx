import { EvalList } from "@/components/evals/eval-list";

export default function EvalsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Evals</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Pick an eval and run it against the configured Claude targets. Every
          input, output, score, and trace is archived to B2.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <EvalList />
      </div>
    </div>
  );
}
