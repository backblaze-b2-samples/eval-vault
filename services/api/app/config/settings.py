from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Backblaze B2 (S3-compatible). Standard #3 env var names.
    b2_application_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = ""
    # Region only — the S3 endpoint is derived as
    # https://s3.{B2_REGION}.backblazeb2.com in repo/b2_client.py.
    b2_region: str = ""
    # Optional public base URL for objects in a public bucket.
    b2_public_url_base: str = ""

    # Anthropic (Claude) — required only when running an eval, not at startup.
    # The bucket explorer + /health work without it.
    anthropic_api_key: str = ""

    api_port: int = 8000
    # Explicit allowlist by default — covers Next on :3000 and the
    # fallback :3001 it picks if 3000 is busy. Production deploys should
    # override with the exact frontend origin.
    api_cors_origins: str = "http://localhost:3000,http://localhost:3001"
    # Optional dev-only escape hatch: a regex that matches additional
    # allowed origins. Empty by default — set this to e.g.
    # `^http://localhost:\d+$` to accept any localhost port without
    # listing each one. NEVER ship this to production.
    api_cors_origin_regex: str = ""

    # Upload limits
    max_file_size: int = 100 * 1024 * 1024  # 100MB

    # Small durable counters (downloads, etc). Point at a persistent
    # volume in production if you care about surviving restarts.
    download_count_file: str = "data/download_count.json"

    # Where archived eval runs live in the bucket. The Library + dashboard
    # are scoped to this prefix; the full bucket explorer ignores it.
    evals_prefix: str = "evals/runs/"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",")]

    @property
    def b2_endpoint(self) -> str:
        """Derive the S3 endpoint from the region (no hardcoded region)."""
        return f"https://s3.{self.b2_region}.backblazeb2.com"


settings = Settings()
