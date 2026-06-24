"use client";

import { useWatch, type Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  EXPECTED_SCORERS,
  SCORER_TYPES,
  type EvalFormValues,
} from "./eval-create-schema";

/** Scorer config for a single case. The visible fields depend on the scorer
 * type: expected (deterministic matchers), rubric (llm_judge), or neither
 * (json_valid). pass_threshold is always shown. */
export function ScorerFields({
  control,
  index,
}: {
  control: Control<EvalFormValues>;
  index: number;
}) {
  const type = useWatch({ control, name: `cases.${index}.scorer.type` });
  const showExpected = (EXPECTED_SCORERS as readonly string[]).includes(type);
  const showRubric = type === "llm_judge";

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/30 p-3">
      <FormField
        control={control}
        name={`cases.${index}.scorer.type`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Scorer</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full sm:w-60">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {SCORER_TYPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {showExpected && (
        <FormField
          control={control}
          name={`cases.${index}.scorer.expected`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expected</FormLabel>
              <FormControl>
                <Input
                  placeholder="Substring, pattern, or exact text to match"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {showRubric && (
        <FormField
          control={control}
          name={`cases.${index}.scorer.rubric`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rubric</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="How the judge should score the answer from 0 to 1"
                  className="resize-none"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Scored by the judge model set on this eval.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={control}
        name={`cases.${index}.scorer.pass_threshold`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Pass threshold</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={1}
                className="w-32 font-mono tabular-nums"
                {...field}
              />
            </FormControl>
            <FormDescription>0–1. A score at or above this passes.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
