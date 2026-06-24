"use client";

import { Trash2 } from "lucide-react";
import { type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScorerFields } from "./scorer-fields";
import { type EvalFormValues } from "./eval-create-schema";

/** One test case row in the cases field array: prompt + optional system +
 * the embedded scorer config. */
export function CaseFields({
  control,
  index,
  onRemove,
  canRemove,
}: {
  control: Control<EvalFormValues>;
  index: number;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Case {index + 1}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </Button>
      </div>

      <FormField
        control={control}
        name={`cases.${index}.id`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>ID</FormLabel>
            <FormControl>
              <Input placeholder="q1" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`cases.${index}.prompt`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Prompt</FormLabel>
            <FormControl>
              <Textarea
                placeholder="What is the capital of France?"
                className="resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`cases.${index}.system`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>System prompt (optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Overrides the target's system prompt for this case"
                className="resize-none"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <ScorerFields control={control} index={index} />
    </div>
  );
}
