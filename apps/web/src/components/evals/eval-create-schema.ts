import { z } from "zod";
import type { EvalDefinition } from "@eval-vault/shared";

// Mirrors the Pydantic models in services/api/app/types/eval.py. Keep the
// constraints in sync with that file and with the backend name slug rule
// (_NAME_RE in services/api/app/service/eval_store.py).
export const SCORER_TYPES = [
  "exact_match",
  "contains",
  "regex",
  "json_valid",
  "llm_judge",
] as const;

export const THINKING_MODES = ["disabled", "adaptive"] as const;

// Scorers that compare the output against an `expected` value.
export const EXPECTED_SCORERS = ["exact_match", "contains", "regex"] as const;

const scorerSchema = z
  .object({
    type: z.enum(SCORER_TYPES),
    expected: z.string().optional(),
    rubric: z.string().optional(),
    pass_threshold: z.coerce.number().min(0).max(1),
  })
  .superRefine((s, ctx) => {
    if (
      (EXPECTED_SCORERS as readonly string[]).includes(s.type) &&
      !s.expected?.trim()
    ) {
      ctx.addIssue({
        path: ["expected"],
        code: z.ZodIssueCode.custom,
        message: "Required for this scorer",
      });
    }
    if (s.type === "llm_judge" && !s.rubric?.trim()) {
      ctx.addIssue({
        path: ["rubric"],
        code: z.ZodIssueCode.custom,
        message: "Rubric required for llm_judge",
      });
    }
  });

const targetSchema = z.object({
  id: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  thinking: z.enum(THINKING_MODES),
  max_tokens: z.coerce.number().int().min(1).max(8192),
  system: z.string().optional(),
});

const caseSchema = z.object({
  id: z.string().min(1, "Required"),
  prompt: z.string().min(1, "Required"),
  system: z.string().optional(),
  scorer: scorerSchema,
});

export const evalFormSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,63}$/,
      "Lowercase slug: a-z, 0-9, hyphens (2–64 chars)",
    ),
  description: z.string().optional(),
  judge_model: z.string().min(1, "Required"),
  targets: z.array(targetSchema).min(1, "Add at least one target"),
  cases: z.array(caseSchema).min(1, "Add at least one case"),
});

export type EvalFormValues = z.infer<typeof evalFormSchema>;

export function emptyTarget(): EvalFormValues["targets"][number] {
  return {
    id: "",
    model: "claude-opus-4-8",
    thinking: "disabled",
    max_tokens: 1024,
    system: "",
  };
}

export function emptyCase(): EvalFormValues["cases"][number] {
  return {
    id: "",
    prompt: "",
    system: "",
    scorer: { type: "contains", expected: "", rubric: "", pass_threshold: 0.5 },
  };
}

export function defaultEvalForm(): EvalFormValues {
  return {
    name: "",
    description: "",
    judge_model: "claude-sonnet-4-6",
    targets: [emptyTarget()],
    cases: [emptyCase()],
  };
}

// Hydrate the form from an existing definition (edit flow). Inverse of
// toDefinition: nulls become "" so controlled inputs stay controlled, and the
// scorer's expected/rubric are preserved even if not currently shown, so
// toggling the scorer type back reveals the prior value.
export function fromDefinition(defn: EvalDefinition): EvalFormValues {
  return {
    name: defn.name,
    description: defn.description ?? "",
    judge_model: defn.judge_model,
    targets: defn.targets.map((t) => ({
      id: t.id,
      model: t.model,
      thinking: t.thinking,
      max_tokens: t.max_tokens,
      system: t.system ?? "",
    })),
    cases: defn.cases.map((c) => ({
      id: c.id,
      prompt: c.prompt,
      system: c.system ?? "",
      scorer: {
        type: c.scorer.type,
        expected: c.scorer.expected ?? "",
        rubric: c.scorer.rubric ?? "",
        pass_threshold: c.scorer.pass_threshold,
      },
    })),
  };
}

// Map validated form values onto the API's EvalDefinition shape, nulling out
// optional / scorer fields that don't apply so we never persist stale values.
export function toDefinition(values: EvalFormValues): EvalDefinition {
  return {
    name: values.name,
    description: values.description ?? "",
    judge_model: values.judge_model,
    targets: values.targets.map((t) => ({
      id: t.id,
      model: t.model,
      thinking: t.thinking,
      max_tokens: t.max_tokens,
      system: t.system?.trim() ? t.system : null,
    })),
    cases: values.cases.map((c) => ({
      id: c.id,
      prompt: c.prompt,
      system: c.system?.trim() ? c.system : null,
      scorer: {
        type: c.scorer.type,
        expected: (EXPECTED_SCORERS as readonly string[]).includes(c.scorer.type)
          ? (c.scorer.expected ?? "")
          : null,
        rubric: c.scorer.type === "llm_judge" ? (c.scorer.rubric ?? "") : null,
        pass_threshold: c.scorer.pass_threshold,
      },
    })),
  };
}
