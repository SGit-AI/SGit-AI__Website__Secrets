# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Reader
# The reader's column and the comms channel: the site components follow the
# coding.sgit.ai shape (three files, the base contract, no colour, no inline
# handler, no semicolon line ends, no location.hash assignment); every browser
# storage key they write is allow-listed; every page carries the column and
# its module; only /reader/ widens connect-src; the contact file has the
# Agent Contact v0.1 shape and, when a bundle is published, fingerprints that
# match the keys; the search index is what gen_search writes.
# ═══════════════════════════════════════════════════════════════════════════════

import base64
import hashlib
import json
import re
import subprocess
import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))

from chrome import Chrome                                                        # noqa: E402
from pages  import Site__Pages                                                    # noqa: E402

COMPONENTS = ROOT / 'components'
CONTACT    = ROOT / '.well-known' / 'sgit-agents.json'
RE_COLOUR  = re.compile(r'(?<!&)#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(')
RE_SETITEM = re.compile(r'\b(localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*([^,)]+)')


class Test__Reader(TestCase):

    def components(self):
        return sorted(p for p in COMPONENTS.iterdir() if p.is_dir())

    def test_three_files_per_component_and_the_base_contract(self):
        names = [p.name for p in self.components()]
        self.assertEqual(names, ['proto-app', 'proto-base', 'proto-column', 'reader-chat', 'reader-log', 'reader-panel', 'sg-base'])
        for folder in self.components():
            with self.subTest(component=folder.name):
                self.assertEqual(sorted(p.name for p in folder.iterdir()), [f'{folder.name}.css', f'{folder.name}.html', f'{folder.name}.js'])
                text = (folder / f'{folder.name}.js').read_text(encoding='utf-8')
                self.assertIn('static jsUrl = import.meta.url', text)
                self.assertIn(f"customElements.define('{folder.name}'", text)
                self.assertIn('@module', text)
                self.assertIn('get resourceName()', text)
                if folder.name != 'sg-base':
                    self.assertNotIn('connectedCallback', text)
                self.assertNotIn(';\n', text, 'the house writes JavaScript without semicolons')
                self.assertNotRegex(text, r'location\.hash\s*=')
                self.assertIsNone(RE_COLOUR.search(text))
                markup = (folder / f'{folder.name}.html').read_text(encoding='utf-8')
                self.assertNotIn('<style', markup)
                self.assertNotRegex(markup, r'\son[a-z]+=', 'no inline handlers')
                self.assertIsNone(RE_COLOUR.search((folder / f'{folder.name}.css').read_text(encoding='utf-8')))

    def test_storage_keys_are_members_of_the_allow_list(self):
        for folder in self.components():
            text = (folder / f'{folder.name}.js').read_text(encoding='utf-8')
            for store, arg in RE_SETITEM.findall(text):
                with self.subTest(component=folder.name, call=arg):
                    self.assertRegex(arg.strip(), r'^(LOCAL|SESSION)_STORAGE_KEYS\.[a-zA-Z]+$')
                    self.assertEqual(arg.strip().split('_')[0], 'LOCAL' if store == 'localStorage' else 'SESSION')

    def test_the_key_never_goes_to_local_storage(self):
        text = (COMPONENTS / 'reader-chat' / 'reader-chat.js').read_text(encoding='utf-8')
        self.assertNotRegex(text, r'localStorage\s*\.')
        self.assertIn('SESSION_STORAGE_KEYS.openrouterKey', text)

    def test_every_page_carries_the_column(self):
        for path in Site__Pages().html_files():
            text = path.read_text(encoding='utf-8')
            with self.subTest(page=path.relative_to(ROOT).as_posix()):
                self.assertIn('<script type="module" src="/components/reader-panel/reader-panel.js"></script>', text)
                self.assertIn('<reader-panel></reader-panel>', text)

    def test_only_the_reader_page_widens_connect_src(self):
        chrome = Chrome()
        for path in Site__Pages().html_files():
            text    = path.read_text(encoding='utf-8')
            rel     = path.relative_to(ROOT).as_posix()
            widened = 'https://openrouter.ai' in text.split('</head>')[0]
            with self.subTest(page=rel):
                self.assertEqual(widened, rel == 'reader/index.html')
        self.assertIn('https://openrouter.ai https://dev.send.sgraph.ai', chrome.csp('https://openrouter.ai https://dev.send.sgraph.ai'))
        self.assertNotIn('openrouter', chrome.csp())

    def test_contact_file_shape(self):
        data     = json.loads(CONTACT.read_text(encoding='utf-8'))
        self.assertEqual(data['schema'], 'sgit-agents/v1')
        self.assertEqual(data['site'], Chrome().host)
        identity = data['identities']['build-agent']
        inbox    = identity['inbox']
        for key in ('alias', 'role', 'address', 'serial', 'created', 'fingerprint', 'signing_fingerprint', 'bundle', 'retired', 'inbox'):
            self.assertIn(key, identity)
        self.assertIn(inbox['status'], ('pending', 'configuring', 'open', 'closed'))
        self.assertTrue(inbox['endpoint'].startswith('https://'))
        for lane in inbox['lanes']:
            self.assertRegex(lane['append_token'], r'^[0-9a-f]{16,128}$')
            self.assertIn(lane['name'], ('readers', 'agents'))
        if inbox['status'] == 'open':
            self.assertTrue(inbox['vault'] and identity['bundle'] and any(l['name'] == 'readers' for l in inbox['lanes']), 'an open inbox names its vault, bundle and readers lane')
        if identity['bundle']:
            for pem, expected in ((identity['bundle']['encrypt'], identity['fingerprint']), (identity['bundle']['sign'], identity['signing_fingerprint'])):
                der = base64.b64decode(''.join(l for l in pem.splitlines() if 'KEY-----' not in l))
                self.assertEqual('sha256:' + hashlib.sha256(der).hexdigest()[:16], expected)

    def test_search_index_is_fresh_and_covers_every_page(self):
        result = subprocess.run(['python3', 'admin/build/gen_search.py', '--check'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        index = json.loads((ROOT / 'data' / 'search-index.json').read_text(encoding='utf-8'))
        urls  = {entry['url'] for entry in index['entries']}
        pages = Site__Pages()
        for path in pages.html_files():
            url = pages.meta(path)['url']
            if url != '/404.html':
                self.assertIn(url, urls)
        for entry in index['entries']:
            self.assertTrue(entry['title'] and entry['twin'].endswith('.md'))

    def test_comms_tools_parse_and_name_no_secret(self):
        for path in sorted((ROOT / 'tools' / 'comms').glob('*.py')):
            with self.subTest(tool=path.name):
                result = subprocess.run(['python3', '-m', 'py_compile', str(path)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                text = path.read_text(encoding='utf-8')
                self.assertNotRegex(text, r'sgit_private_(vault|read)_[0-9a-f]{8}')
