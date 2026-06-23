export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Eval Vault: mirrors of the Pydantic models in services/api/app/types ---

export type ScorerType =
  | "exact_match"
  | "contains"
  | "regex"
  | "json_valid"
  | "llm_judge";

export type ThinkingMode = "disabled" | "adaptive";

export interface ScorerConfig {
  type: ScorerType;
  expected: string | null;
  rubric: string | null;
  pass_threshold: number;
}

export interface EvalTarget {
  id: string;
  model: string;
  thinking: ThinkingMode;
  max_tokens: number;
  system: string | null;
}

export interface EvalCase {
  id: string;
  prompt: string;
  system: string | null;
  scorer: ScorerConfig;
}

export interface EvalDefinition {
  name: string;
  description: string;
  targets: EvalTarget[];
  cases: EvalCase[];
  judge_model: string;
}

export interface RunSummary {
  total_cases: number;
  total_calls: number;
  passed: number;
  avg_score: number;
  per_target_avg: Record<string, number>;
}

export interface RunManifest {
  run_id: string;
  eval_name: string;
  eval_description: string;
  target_ids: string[];
  models: Record<string, string>;
  created_at: string;
  summary: RunSummary;
}

export interface RunListItem {
  run_id: string;
  eval_name: string;
  created_at: string;
  avg_score: number;
  passed: number;
  total_calls: number;
}

export interface ScoreCell {
  case_id: string;
  target_id: string;
  score: number;
  passed: boolean;
  scorer: string;
}

export interface RunGrid {
  run_id: string;
  cells: ScoreCell[];
}

export interface EvalStats {
  evals_defined: number;
  runs_archived: number;
  artifacts_stored: number;
  avg_score: number;
}

export interface CellDelta {
  case_id: string;
  target_id: string;
  base_score: number;
  head_score: number;
  delta: number;
  regression: boolean;
}

export interface ComparisonResult {
  base_run_id: string;
  head_run_id: string;
  base_eval: string;
  head_eval: string;
  same_eval: boolean;
  base_avg: number;
  head_avg: number;
  avg_delta: number;
  regressions: number;
  improvements: number;
  cells: CellDelta[];
}

export interface Artifact {
  [key: string]: unknown;
}
