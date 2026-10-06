# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Claims
# Everything links to everything: every claim in data/features.json carries
# evidence that resolves; every shipped claim has an anchor; the claims layer
# is what claims.py writes and validates; every status chip on the site is a
# link into the navigator at a claim that exists; every location that is a
# served file links into the source view; the brief is split into sections
# that match the markdown, one file per top-level section; every release
# carries its tag and commit, and the navigator shell has the brief and
# source regions.
# ═══════════════════════════════════════════════════════════════════════════════

import json
import re
import subprocess
import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))

from pages import Site__Pages                                                     # noqa: E402

CLAIMS   = ROOT / 'review' / 'intent' / 'claims.json'
FEATURES = ROOT / 'data' / 'features.json'
VERSIONS = ROOT / 'data' / 'versions.json'
BRIEF    = ROOT / 'review' / 'brief'
RE_CHIP  = re.compile(r'<(a|span) class="sg-status sg-status-(shipped|proposed|absent)"([^>]*)>')
RE_BLOCK = re.compile(r'<!-- sg-secrets:(?:features|status):start[^>]*-->([\s\S]*?)<!-- sg-secrets:(?:features|status):end -->')   # the chips that are claims; the steps tables reuse the classes


class Test__Claims(TestCase):

    def setUp(self):
        self.claims   = json.loads(CLAIMS.read_text(encoding='utf-8'))
        self.features = json.loads(FEATURES.read_text(encoding='utf-8'))['features']
        self.ids      = {c['id'] for c in self.claims['claims']}

    def test_every_feature_is_a_claim_with_evidence(self):
        self.assertEqual({f'claim.{f["id"]}' for f in self.features}, self.ids)
        for feature in self.features:
            with self.subTest(claim=feature['id']):
                self.assertTrue(feature.get('evidence'), 'a claim without evidence is not a claim')
                self.assertTrue(any(e['verb'] == 'realises' for e in feature['evidence']), 'realises no intent node')

    def test_shipped_claims_end_on_an_anchor(self):
        anchors = {a['id'] for a in self.claims['anchors']}
        releases = {r['id'] for r in self.claims['releases']}
        for claim in self.claims['claims']:
            if claim['status'] != 'shipped':
                continue
            targets = {e['to'] for e in self.claims['edges'] if e['from'] == claim['id']}
            with self.subTest(claim=claim['id']):
                self.assertTrue(targets & (anchors | releases), 'a shipped claim with nothing to open')

    def test_claims_layer_is_current_and_strict(self):
        result = subprocess.run(['python3', 'review/tools/claims.py', '--check'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(self.claims['provenance']['strict'])
        for anchor in self.claims['anchors']:
            with self.subTest(anchor=anchor['id']):
                self.assertNotIn('#', anchor['id'])
                self.assertTrue(anchor['href'].startswith(('/', 'https://')))
                if anchor['kind'] in ('file', 'test') and anchor['href'].startswith('/review/ui/#file='):
                    self.assertTrue((ROOT / anchor['ref'].split(':', 1)[1].split('#')[0]).exists())

    def test_every_status_chip_links_to_its_claim(self):
        pages = Site__Pages().html_files()
        seen  = 0
        for path in pages:
            text = '\n'.join(RE_BLOCK.findall(path.read_text(encoding='utf-8')))
            for tag, status, attrs in RE_CHIP.findall(text):
                with self.subTest(page=path.relative_to(ROOT).as_posix()):
                    self.assertEqual(tag, 'a', 'a status chip is a link')
                    match = re.search(r'href="/review/ui/#node=(claim\.[^"]+)"', attrs)
                    self.assertIsNotNone(match)
                    self.assertIn(match.group(1), self.ids)
                    seen += 1
        self.assertGreater(seen, 50)

    def test_locations_link_into_the_source_view(self):
        text = (ROOT / 'shipped' / 'index.html').read_text(encoding='utf-8')
        for match in re.finditer(r'href="/review/ui/#file=([^"&]+)', text):
            with self.subTest(file=match.group(1)):
                self.assertTrue((ROOT / match.group(1)).is_file())
        self.assertIn('href="/review/ui/#file=assets/themes.css"', text)

    def test_brief_sections_match_the_markdown(self):
        result = subprocess.run(['python3', 'review/tools/brief.py', '--check'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        index    = json.loads((BRIEF / 'index.json').read_text(encoding='utf-8'))
        headings = re.findall(r'^## (\d+)\.', (ROOT / index['doc']).read_text(encoding='utf-8'), re.M)
        self.assertEqual([s['id'] for s in index['sections']], headings)
        self.assertEqual(len(list((BRIEF / 'sections').glob('*.json'))), len(headings))
        for section in index['sections']:
            data = json.loads((BRIEF / section['file']).read_text(encoding='utf-8'))
            with self.subTest(section=section['id']):
                self.assertEqual(data['id'], section['id'])
                self.assertEqual([s['id'] for s in data['subsections']], [s['id'] for s in section['subsections']])
                self.assertNotIn('<script', data['html'])

    def test_releases_carry_their_records(self):
        releases = json.loads(VERSIONS.read_text(encoding='utf-8'))['releases']
        tags     = set(subprocess.run(['git', 'tag', '-l'], cwd=ROOT, capture_output=True, text=True).stdout.split())
        for release in releases[1:]:                                              # the newest gets its commit and run at the next release; a tag CI has not made yet is not demanded
            if f'v{release["version"]}' not in tags:
                continue
            with self.subTest(version=release['version']):
                self.assertEqual(release['tag'], f'v{release["version"]}')
                self.assertRegex(release['commit'] or '', r'^[0-9a-f]{40}$')
                self.assertTrue(release['run'] and release['run']['url'].startswith('https://github.com/'))

    def test_navigator_shell_has_the_regions(self):
        text = (ROOT / 'review' / 'ui' / 'index.html').read_text(encoding='utf-8')
        for region in ('node', 'brief', 'file'):
            self.assertIn(f'data-region="{region}"', text)
        for name in ('review-brief', 'review-source'):
            self.assertIn(f'components/{name}/{name}.js', text)
