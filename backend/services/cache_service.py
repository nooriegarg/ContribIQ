import json
from typing import Any

from backend.services.valkey_client import get_valkey

_ANALYSIS_TTL = 86400  # 24 hours


def _cache_key(owner: str, repo: str, sha: str) -> str:
    return f"analysis:{owner}:{repo}:{sha}"


async def get_cached_analysis(owner: str, repo: str, sha: str) -> dict[str, Any] | None:
    client = get_valkey()
    raw = await client.get(_cache_key(owner, repo, sha))
    if raw is None:
        return None
    return json.loads(raw)


async def set_cached_analysis(owner: str, repo: str, sha: str, result: dict[str, Any]) -> None:
    client = get_valkey()
    await client.set(_cache_key(owner, repo, sha), json.dumps(result), ex=_ANALYSIS_TTL)
