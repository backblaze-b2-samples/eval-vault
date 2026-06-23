import type {
  Artifact,
  ComparisonResult,
  DailyUploadCount,
  EvalDefinition,
  EvalStats,
  FileMetadata,
  FileUploadResponse,
  RunGrid,
  RunListItem,
  RunManifest,
  UploadStats,
} from "@eval-vault/shared";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Typed API error with HTTP status code for caller-side branching. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True for 408, 429, 500, 502, 503, 504 — worth retrying. */
  get isRetryable(): boolean {
    return [408, 429, 500, 502, 503, 504].includes(this.status);
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    // Network failure (offline, DNS, CORS, etc.)
    throw new ApiError("Network error — check your connection", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.detail || `API error: ${res.status}`,
      res.status,
    );
  }
  return res.json();
}

export async function getHealth() {
  return apiFetch<{ status: string; b2_connected: boolean }>("/health");
}

export async function getFiles(prefix = "", limit = 100) {
  return apiFetch<FileMetadata[]>(
    `/files?prefix=${encodeURIComponent(prefix)}&limit=${limit}`
  );
}

export async function getFileStats() {
  return apiFetch<UploadStats>("/files/stats");
}

export async function getUploadActivity(days = 7) {
  return apiFetch<DailyUploadCount[]>(`/files/stats/activity?days=${days}`);
}

export async function getFile(key: string) {
  return apiFetch<FileMetadata>(`/files/${key}`);
}

export async function getDownloadUrl(key: string) {
  return apiFetch<{ url: string }>(`/files/${key}/download`);
}

/** Preview-only presigned URL — does NOT increment the download counter. */
export async function getPreviewUrl(key: string) {
  return apiFetch<{ url: string }>(`/files/${key}/preview`);
}

export async function deleteFile(key: string) {
  return apiFetch<{ deleted: boolean; key: string }>(`/files/${key}`, {
    method: "DELETE",
  });
}

export function uploadFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<FileUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new ApiError(body.detail || `Upload failed: ${xhr.status}`, xhr.status));
        } catch {
          reject(new ApiError(`Upload failed: ${xhr.status}`, xhr.status));
        }
      }
    });

    xhr.addEventListener("error", () =>
      reject(new ApiError("Network error — check your connection", 0)),
    );
    xhr.addEventListener("abort", () =>
      reject(new ApiError("Upload aborted", 0)),
    );

    xhr.open("POST", `${API_BASE}/upload`);
    xhr.send(formData);
  });
}

// --- Eval Vault endpoints ---

export async function getEvals() {
  return apiFetch<EvalDefinition[]>("/evals");
}

export async function getEvalRuns() {
  return apiFetch<RunListItem[]>("/evals/runs");
}

export async function getEvalStats() {
  return apiFetch<EvalStats>("/evals/stats");
}

export async function runEval(name: string) {
  return apiFetch<RunManifest>(`/evals/${encodeURIComponent(name)}/run`, {
    method: "POST",
  });
}

export async function getRunManifest(runId: string) {
  return apiFetch<RunManifest>(`/evals/runs/${encodeURIComponent(runId)}`);
}

export async function getRunGrid(runId: string) {
  return apiFetch<RunGrid>(`/evals/runs/${encodeURIComponent(runId)}/grid`);
}

export async function getArtifact(
  runId: string,
  caseId: string,
  targetId: string,
  kind: "input" | "output" | "score" | "trace"
) {
  return apiFetch<Artifact>(
    `/evals/runs/${encodeURIComponent(runId)}/cases/${encodeURIComponent(
      caseId
    )}/${encodeURIComponent(targetId)}/${kind}`
  );
}

export async function compareRuns(base: string, head: string) {
  return apiFetch<ComparisonResult>(
    `/evals/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`
  );
}
