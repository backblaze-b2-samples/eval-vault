"use client";

import { Trash2 } from "lucide-react";
import { type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { THINKING_MODES, type EvalFormValues } from "./eval-create-schema";

/** One model-under-test row in the targets field array. */
export function TargetFields({
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
        <p className="text-sm font-medium">Target {index + 1}</p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name={`targets.${index}.id`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID</FormLabel>
              <FormControl>
                <Input placeholder="opus" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`targets.${index}.model`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <FormControl>
                <Input placeholder="claude-opus-4-8" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`targets.${index}.thinking`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Thinking</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {THINKING_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`targets.${index}.max_tokens`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max tokens</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={8192}
                  className="font-mono tabular-nums"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={`targets.${index}.system`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>System prompt (optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="System prompt applied to this target"
                className="resize-none"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
