# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Review__Folder
# The review folder's own tools on the real tree and on fixtures: every file
# validates, the grammar's verbs all have distinct inverses, a stale provenance
# fails freshness, the README is byte-identical when generated twice, and the
# schema validator rejects what it should.
# ═══════════════════════════════════════════════════════════════════════════════

import json
import subprocess
import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'review' / 'tools'))

from review_tree import Review__Tree                                              # noqa: E402
from schema      import Schema__Validator                                         # noqa: E402


class Test__Review__Folder(TestCase):

    def run_tool(self, *argv):
        return subprocess.run([sys.executable, *argv], cwd=ROOT, capture_output=True, text=True)

    def test_every_review_file_validates(self):
        result = self.run_tool('review/tools/validate_review.py')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_freshness_passes_on_the_tree(self):
        for extra in ([], ['--set', 'self']):
            result = self.run_tool('review/tools/freshness.py', *extra)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_readme_is_current_and_deterministic(self):
        first = (ROOT / 'review' / 'README.md').read_text(encoding='utf-8')
        self.assertEqual(self.run_tool('review/tools/readme.py', '--check').returncode, 0)
        self.assertEqual(self.run_tool('review/tools/readme.py').returncode, 0)
        self.assertEqual((ROOT / 'review' / 'README.md').read_text(encoding='utf-8'), first)

    def test_verbs_have_distinct_inverses_and_sentences(self):
        verbs = json.loads((ROOT / 'review' / 'tools' / 'verbs.json').read_text(encoding='utf-8'))['verbs']
        for name, spec in verbs.items():
            with self.subTest(verb=name):
                self.assertIn(spec['inverse'], verbs)
                self.assertNotEqual(spec['inverse'], name)
                self.assertEqual(verbs[spec['inverse']]['inverse'], name)
                self.assertTrue(spec['sentence'].strip() and spec['domain'] and spec['range'])
        self.assertNotIn('relates_to', verbs)                                     # the generic association edge is banned

    def test_tree_hash_is_stable_and_sensitive(self):
        tree = Review__Tree()
        self.assertEqual(tree.tree_hash(), tree.tree_hash())
        files = tree.source_files()
        self.assertIn('admin/build/validate.js', files)
        self.assertNotIn('review/tools/fixtures/repo/pkg/Store__Memory.py', files)
        self.assertNotEqual(tree.tree_hash(files), tree.tree_hash(files[:-1]))

    def test_stale_provenance_fails_freshness(self):
        tree  = Review__Tree()
        stale = ROOT / 'review' / 'self' / 'graph' / 'files.json'
        try:
            stale.write_text(tree.dumps({'layer': 'files', 'files': [], 'provenance': {'tool': 'test', 'tool_version': '0', 'commit': 'x', 'tree_sha256': '0' * 64, 'inputs': {}}}), encoding='utf-8')
            result = self.run_tool('review/tools/freshness.py', '--set', 'self')
            self.assertEqual(result.returncode, 1, result.stdout)
            self.assertIn('re-run the derivation', result.stdout)
        finally:
            stale.unlink()

    def test_schema_validator_subset(self):
        schema = {'type': 'object', 'required': ['id'], 'additionalProperties': False,
                  'properties': {'id': {'type': 'string', 'pattern': '^[a-z]+$'}, 'n': {'type': 'integer'}, 'kind': {'enum': ['a', 'b']},
                                 'items': {'type': 'array', 'minItems': 1, 'items': {'$ref': '#/$defs/item'}}},
                  '$defs': {'item': {'type': 'object', 'required': ['v'], 'properties': {'v': {'anyOf': [{'type': 'string'}, {'type': 'null'}]}}}}}
        ok  = Schema__Validator(schema).validate({'id': 'abc', 'n': 2, 'kind': 'a', 'items': [{'v': None}]})
        bad = Schema__Validator(schema).validate({'id': 'A1', 'n': True, 'kind': 'c', 'extra': 1, 'items': []})
        self.assertEqual(ok, [])
        self.assertEqual(len(bad), 5, bad)                                       # pattern, integer-not-bool, enum, unexpected key, minItems

    def test_fixture_repository_is_present(self):
        repo = ROOT / 'review' / 'tools' / 'fixtures' / 'repo'
        self.assertTrue((repo / 'pkg' / 'Service__Notes.py').exists())
        self.assertTrue((repo / 'components' / 'fx-card' / 'fx-card.js').exists())
        self.assertTrue((repo / 'components' / 'fx-card' / 'fx-card.html').exists())
        self.assertTrue((repo / 'components' / 'fx-card' / 'fx-card.css').exists())
