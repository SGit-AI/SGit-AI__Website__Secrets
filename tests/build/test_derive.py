# ── test_derive.py — step 2 of the review brief: the derived layers come from the syntax trees ──
#
# Runs the derivation over the fixture repository under review/tools/fixtures/repo
# (two Python classes with a subclass whose put() calls the base, one custom element
# over a base class, one test) and checks the shapes: classes with their methods,
# calls resolved across files, the import edge, the element and its handler. Then
# the real tree: graph/ validates, derive --check is clean, and the parser the
# JavaScript half runs is vendored, pinned and hashed, never fetched.

import hashlib
import json
import re
import subprocess
import sys
import tempfile

from pathlib  import Path
from unittest import TestCase

ROOT     = Path(__file__).resolve().parents[2]
TOOLS    = ROOT / 'review' / 'tools'
FIXTURE  = TOOLS / 'fixtures' / 'repo'
GRAPH    = ROOT / 'review' / 'graph'
MANIFEST = ROOT / 'vendor' / 'MANIFEST.json'
LAYERS   = ('index', 'files', 'modules', 'classes', 'methods', 'tests', 'surfaces')


class Test__Derive(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.out = Path(tempfile.mkdtemp(prefix='derive-fixture-'))
        result  = subprocess.run([sys.executable, str(TOOLS / 'derive.py'), '--root', str(FIXTURE), '--out', str(cls.out)], cwd=ROOT, capture_output=True, text=True)
        assert result.returncode == 0, result.stdout + result.stderr
        cls.layers = {name: json.loads((cls.out / f'{name}.json').read_text(encoding='utf-8')) for name in LAYERS}

    def edges(self, layer, verb):
        return {(e['from'], e['to']) for e in self.layers[layer]['edges'] if e['verb'] == verb}

    def test_fixture_counts_and_index(self):
        index = self.layers['index']
        self.assertEqual(index['layer'], 'index')
        self.assertEqual(index['counts'], {'files': 8, 'modules': 6, 'classes': 6, 'methods': 18, 'tests': 1, 'surfaces': 2})
        self.assertEqual(index['paths'], sorted(index['paths']))
        self.assertIn('components/fx-card/fx-card.js', index['paths'])
        for name in LAYERS:
            with self.subTest(layer=name):
                prov = self.layers[name]['provenance']
                self.assertEqual(prov['tool'], 'review/tools/derive.py')
                self.assertTrue(prov['inputs'], 'provenance names the inputs')

    def test_python_classes_methods_and_the_base_call(self):
        classes = {c['id']: c for c in self.layers['classes']['classes']}
        counted = classes['class:pkg/Store__Counted.py:Store__Counted']
        self.assertEqual(counted['base_ids'], ['class:pkg/Store__Memory.py:Store__Memory'])
        self.assertIn(('class:pkg/Store__Counted.py:Store__Counted', 'class:pkg/Store__Memory.py:Store__Memory'), self.edges('classes', 'inherits'))
        put = next(m for m in self.layers['methods']['methods'] if m['id'] == 'method:pkg/Store__Counted.py:Store__Counted.put')
        self.assertEqual(put['signature'], 'put(self, key, value)')
        self.assertIn(('method:pkg/Store__Counted.py:Store__Counted.put', 'method:pkg/Store__Memory.py:Store__Memory.put'), self.edges('methods', 'calls'), 'the subclass put() calls the base put()')
        self.assertIn(('module:pkg/Store__Counted.py', 'module:pkg/Store__Memory.py'), self.edges('modules', 'imports'))

    def test_javascript_element_class_and_handler(self):
        classes = {c['id']: c for c in self.layers['classes']['classes']}
        card = classes['class:components/fx-card/fx-card.js:FxCard']
        self.assertEqual(card['base_ids'], ['class:components/fx-base.js:FxBase'])
        surfaces = {s['id']: s for s in self.layers['surfaces']['surfaces']}
        self.assertEqual(surfaces['surface:element:fx-card']['handler'], 'class:components/fx-card/fx-card.js:FxCard')
        self.assertIn(('surface:element:fx-card', 'class:components/fx-card/fx-card.js:FxCard'), self.edges('surfaces', 'handled_by'))
        self.assertIn(('module:components/fx-card/fx-card.js', 'module:components/fx-base.js'), self.edges('modules', 'imports'))

    def test_tests_reach_the_module_they_import(self):
        tests = self.layers['tests']['tests']
        self.assertEqual(len(tests), 1)
        self.assertIn(('module:pkg/Service__Notes.py'), {e['to'] for e in self.layers['tests']['edges'] if e['verb'] == 'tests'})

    def test_every_edge_resolves_and_every_source_is_hashed(self):
        ids = set()
        for name in LAYERS[1:]:
            for item in self.layers[name][name]:
                ids.add(item['id'])
                if 'source' in item and 'sha256' in item['source']:
                    self.assertRegex(item['source']['sha256'], r'^[0-9a-f]{64}$')
        for name in LAYERS[1:]:
            for edge in self.layers[name]['edges']:
                with self.subTest(edge=f"{edge['from']} {edge['verb']} {edge['to']}"):
                    self.assertIn(edge['from'], ids)
                    self.assertIn(edge['to'], ids)

    def test_real_tree_is_derived_and_current(self):
        for name in LAYERS:
            self.assertTrue((GRAPH / f'{name}.json').exists(), f'graph/{name}.json missing')
        result = subprocess.run([sys.executable, str(TOOLS / 'derive.py'), '--check'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        index = json.loads((GRAPH / 'index.json').read_text(encoding='utf-8'))
        self.assertGreater(index['counts']['methods'], 100)
        self.assertIn('review/tools/derive.py', index['paths'])
        self.assertIn('vendor/acorn.mjs', index['paths'], 'vendored files are in the file layer (hashed, not parsed)')

    def test_the_javascript_parser_is_vendored_and_hashed(self):
        manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        entry    = manifest['files']['acorn.mjs'] if 'files' in manifest else manifest['acorn.mjs']
        digest   = hashlib.sha256((ROOT / 'vendor' / 'acorn.mjs').read_bytes()).hexdigest()
        self.assertEqual(entry['sha256'], digest)
        self.assertIn("from '../../vendor/acorn.mjs'", (TOOLS / 'derive_js.mjs').read_text(encoding='utf-8'))
        for page in ROOT.rglob('*.html'):
            if any(part in ('node_modules', '_site', 'fixtures') for part in page.parts):
                continue
            self.assertIsNone(re.search(r'<(script|link)[^>]*acorn', page.read_text(encoding='utf-8')), f'{page.relative_to(ROOT)} loads the build-time parser')
