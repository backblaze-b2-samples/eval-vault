"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ApiError } from "@/lib/api-client";
import { useCreateEval, useUpdateEval } from "@/lib/queries";
import {
  defaultEvalForm,
  emptyCase,
  emptyTarget,
  evalFormSchema,
  toDefinition,
  type EvalFormValues,
} from "./eval-create-schema";
import { TargetFields } from "./eval-target-fields";
import { CaseFields } from "./eval-case-fields";

/** Shared targets + cases + scorers form for both creating a new eval and
 * editing an existing one. In edit mode the name is locked (it's the eval's
 * identifier and B2 key) and the form is pre-filled from `initial`. */
export function EvalForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: EvalFormValues;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  // Both hooks are always called (Rules of Hooks); we pick one by mode.
  const createMutation = useCreateEval();
  const updateMutation = useUpdateEval();
  const mutation = isEdit ? updateMutation : createMutation;

  const form = useForm<EvalFormValues>({
    resolver: zodResolver(evalFormSchema),
    defaultValues: initial ?? defaultEvalForm(),
  });

  const targets = useFieldArray({ control: form.control, name: "targets" });
  const cases = useFieldArray({ control: form.control, name: "cases" });

  const onSubmit = (values: EvalFormValues) => {
    const definition = toDefinition(values);
    const onSuccess = (defn: { name: string }) => {
      toast.success(
        isEdit ? `Eval "${defn.name}" updated` : `Eval "${defn.name}" created`,
      );
      router.push("/evals");
    };
    const onError = (err: ApiError) => {
      // Name uniqueness spans shipped + saved definitions, so a clash can only be
      // confirmed server-side (create only — the name is locked when editing).
      if (!isEdit && err.isConflict) {
        form.setError("name", { message: err.message });
        toast.error(err.message);
        return;
      }
      toast.error(
        err instanceof ApiError
          ? err.message
          : `Failed to ${isEdit ? "update" : "create"} eval`,
      );
    };
    if (isEdit) {
      updateMutation.mutate(definition, { onSuccess, onError });
    } else {
      createMutation.mutate(definition, { onSuccess, onError });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basics */}
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Basics</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="factual-qa" {...field} disabled={isEdit} />
                  </FormControl>
                  <FormDescription>
                    {isEdit ? (
                      <>The name is the eval&apos;s identifier and can&apos;t be changed.</>
                    ) : (
                      <>
                        Unique identifier. Lowercase slug, e.g. <code>my-eval</code>.
                      </>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What this eval measures"
                      className="resize-none"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="judge_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Judge model</FormLabel>
                  <FormControl>
                    <Input placeholder="claude-sonnet-4-6" {...field} />
                  </FormControl>
                  <FormDescription>
                    Used only by <code>llm_judge</code> scorers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Targets */}
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Targets</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {targets.fields.map((f, i) => (
              <TargetFields
                key={f.id}
                control={form.control}
                index={i}
                onRemove={() => targets.remove(i)}
                canRemove={targets.fields.length > 1}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => targets.append(emptyTarget())}
            >
              <Plus className="h-3.5 w-3.5" />
              Add target
            </Button>
          </CardContent>
        </Card>

        {/* Cases */}
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Cases</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {cases.fields.map((f, i) => (
              <CaseFields
                key={f.id}
                control={form.control}
                index={i}
                onRemove={() => cases.remove(i)}
                canRemove={cases.fields.length > 1}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cases.append(emptyCase())}
            >
              <Plus className="h-3.5 w-3.5" />
              Add case
            </Button>
          </CardContent>
        </Card>

        {/* Action bar */}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/evals")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save changes"
                : "Create eval"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
