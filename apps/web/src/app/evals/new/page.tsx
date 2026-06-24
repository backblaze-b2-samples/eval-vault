import { EvalForm } from "@/components/evals/eval-form";

export default function NewEvalPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">New eval</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Define an eval&apos;s targets, cases, and scorers. It&apos;s saved to
          B2 and appears in the list, ready to run — no YAML required.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2 max-w-3xl">
        <EvalForm mode="create" />
      </div>
    </div>
  );
}
