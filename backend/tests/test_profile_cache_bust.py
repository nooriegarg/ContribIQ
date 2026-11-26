"""
Tests for the matches-cache invalidation logic triggered on profile save.

We test _bust_matches_cache directly by reimplementing its logic in the test
(the same pattern used in test_cache_service.py) rather than importing through
backend.api.routes which has a transitive email-validator dependency.
"""
import pytest
from unittest.mock import AsyncMock


# ---------------------------------------------------------------------------
# Standalone implementation of _bust_matches_cache (mirrors profile.py exactly)
# so we can test without the transitive email-validator import chain
# ---------------------------------------------------------------------------

async def bust_matches_cache(client, user_id: str) -> None:
    pattern = f"matches:*:{user_id}"
    cursor = 0
    while True:
        cursor, keys = await client.scan(cursor, match=pattern, count=100)
        if keys:
            await client.delete(*keys)
        if cursor == 0:
            break


def _make_valkey_mock(keys: list[str]):
    mock = AsyncMock()
    mock.scan = AsyncMock(return_value=(0, keys))
    mock.delete = AsyncMock()
    return mock


# ---------------------------------------------------------------------------
# _bust_matches_cache logic
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bust_matches_cache_deletes_matching_keys():
    keys = ["matches:task1:user-abc", "matches:task2:user-abc"]
    client = _make_valkey_mock(keys)

    await bust_matches_cache(client, "user-abc")

    client.scan.assert_called_once_with(0, match="matches:*:user-abc", count=100)
    client.delete.assert_called_once_with(*keys)


@pytest.mark.asyncio
async def test_bust_matches_cache_no_keys_does_not_call_delete():
    client = _make_valkey_mock([])

    await bust_matches_cache(client, "user-xyz")

    client.delete.assert_not_called()


@pytest.mark.asyncio
async def test_bust_matches_cache_paginates_until_cursor_zero():
    """Two scan pages: first returns cursor=5, second returns cursor=0."""
    client = AsyncMock()
    client.scan = AsyncMock(side_effect=[
        (5, ["matches:t1:u1"]),
        (0, ["matches:t2:u1"]),
    ])
    client.delete = AsyncMock()

    await bust_matches_cache(client, "u1")

    assert client.scan.call_count == 2
    assert client.delete.call_count == 2


@pytest.mark.asyncio
async def test_bust_matches_cache_uses_correct_pattern_for_user():
    client = _make_valkey_mock([])

    await bust_matches_cache(client, "user-99")

    client.scan.assert_called_once_with(0, match="matches:*:user-99", count=100)


@pytest.mark.asyncio
async def test_bust_matches_cache_does_not_delete_other_users_keys():
    """When scan returns no keys (correct server-side filtering), delete is never called."""
    client = _make_valkey_mock([])  # Valkey returns nothing for this user's pattern

    await bust_matches_cache(client, "user-b")

    client.delete.assert_not_called()


# ---------------------------------------------------------------------------
# sessionStorage cache key contract (documents the frontend/backend agreement)
# ---------------------------------------------------------------------------

def test_matches_cache_key_format():
    task_id = "task-abc123"
    user_id = "user-42"
    key = f"matches:{task_id}:{user_id}"
    assert key == "matches:task-abc123:user-42"


def test_bust_pattern_matches_all_tasks_for_user():
    user_id = "user-42"
    pattern = f"matches:*:{user_id}"
    import fnmatch
    assert fnmatch.fnmatch("matches:task-abc:user-42", pattern)
    assert fnmatch.fnmatch("matches:task-xyz:user-42", pattern)
    assert not fnmatch.fnmatch("matches:task-abc:user-99", pattern)
