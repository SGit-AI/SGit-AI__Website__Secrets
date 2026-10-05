# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Features__Schema
# data/features.json is well formed, agrees with the rules file it hashes, and
# every claim on the homepage and in docs/reality.md comes from it.
# ═══════════════════════════════════════════════════════════════════════════════

import hashlib
import json
import re

from pathlib  import Path
from unittest import TestCase


ROOT     = Path(__file__).resolve().parents[2]
STATUSES = {'shipped', 'proposed', 'absent'}
AREAS    = {'pipeline', 'site', 'infra', 'app', 'admin', 'tests'}


class Test__Features__Schema(TestCase):

    def setUp(self):
        self.data     = json.loads((ROOT / 'data' / 'features.json').read_text(encoding='utf-8'))
        self.features = self.data['features']

    def test_ids_are_unique_and_dotted_by_area(self):
        ids = [f['id'] for f in self.features]
        self.assertEqual(len(ids), len(set(ids)))
        for feature in self.features:
            self.assertTrue(feature['id'].startswith(feature['area'] + '.'), feature['id'])

    def test_statuses_and_since(self):
        for feature in self.features:
            with self.subTest(feature=feature['id']):
                self.assertIn(feature['status'], STATUSES)
                self.assertIn(feature['area'], AREAS)
                self.assertEqual(feature['status'] == 'shipped', 'since' in feature)
                for key in ('title', 'where', 'notes'):
                    self.assertTrue(feature[key].strip())

    def test_every_status_has_a_meaning(self):
        self.assertEqual(set(self.data['statuses']), STATUSES)

    def test_rules_hash_matches_the_file(self):
        rules  = (ROOT / self.data['rulesSource']).read_bytes()
        digest = 'sha256:' + hashlib.sha256(rules).hexdigest()
        self.assertEqual(self.data['rulesHash'], digest)

    def test_homepage_table_has_every_feature(self):
        text = (ROOT / 'index.html').read_text(encoding='utf-8')
        rows = re.findall(r'<table class="sg-features" data-area="all".*?</table>', text, re.S)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].count('<tr>') - 1, len(self.features))

    def test_reality_lists_every_feature(self):
        text = (ROOT / 'docs' / 'reality.md').read_text(encoding='utf-8')
        for feature in self.features:
            with self.subTest(feature=feature['id']):
                self.assertIn(f'| {feature["title"]} |', text)
        for status in STATUSES:
            self.assertIn(f'## {status.capitalize()} (', text)

    def test_shipped_rows_carry_the_current_or_an_earlier_version(self):
        version = tuple(int(p) for p in (ROOT / 'admin' / 'build' / 'version.txt').read_text().strip().split('.'))
        for feature in self.features:
            if feature['status'] == 'shipped':
                self.assertLessEqual(tuple(int(p) for p in feature['since'].split('.')), version, feature['id'])
