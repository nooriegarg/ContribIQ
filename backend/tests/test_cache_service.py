import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.cache_service import (
    _cache_key,
    get_cached_analysis,
    set_cached_analysis,
)


# --- _cache_key ---

def test_cache_key_format():
    assert _cache_key("owner", "repo", "abc123") == "analysis:owner:repo:abc123"


def test_cache_key_includes_all_parts():
    key = _cache_key("facebook", "react", "deadbeef")
    assert "facebook" in key
    assert "react" in key
    assert "deadbeef" in key


# --- get_cached_analysis ---

@pytest.mark.asyncio
async def test_get_cached_analysis_returns_none_on_miss():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=None)

    with patch("backend.services.cache_service.get_valkey", return_value=mock_client):
        result = await get_cached_analysis("owner", "repo", "sha1")

    assert result is None


@pytest.mark.asyncio
async def test_get_cached_analysis_returns_parsed_dict_on_hit():
    data = {"status": "completed", "owner": "owner", "repo": "repo"}
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=json.dumps(data))

    with patch("backend.services.cache_service.get_valkey", return_value=mock_client):
        result = await get_cached_analysis("owner", "repo", "sha1")

    assert result == data


@pytest.mark.asyncio
async def test_get_cached_analysis_uses_correct_key():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=None)

    with patch("backend.services.cache_service.get_valkey", return_value=mock_client):
        await get_cached_analysis("myorg", "myrepo", "abc")

    mock_client.get.assert_called_once_with("analysis:myorg:myrepo:abc")


# --- set_cached_analysis ---

@pytest.mark.asyncio
async def test_set_cached_analysis_stores_json():
    mock_client = AsyncMock()
    mock_client.set = AsyncMock()

    data = {"status": "completed"}
    with patch("backend.services.cache_service.get_valkey", return_value=mock_client):
        await set_cached_analysis("owner", "repo", "sha1", data)

    mock_client.set.assert_called_once_with(
        "analysis:owner:repo:sha1",
        json.dumps(data),
        ex=86400,
    )


@pytest.mark.asyncio
async def test_set_cached_analysis_ttl_is_24h():
    mock_client = AsyncMock()
    mock_client.set = AsyncMock()

    with patch("backend.services.cache_service.get_valkey", return_value=mock_client):
        await set_cached_analysis("a", "b", "c", {})

    _, kwargs = mock_client.set.call_args
    assert kwargs.get("ex") == 86400
