"""
Tests for the pure-function helpers in ai_service:
  _has_db_evidence, _sanitize_label, _tone_for_node,
  _render_node, _compile_graph, _extract_json.

No I/O, no LLM calls — all deterministic.
"""

import json
import pytest

from backend.services.ai_service import (
    _has_db_evidence,
    _sanitize_label,
    _tone_for_node,
    _render_node,
    _compile_graph,
    _extract_json,
    _Node,
    _Edge,
    _Group,
    _Graph,
)


# ── _has_db_evidence ──────────────────────────────────────────────────────────

class TestHasDbEvidence:
    def test_empty_dict_returns_false(self):
        assert _has_db_evidence({}) is False

    def test_file_with_sqlalchemy_returns_true(self):
        assert _has_db_evidence({'db.py': 'from sqlalchemy import create_engine'})

    def test_file_with_mongoose_returns_true(self):
        assert _has_db_evidence({'models.js': 'const mongoose = require("mongoose")'})

    def test_file_with_prisma_returns_true(self):
        assert _has_db_evidence({'client.ts': 'import { PrismaClient } from "@prisma/client"'})

    def test_no_db_keywords_returns_false(self):
        assert not _has_db_evidence({'app.py': 'import os\nprint("hello")'})

    def test_match_is_case_insensitive(self):
        # SQLALCHEMY has word boundaries (space before, end of string after)
        assert _has_db_evidence({'config.py': 'from SQLALCHEMY import Column'})

    def test_checks_all_files_not_just_first(self):
        files = {
            'routes.py': 'def index(): pass',
            'models.py': 'from sqlalchemy import Column',
        }
        assert _has_db_evidence(files)

    def test_redis_keyword_matches(self):
        # 'knex' is in the _DB_EVIDENCE pattern; 'redis' is not
        assert _has_db_evidence({'cache.py': 'const knex = require("knex")'})

    def test_redis_not_in_pattern(self):
        # Confirm redis itself is NOT in the DB_EVIDENCE list
        assert not _has_db_evidence({'cache.py': 'import Redis'})


# ── _sanitize_label ───────────────────────────────────────────────────────────

class TestSanitizeLabel:
    def test_clean_text_unchanged(self):
        assert _sanitize_label('API Server') == 'API Server'

    def test_angle_brackets_removed(self):
        assert '<>' not in _sanitize_label('Input <string>')

    def test_quotes_removed(self):
        result = _sanitize_label('"Quoted" label')
        assert '"' not in result

    def test_parentheses_removed(self):
        result = _sanitize_label('func()')
        assert '(' not in result
        assert ')' not in result

    def test_backticks_removed(self):
        assert '`' not in _sanitize_label('`code`')

    def test_pipes_removed(self):
        assert '|' not in _sanitize_label('a|b')

    def test_all_unsafe_chars_produce_fallback(self):
        assert _sanitize_label('<>"`\'\\|{}[]()') == 'Node'

    def test_leading_trailing_whitespace_stripped(self):
        assert _sanitize_label('  spaced  ') == 'spaced'


# ── _tone_for_node ────────────────────────────────────────────────────────────

def _node(label: str, type_: str = '', shape: str | None = None,
          group_id: str | None = None) -> _Node:
    return _Node(id='n', label=label, type=type_, shape=shape, group_id=group_id)


class TestToneForNode:
    def test_node_in_group_uses_group_tone(self):
        n = _node('Something', group_id='backend')
        tone = _tone_for_node(n, {'backend': 0})
        assert tone == 'toneBlue'

    def test_group_tone_wraps_around_six_tones(self):
        n = _node('X', group_id='grp')
        # index 6 wraps to 0 → toneBlue
        assert _tone_for_node(n, {'grp': 6}) == 'toneBlue'

    def test_database_shape_gives_amber(self):
        assert _tone_for_node(_node('Store', shape='database'), {}) == 'toneAmber'

    def test_database_keyword_in_label_gives_amber(self):
        assert _tone_for_node(_node('Primary Database'), {}) == 'toneAmber'

    def test_redis_in_label_gives_amber(self):
        assert _tone_for_node(_node('Redis Cache'), {}) == 'toneAmber'

    def test_worker_in_label_gives_rose(self):
        assert _tone_for_node(_node('Background Worker'), {}) == 'toneRose'

    def test_queue_in_type_gives_rose(self):
        assert _tone_for_node(_node('Task Processor', type_='queue'), {}) == 'toneRose'

    def test_browser_in_label_gives_blue(self):
        assert _tone_for_node(_node('Browser Client'), {}) == 'toneBlue'

    def test_api_in_label_gives_mint(self):
        assert _tone_for_node(_node('API Gateway'), {}) == 'toneMint'

    def test_server_in_label_gives_mint(self):
        assert _tone_for_node(_node('FastAPI Server'), {}) == 'toneMint'

    def test_ungrouped_generic_node_gives_indigo(self):
        # No group, no matching keyword → toneIndigo via `not node.group_id`
        assert _tone_for_node(_node('Logger'), {}) == 'toneIndigo'

    def test_inference_keyword_gives_indigo(self):
        assert _tone_for_node(_node('LLM Inference'), {}) == 'toneIndigo'

    def test_grouped_node_not_in_order_and_no_keyword_gives_teal(self):
        # group_id set but NOT in group_order, label has no matching keyword
        n = _node('Misc Component', group_id='misc_group')
        assert _tone_for_node(n, {}) == 'toneTeal'


# ── _render_node ──────────────────────────────────────────────────────────────

class TestRenderNode:
    def test_default_box_shape(self):
        n = _Node(id='api', label='API Server')
        assert _render_node(n) == 'node_api["API Server"]'

    def test_database_shape(self):
        n = _Node(id='db', label='Postgres', shape='database')
        assert _render_node(n) == 'node_db[("Postgres")]'

    def test_circle_shape(self):
        n = _Node(id='usr', label='User', shape='circle')
        assert _render_node(n) == 'node_usr(("User"))'

    def test_queue_shape(self):
        n = _Node(id='mq', label='Task Queue', shape='queue')
        result = _render_node(n)
        # Mermaid hexagon syntax: {{...}}
        assert result == 'node_mq{{"Task Queue"}}'

    def test_indent_is_prepended(self):
        n = _Node(id='svc', label='Service')
        assert _render_node(n, indent='  ') == '  node_svc["Service"]'

    def test_unsafe_label_is_sanitized(self):
        n = _Node(id='x', label='A<B>')
        result = _render_node(n)
        assert '<' not in result
        assert '>' not in result


# ── _compile_graph ────────────────────────────────────────────────────────────

def _make_graph(nodes=None, groups=None, edges=None) -> _Graph:
    nodes = nodes or [_Node(id='a', label='Alpha'), _Node(id='b', label='Beta')]
    return _Graph(
        nodes=nodes,
        groups=groups or [],
        edges=edges or [],
    )


class TestCompileGraph:
    def test_output_starts_with_flowchart_td(self):
        result = _compile_graph(_make_graph())
        assert result.startswith('flowchart TD')

    def test_ungrouped_nodes_appear_in_output(self):
        result = _compile_graph(_make_graph())
        assert 'node_a["Alpha"]' in result
        assert 'node_b["Beta"]' in result

    def test_grouped_nodes_appear_in_subgraph(self):
        nodes = [_Node(id='a', label='Alpha', group_id='g1')]
        groups = [_Group(id='g1', label='Group One')]
        result = _compile_graph(_Graph(nodes=nodes, groups=groups, edges=[]))
        assert 'subgraph group_g1' in result
        assert 'node_a' in result

    def test_solid_edge_uses_arrow(self):
        nodes = [_Node(id='a', label='A'), _Node(id='b', label='B')]
        edges = [_Edge(from_id='a', to_id='b')]
        result = _compile_graph(_Graph(nodes=nodes, groups=[], edges=edges))
        assert 'node_a --> node_b' in result

    def test_dashed_edge_uses_dotted_arrow(self):
        nodes = [_Node(id='a', label='A'), _Node(id='b', label='B')]
        edges = [_Edge(from_id='a', to_id='b', style='dashed')]
        result = _compile_graph(_Graph(nodes=nodes, groups=[], edges=edges))
        assert 'node_a -.-> node_b' in result

    def test_edge_with_label_includes_label(self):
        nodes = [_Node(id='a', label='A'), _Node(id='b', label='B')]
        edges = [_Edge(from_id='a', to_id='b', label='HTTP request')]
        result = _compile_graph(_Graph(nodes=nodes, groups=[], edges=edges))
        assert 'HTTP request' in result

    def test_edge_to_unknown_node_is_skipped(self):
        nodes = [_Node(id='a', label='A'), _Node(id='b', label='B')]
        edges = [_Edge(from_id='a', to_id='ghost')]
        result = _compile_graph(_Graph(nodes=nodes, groups=[], edges=edges))
        assert 'ghost' not in result

    def test_classdef_lines_are_present(self):
        result = _compile_graph(_make_graph())
        assert 'classDef toneBlue' in result
        assert 'classDef toneAmber' in result


# ── _extract_json ─────────────────────────────────────────────────────────────

class TestExtractJson:
    def test_clean_json_is_parsed(self):
        raw = '{"nodes": [], "edges": []}'
        result = _extract_json(raw)
        assert result == {'nodes': [], 'edges': []}

    def test_json_surrounded_by_prose_is_extracted(self):
        raw = 'Here is the result:\n{"score": 42, "label": "ok"}\nDone.'
        result = _extract_json(raw)
        assert result['score'] == 42

    def test_no_json_raises_value_error(self):
        with pytest.raises(ValueError, match='No JSON object found'):
            _extract_json('Sorry, cannot help.')

    def test_nested_json_is_parsed_correctly(self):
        raw = '{"groups": [{"id": "g"}], "nodes": [{"id": "n", "label": "N"}]}'
        result = _extract_json(raw)
        assert result['groups'][0]['id'] == 'g'
        assert result['nodes'][0]['label'] == 'N'

    def test_json_in_markdown_fence_is_extracted(self):
        raw = '```json\n{"key": "value"}\n```'
        result = _extract_json(raw)
        assert result['key'] == 'value'
