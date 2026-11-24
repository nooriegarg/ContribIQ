import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.services.issue_detail_service import (
    find_similar_prs,
    _generate_impact_chain,
)


# --- find_similar_prs ---

@pytest.mark.asyncio
async def test_find_similar_prs_returns_merged_only():
    prs = [
        {"number": 1, "title": "Fix login bug", "html_url": "https://github.com/pr/1", "merged_at": "2024-01-01"},
        {"number": 2, "title": "Add feature", "html_url": "https://github.com/pr/2", "merged_at": None},
        {"number": 3, "title": "Update docs", "html_url": "https://github.com/pr/3", "merged_at": "2024-01-02"},
    ]

    mock_client = AsyncMock()
    mock_client.get_pull_requests = AsyncMock(return_value=prs)
    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_client)
    mock_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch("backend.services.issue_detail_service.GitHubClient", return_value=mock_ctx):
        result = await find_similar_prs("owner", "repo", "Fix bug")

    numbers = [pr["number"] for pr in result]
    assert 1 in numbers
    assert 3 in numbers
    assert 2 not in numbers


@pytest.mark.asyncio
async def test_find_similar_prs_returns_empty_on_error():
    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(side_effect=Exception("GitHub API down"))
    mock_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch("backend.services.issue_detail_service.GitHubClient", return_value=mock_ctx):
        result = await find_similar_prs("owner", "repo", "Fix bug")

    assert result == []


@pytest.mark.asyncio
async def test_find_similar_prs_capped_at_five():
    prs = [
        {"number": i, "title": f"PR {i}", "html_url": f"https://github.com/pr/{i}", "merged_at": "2024-01-01"}
        for i in range(1, 10)
    ]

    mock_client = AsyncMock()
    mock_client.get_pull_requests = AsyncMock(return_value=prs)
    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_client)
    mock_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch("backend.services.issue_detail_service.GitHubClient", return_value=mock_ctx):
        result = await find_similar_prs("owner", "repo", "bug")

    assert len(result) <= 5


@pytest.mark.asyncio
async def test_find_similar_prs_shape():
    prs = [{"number": 1, "title": "Fix auth", "html_url": "https://github.com/pr/1", "merged_at": "2024-01-01"}]

    mock_client = AsyncMock()
    mock_client.get_pull_requests = AsyncMock(return_value=prs)
    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_client)
    mock_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch("backend.services.issue_detail_service.GitHubClient", return_value=mock_ctx):
        result = await find_similar_prs("owner", "repo", "Fix auth")

    assert result[0]["number"] == 1
    assert result[0]["title"] == "Fix auth"
    assert result[0]["url"] == "https://github.com/pr/1"


# --- _generate_impact_chain ---

@pytest.mark.asyncio
async def test_generate_impact_chain_parses_valid_json():
    mock_response = AsyncMock()
    mock_response.choices = [AsyncMock()]
    mock_response.choices[0].message.content = '["API", "AuthService", "Database"]'

    issue = MagicMock()
    issue.title = "Fix login timeout"
    issue.files_affected = ["backend/auth.py"]

    with patch("backend.services.issue_detail_service.acompletion", return_value=mock_response):
        result = await _generate_impact_chain(issue)

    assert result == ["API", "AuthService", "Database"]


@pytest.mark.asyncio
async def test_generate_impact_chain_fallback_on_error():
    issue = MagicMock()
    issue.title = "Fix bug"
    issue.files_affected = []

    with patch("backend.services.issue_detail_service.acompletion", side_effect=Exception("LLM down")):
        result = await _generate_impact_chain(issue)

    assert result == ["Repository", "Source Code"]


@pytest.mark.asyncio
async def test_generate_impact_chain_capped_at_five():
    mock_response = AsyncMock()
    mock_response.choices = [AsyncMock()]
    mock_response.choices[0].message.content = '["A", "B", "C", "D", "E", "F", "G"]'

    issue = MagicMock()
    issue.title = "Big fix"
    issue.files_affected = []

    with patch("backend.services.issue_detail_service.acompletion", return_value=mock_response):
        result = await _generate_impact_chain(issue)

    assert len(result) <= 5
