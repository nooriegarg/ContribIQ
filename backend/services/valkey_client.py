"""
Valkey (Redis-compatible) client for ContribIQ.
Used for OAuth state storage, task queue, and caching.
"""

import redis.asyncio as redis

from backend.core.config import get_settings

_client: redis.Redis | None = None


def get_valkey() -> redis.Redis:
    global _client
    if _client is None:
        settings = get_settings()
        _client = redis.from_url(settings.VALKEY_URL, decode_responses=True)
    return _client


async def set_key(key: str, value: str, ttl: int = 300) -> None:
    client = get_valkey()
    await client.set(key, value, ex=ttl)


async def get_key(key: str) -> str | None:
    client = get_valkey()
    return await client.get(key)


async def delete_key(key: str) -> None:
    client = get_valkey()
    await client.delete(key)


async def key_exists(key: str) -> bool:
    client = get_valkey()
    return bool(await client.exists(key))
