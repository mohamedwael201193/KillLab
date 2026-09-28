"""Load environment without logging secret values."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"')


def strip_pgbouncer(url: str) -> str:
    """psycopg rejects a pgbouncer query parameter. The stored URI is not rewritten."""
    if not url or "pgbouncer=" not in url:
        return url
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "pgbouncer"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def psycopg_url(url: str) -> str:
    """Use the psycopg 3 dialect. Does not log the URI."""
    cleaned = strip_pgbouncer(url)
    if cleaned.startswith("postgresql+psycopg://"):
        return cleaned
    if cleaned.startswith("postgresql://"):
        return "postgresql+psycopg://" + cleaned[len("postgresql://") :]
    if cleaned.startswith("postgres://"):
        return "postgresql+psycopg://" + cleaned[len("postgres://") :]
    return cleaned


@dataclass(frozen=True)
class Settings:
    database_url: str
    direct_url: str
    api_token: str
    env: str
    log_level: str
    bitget_rest_base: str
    bitget_timeout_s: float
    llm_api_key: str
    llm_base_url: str
    llm_model: str
    llm_timeout_s: float
    run_stale_minutes: int
    frontend_origin: str

    @property
    def production(self) -> bool:
        return self.env == "production"


def settings_from_environ() -> Settings:
    root = Path(__file__).resolve().parents[2]
    load_env_file(root / ".env")
    db = psycopg_url(os.environ.get("DATABASE_URL", ""))
    direct = psycopg_url(os.environ.get("DIRECT_URL", ""))
    return Settings(
        database_url=db,
        direct_url=direct,
        api_token=os.environ.get("KILLAB_API_TOKEN", ""),
        env=os.environ.get("KILLAB_ENV", "development"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        bitget_rest_base=os.environ.get("BITGET_REST_BASE", "https://api.bitget.com").rstrip("/"),
        bitget_timeout_s=float(os.environ.get("BITGET_HTTP_TIMEOUT_S", "20")),
        llm_api_key=os.environ.get("LLM_API_KEY", ""),
        llm_base_url=os.environ.get("LLM_BASE_URL", ""),
        llm_model=os.environ.get("LLM_MODEL", ""),
        llm_timeout_s=float(os.environ.get("LLM_TIMEOUT_S", "30")),
        run_stale_minutes=int(os.environ.get("RUN_STALE_MINUTES", "15")),
        frontend_origin=os.environ.get("FRONTEND_ORIGIN", ""),
    )
