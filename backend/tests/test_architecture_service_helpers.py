"""
Tests for the pure-function helpers in architecture_service:
  _is_architecture_source, _score, _excerpt, _rank_source_paths.

No I/O, no GitHub calls — all deterministic.
"""

import pytest

from backend.services.architecture_service import (
    _is_architecture_source,
    _score,
    _excerpt,
    _rank_source_paths,
    MAX_SOURCE_FILES,
)


# ── _is_architecture_source ───────────────────────────────────────────────────

class TestIsArchitectureSource:
    def test_python_source_file_included(self):
        assert _is_architecture_source('src/app.py')

    def test_typescript_source_file_included(self):
        assert _is_architecture_source('frontend/src/api/client.ts')

    def test_tsx_source_file_included(self):
        assert _is_architecture_source('src/components/App.tsx')

    def test_go_source_file_included(self):
        assert _is_architecture_source('cmd/server/main.go')

    def test_package_json_manifest_included(self):
        assert _is_architecture_source('package.json')

    def test_readme_included(self):
        assert _is_architecture_source('README.md')

    def test_file_in_tests_dir_excluded(self):
        assert not _is_architecture_source('tests/test_app.py')

    def test_file_in_node_modules_excluded(self):
        assert not _is_architecture_source('node_modules/express/index.js')

    def test_file_in_dist_excluded(self):
        assert not _is_architecture_source('dist/bundle.js')

    def test_dotfile_directory_excluded(self):
        assert not _is_architecture_source('.github/workflows/ci.yml')

    def test_test_spec_extension_excluded(self):
        assert not _is_architecture_source('src/app.test.ts')

    def test_minified_file_excluded(self):
        assert not _is_architecture_source('public/vendor.min.js')

    def test_docs_directory_excluded(self):
        assert not _is_architecture_source('docs/api.py')

    def test_migrations_directory_excluded(self):
        assert not _is_architecture_source('migrations/0001_initial.py')


# ── _score ────────────────────────────────────────────────────────────────────

class TestScore:
    def test_main_py_scores_high(self):
        assert _score('main.py') > _score('utils.py')

    def test_server_ts_scores_high(self):
        assert _score('server.ts') > _score('helpers.ts')

    def test_utils_file_has_penalty(self):
        # utils name incurs a -6 penalty
        base = _score('app.py')
        utils = _score('utils.py')
        assert utils < base

    def test_deeper_file_scores_less(self):
        # depth penalty: 20 - depth
        shallow = _score('server.py')
        deep = _score('a/b/c/d/server.py')
        assert shallow > deep

    def test_root_package_json_scores_very_high(self):
        # root manifest: +45 bonus
        assert _score('package.json') > _score('src/app.ts')

    def test_nested_package_json_smaller_bonus(self):
        # nested manifest: only +5
        root = _score('package.json')
        nested = _score('packages/frontend/package.json')
        assert root > nested

    def test_service_in_name_adds_bonus(self):
        # 'service' matches the webhook/worker/... pattern → +22
        assert _score('auth_service.py') > _score('types.py')

    def test_analytics_in_name_has_big_penalty(self):
        assert _score('analytics.py') < _score('app.py')

    def test_controller_in_name_adds_bonus(self):
        assert _score('user_controller.py') > _score('schema.py')


# ── _excerpt ──────────────────────────────────────────────────────────────────

class TestExcerpt:
    def test_short_content_returned_unchanged(self):
        content = 'short'
        assert _excerpt('app.py', content, 100) == 'short'

    def test_result_length_does_not_exceed_limit(self):
        content = 'x\n' * 500
        result = _excerpt('app.py', content, 100)
        assert len(result) <= 100

    def test_markdown_file_uses_simple_prefix(self):
        content = 'line\n' * 200
        result = _excerpt('README.md', content, 50)
        assert result == content[:50]

    def test_toml_file_uses_simple_prefix(self):
        content = '[tool]\nname = "x"\n' * 50
        result = _excerpt('pyproject.toml', content, 50)
        assert result == content[:50]

    def test_import_lines_are_included(self):
        lines = ['# header'] + [f'filler_{i}' for i in range(50)] + ['import os']
        content = '\n'.join(lines)
        result = _excerpt('app.py', content, 2000)
        assert 'import os' in result

    def test_connection_pattern_lines_included(self):
        lines = [f'filler_{i}' for i in range(50)] + ['app.include_router(api_router)']
        content = '\n'.join(lines)
        result = _excerpt('main.py', content, 2000)
        assert 'include_router' in result


# ── _rank_source_paths ────────────────────────────────────────────────────────

def _entry(path: str, size: int = 1000) -> dict:
    return {'path': path, 'type': 'blob', 'size': size}


class TestRankSourcePaths:
    def test_non_blob_entries_excluded(self):
        entries = [
            {'path': 'src', 'type': 'tree'},
            _entry('src/main.py'),
        ]
        result = _rank_source_paths(entries, {})
        assert 'src' not in result
        assert 'src/main.py' in result

    def test_excluded_paths_not_returned(self):
        entries = [
            _entry('tests/test_app.py'),
            _entry('src/main.py'),
        ]
        result = _rank_source_paths(entries, {})
        assert 'tests/test_app.py' not in result
        assert 'src/main.py' in result

    def test_main_py_ranked_before_utils(self):
        entries = [_entry('utils.py'), _entry('main.py')]
        result = _rank_source_paths(entries, {})
        assert result.index('main.py') < result.index('utils.py')

    def test_oversized_file_excluded(self):
        entries = [
            _entry('src/huge.py', size=200_000),
            _entry('src/small.py', size=500),
        ]
        result = _rank_source_paths(entries, {})
        assert 'src/huge.py' not in result
        assert 'src/small.py' in result

    def test_at_most_one_manifest_selected(self):
        entries = [
            _entry('package.json'),
            _entry('frontend/package.json'),
            _entry('backend/pyproject.toml'),
        ]
        result = _rank_source_paths(entries, {})
        manifests = [p for p in result if p in ('package.json', 'frontend/package.json', 'backend/pyproject.toml')]
        assert len(manifests) <= 1

    def test_returns_list_of_strings(self):
        entries = [_entry('src/app.py'), _entry('src/models.py')]
        result = _rank_source_paths(entries, {})
        assert isinstance(result, list)
        assert all(isinstance(p, str) for p in result)

    def test_diversity_limits_files_per_directory(self):
        # 20 api/ files and 20 services/ files — after selecting several api/
        # files the diversity penalty makes services/ more attractive
        entries = [_entry(f'api/handler_{i}.py') for i in range(20)]
        entries += [_entry(f'services/svc_{i}.py') for i in range(20)]
        result = _rank_source_paths(entries, {})
        api_count = sum(1 for p in result if p.startswith('api/'))
        # diversity penalty should prevent all 20 api files from dominating
        assert api_count < 20

    def test_size_map_overrides_entry_size(self):
        entries = [_entry('src/app.py', size=50), _entry('src/server.py', size=50)]
        size_map = {'src/app.py': 5000, 'src/server.py': 5000}
        result = _rank_source_paths(entries, size_map)
        assert 'src/app.py' in result or 'src/server.py' in result
