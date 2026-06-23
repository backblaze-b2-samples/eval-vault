<!-- last_verified: 2026-06-23 -->
# Security

Security principles and implementation for Eval Vault.

## Trust Boundaries

- **Frontend -> API**: CORS-restricted to configured origins, scoped to `GET/POST/DELETE/OPTIONS`
- **API -> B2**: Authenticated via `B2_APPLICATION_KEY_ID` + `B2_APPLICATION_KEY`, signature v4 (endpoint derived from `B2_REGION`)
- **API -> Anthropic**: Authenticated via `ANTHROPIC_API_KEY`; validated at eval-run time, never committed
- **Client -> B2**: Presigned URLs for download (10-min expiry, `Content-Disposition: attachment`)

## Run / artifact key validation

- Run ids, case ids, and target ids are validated against path-traversal patterns before they are interpolated into B2 keys (`service/eval_store.py`)
- The Library is scoped to the `evals/runs/` prefix; the full bucket explorer (`/files`) is the only unscoped surface

## Upload Validation

- Filename sanitization: path traversal, null bytes, unsafe chars stripped
- MIME/extension consistency check against allowlist
- Chunked streaming with size enforcement (100MB default)
- Content-type allowlist (images, PDFs, text, archives, audio/video)
- Empty file rejection

## File Key Validation

- Empty keys rejected
- Path traversal patterns rejected (`../`, `%2e%2e`, backslashes, null bytes)
- The bucket is the only access boundary — add prefix scoping in
  `services/api/app/service/files.py::validate_key` if your deployment
  shares a bucket with other workloads

## Download Safety

- Presigned URLs force `Content-Disposition: attachment`
- Prevents inline rendering of user-uploaded content (XSS mitigation)

## Secrets Management

- All secrets loaded via environment variables (pydantic-settings)
- Never committed to source control
- `.env.example` documents required variables without values

## Agent Security Rules

- Never commit `.env`, credentials, or API keys
- Never weaken validation without explicit instruction
- Never bypass CORS, auth, or input sanitization
- Always validate at system boundaries
