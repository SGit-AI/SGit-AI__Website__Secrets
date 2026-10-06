# ── test_learn.py — the learn section: terms defined once, diagrams drawn by the build, the lab held to the app's rules ──

import json
import re
import subprocess
import sys

from pathlib  import Path
from unittest import TestCase

ROOT     = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))

from pages      import Site__Pages                                                # noqa: E402
from gen_terms  import Gen__Terms                                                 # noqa: E402

TERMS    = ROOT / 'data' / 'terms.json'
DIAGRAMS = ROOT / 'data' / 'diagrams'
LAB      = ROOT / 'components' / 'passkey-lab' / 'passkey-lab.js'
LEARN    = ('learn/index.html', 'learn/passkeys/index.html', 'learn/keys/index.html', 'learn/gcp/index.html')
RE_TERM  = re.compile(r'<a class="sg-term" href="([^"]+)" title="([^"]*)">([^<]+)</a>')


class Test__Learn(TestCase):

    def setUp(self):
        self.pages = Site__Pages()
        self.terms = json.loads(TERMS.read_text(encoding='utf-8'))['terms']

    def test_every_term_resolves_to_a_page_and_an_anchor(self):
        for term in self.terms:
            with self.subTest(term=term['id']):
                path, _, fragment = term['href'].partition('#')
                page = ROOT / path.lstrip('/') / 'index.html' if path.endswith('/') else ROOT / path.lstrip('/')
                self.assertTrue(page.exists(), f'{term["href"]}: no page')
                if fragment:
                    self.assertIn(f'id="{fragment}"', page.read_text(encoding='utf-8'), f'{term["href"]}: no anchor')
                self.assertTrue(term['definition'].endswith('.'), 'a definition is a sentence')

    def test_term_links_in_pages_match_the_glossary(self):
        by_href = {t['href']: t for t in self.terms}
        linked  = set()
        for page in self.pages.html_files():
            text = page.read_text(encoding='utf-8')
            for href, title, shown in RE_TERM.findall(text):
                with self.subTest(page=page.relative_to(ROOT).as_posix(), term=shown):
                    self.assertIn(href, by_href, 'a term link the glossary does not define')
                    self.assertEqual(title, by_href[href]['definition'].replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;').replace("'", '&#x27;'))
                    self.assertNotEqual(self.pages.url_path(page), href.split('#')[0], 'a page links a term to itself')
                    linked.add(href)
            if '<main data-terms>' in text:
                self.assertEqual(len(RE_TERM.findall(text)), len({h for h, _, _ in RE_TERM.findall(text)}), 'a term is linked at most once per page')
        self.assertIn('/learn/passkeys/#passkey', linked, 'the security page links passkey')
        self.assertIn('/learn/gcp/#gcp', linked)

    def test_generators_are_current(self):
        for tool in ('gen_terms', 'gen_diagrams'):
            with self.subTest(tool=tool):
                result = subprocess.run([sys.executable, f'admin/build/{tool}.py', '--check'], cwd=ROOT, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_each_learn_page_has_its_blocks(self):
        for rel in LEARN:
            text = (ROOT / rel).read_text(encoding='utf-8')
            with self.subTest(page=rel):
                self.assertIn('<main data-terms>', text)
                self.assertIn('sg-secrets:status:start', text)
                if rel != 'learn/index.html':
                    self.assertIn('<figure class="sg-diagram"', text, 'a learn page carries at least one drawn diagram')
                    self.assertIn('The same diagram as text', text)
                    self.assertNotIn('<script src="http', text)
        self.assertIn('<dl class="sg-terms"', (ROOT / 'learn/index.html').read_text(encoding='utf-8'))

    def test_diagrams_use_tokens_only_and_every_lane_is_used(self):
        for path in sorted(DIAGRAMS.glob('*.json')):
            d = json.loads(path.read_text(encoding='utf-8'))
            with self.subTest(diagram=path.stem):
                self.assertEqual(d['id'], path.stem)
                if d['kind'] == 'sequence':
                    lanes = {lane['id'] for lane in d['lanes']}
                    used  = set()
                    for step in d['steps']:
                        ids = {step['note']} if 'note' in step else {step['from'], step['to']}
                        self.assertTrue(ids <= lanes, f'{ids - lanes} is not a lane')
                        used |= ids
                    self.assertEqual(used, lanes, 'every lane takes part')
                else:
                    items = {item['id'] for item in d['items']}
                    for link in d['links']:
                        self.assertIn(link['from'], items)
                        self.assertIn(link['to'], items)
        rendered = (ROOT / 'learn/passkeys/index.html').read_text(encoding='utf-8')
        svg = rendered[rendered.index('<svg'):rendered.index('</svg>')]
        self.assertIsNone(re.search(r'#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(', svg), 'a drawn diagram uses the theme tokens, never a colour literal')

    def test_the_lab_keeps_the_rules_of_the_app(self):
        text = LAB.read_text(encoding='utf-8')
        self.assertIn("Object.freeze(['secrets.sgit.ai', 'localhost'])", text, 'the RP IDs are the host and localhost')
        self.assertNotRegex(text, r"""['"]sgit\.ai['"]""", 'never the apex')
        self.assertIn("rp : { id : this.rpId", text)
        self.assertIn("residentKey : 'required', userVerification : 'required'", text)
        self.assertIn("extensions : { prf : {} }", text)
        self.assertIn("prf : { eval : { first : salt } }", text)
        self.assertIn("'sgit-secrets/v1/wrap/'", text, 'the HKDF label of section 8.2')
        self.assertNotRegex(text, r'fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket', 'the lab makes no request')
        for store in ('sessionStorage', 'indexedDB'):
            self.assertNotIn(store, text)
        self.assertEqual(re.findall(r'localStorage\s*\.\s*setItem\s*\(\s*([^,]+),', text), ['LOCAL_STORAGE_KEYS.lab'])
        self.assertIn("JSON.stringify(this.record)", text, 'only the record is written')
        self.assertNotIn('prf', re.search(r'writeRecord\(\) \{(.*?)\n    \}', text, re.S).group(1), 'the record holds no PRF bytes')
        self.assertIn("addEventListener('pagehide'", text)
        page = (ROOT / 'learn/passkeys/index.html').read_text(encoding='utf-8')
        self.assertIn('<passkey-lab></passkey-lab>', page)
        self.assertIn('<script type="module" src="/components/passkey-lab/passkey-lab.js"></script>', page)
