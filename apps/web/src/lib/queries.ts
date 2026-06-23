"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  compareRuns,
  deleteFile,
  getArtifact,
  getEvalRuns,
  getEvals,
  getEvalStats,
  getFiles,
  getFileStats,
  getPreviewUrl,
  getRunGrid,
  getRunManifest,
  getUploadActivity,
  runEval,
} from "@/lib/api-client";
import type { FileMetadata } from "@eval-vault/shared";

// Single source of truth for query keys. Keep these tightly scoped so that
// invalidating "files" doesn't blow away unrelated caches, and so an IDE
// "find usages" of `qk.files` reveals every consumer.
export const qk = {
  all: ["b2"] as const,
  files: (prefix?: string, limit?: number) =>
    [...qk.all, "files", prefix ?? "", limit ?? 100] as const,
  stats: () => [...qk.all, "stats"] as const,
  uploadActivity: (days: number) =>
    [...qk.all, "stats", "activity", days] as const,
  preview: (key: string) => [...qk.all, "preview", key] as const,
  evals: () => [...qk.all, "evals"] as const,
  evalRuns: () => [...qk.all, "evals", "runs"] as const,
  evalStats: () => [...qk.all, "evals", "stats"] as const,
  runManifest: (runId: string) => [...qk.all, "evals", "run", runId] as const,
  runGrid: (runId: string) => [...qk.all, "evals", "grid", runId] as const,
  artifact: (runId: string, caseId: string, targetId: string, kind: string) =>
    [...qk.all, "evals", "artifact", runId, caseId, targetId, kind] as const,
  comparison: (base: string, head: string) =>
    [...qk.all, "evals", "compare", base, head] as const,
};

export function useFiles(prefix = "", limit = 100) {
  return useQuery<FileMetadata[], ApiError>({
    queryKey: qk.files(prefix, limit),
    queryFn: () => getFiles(prefix, limit),
  });
}

export function useFileStats() {
  return useQuery({
    queryKey: qk.stats(),
    queryFn: getFileStats,
  });
}

export function useUploadActivity(days = 7) {
  return useQuery({
    queryKey: qk.uploadActivity(days),
    queryFn: () => getUploadActivity(days),
  });
}

// Presigned preview URL — only fetched when `enabled` is true (e.g., when
// the dialog opens for a specific file). Kept short-lived (60s) because
// the URL itself has a presigned expiry and is cheap to regenerate.
export function usePreviewUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.preview(key ?? ""),
    queryFn: () => getPreviewUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileKey: string) => deleteFile(fileKey),
    // After delete, blow away every cached file list + stats. Cheap and
    // correct — the dashboard re-fetches lazily as components remount.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}

// --- Eval Vault hooks ---

export function useEvals() {
  return useQuery({ queryKey: qk.evals(), queryFn: getEvals });
}

export function useEvalRuns() {
  return useQuery({ queryKey: qk.evalRuns(), queryFn: getEvalRuns });
}

export function useEvalStats() {
  return useQuery({ queryKey: qk.evalStats(), queryFn: getEvalStats });
}

export function useRunManifest(runId: string | undefined) {
  return useQuery({
    queryKey: qk.runManifest(runId ?? ""),
    queryFn: () => getRunManifest(runId as string),
    enabled: !!runId,
  });
}

export function useRunGrid(runId: string | undefined) {
  return useQuery({
    queryKey: qk.runGrid(runId ?? ""),
    queryFn: () => getRunGrid(runId as string),
    enabled: !!runId,
  });
}

export function useArtifact(
  runId: string | undefined,
  caseId: string | undefined,
  targetId: string | undefined,
  kind: "input" | "output" | "score" | "trace",
  enabled: boolean
) {
  return useQuery({
    queryKey: qk.artifact(runId ?? "", caseId ?? "", targetId ?? "", kind),
    queryFn: () => getArtifact(runId as string, caseId as string, targetId as string, kind),
    enabled: enabled && !!runId && !!caseId && !!targetId,
    staleTime: 60_000,
  });
}

export function useComparison(base: string | undefined, head: string | undefined) {
  return useQuery({
    queryKey: qk.comparison(base ?? "", head ?? ""),
    queryFn: () => compareRuns(base as string, head as string),
    enabled: !!base && !!head,
  });
}

export function useRunEval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => runEval(name),
    onSuccess: () => {
      // A new run changes the run list, scoreboard stats, and dashboard.
      qc.invalidateQueries({ queryKey: qk.evalRuns() });
      qc.invalidateQueries({ queryKey: qk.evalStats() });
    },
  });
}
