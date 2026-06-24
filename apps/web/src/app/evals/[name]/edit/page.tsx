import { EvalEditView } from "@/components/evals/eval-edit-view";

export default async function EditEvalPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Edit eval</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Update this eval&apos;s targets, cases, and scorers. Changes are saved
          to B2; the name stays fixed.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2 max-w-3xl">
        <EvalEditView name={name} />
      </div>
    </div>
  );
}
