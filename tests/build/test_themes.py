# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Themes
# The themes are data (data/themes.json), the colours are one file
# (assets/themes.css) and nothing else on the site names a colour. Every theme
# defines every token the default defines; every page loads theme.js and
# themes.css before site.css; the nav picker lists every theme; the storage
# key theme.js writes is the one app/config/storage-keys.js allows.
# ═══════════════════════════════════════════════════════════════════════════════

import json
import re
import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))

from chrome import Chrome, THEME_STORAGE_KEY                                     # noqa: E402
from pages  import Site__Pages                                                    # noqa: E402

RE_COLOUR    = re.compile(r'(?<!&)#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(')
RE_BLOCK     = re.compile(r'([^{}]+)\{([^{}]*)\}', re.S)
RE_COMMENT   = re.compile(r'/\*.*?\*/', re.S)
RE_TOKEN     = re.compile(r'(--sg-[a-z0-9-]+)\s*:')
RE_FALLBACK  = re.compile(r'var\(--sg-[a-z0-9-]+,\s*([^)]*\)?[^)]*)\)')
COLOUR_FILES = {'assets/themes.css'}                                              # the only place a colour is written for its own sake
SKIP_DIRS    = {'node_modules', 'vendor', 'fixtures', '.git'}


class Test__Themes(TestCase):

    def setUp(self):
        self.data   = json.loads((ROOT / 'data' / 'themes.json').read_text(encoding='utf-8'))
        self.themes = self.data['themes']
        self.css    = (ROOT / 'assets' / 'themes.css').read_text(encoding='utf-8')
        self.blocks = {sel.strip(): body for sel, body in RE_BLOCK.findall(RE_COMMENT.sub('', self.css))}

    def tokens_of(self, selector):
        for sel, body in self.blocks.items():
            if selector in [s.strip() for s in sel.split(',')]:
                return set(RE_TOKEN.findall(body))
        self.fail(f'themes.css has no block for {selector}')

    def test_four_themes_dark_and_light(self):
        ids = [t['id'] for t in self.themes]
        self.assertEqual(len(ids), 4)
        self.assertEqual(len(set(ids)), 4)
        self.assertIn(self.data['default'], ids)
        self.assertIn(self.data['whenPreferringLight'], ids)
        self.assertEqual({t['mode'] for t in self.themes}, {'dark', 'light'})
        for theme in self.themes:
            with self.subTest(theme=theme['id']):
                self.assertRegex(theme['id'], r'^[a-z]+$')                      # what theme.js accepts
                for key in ('name', 'description', 'about'):
                    self.assertTrue(theme[key])

    def test_default_block_is_the_default_theme(self):
        default = self.tokens_of(':root')
        self.assertEqual(default, self.tokens_of(f'html[data-theme="{self.data["default"]}"]'))
        self.assertGreaterEqual(len(default), 20)

    def test_every_theme_defines_every_token(self):
        default = self.tokens_of(':root')
        for theme in self.themes:
            with self.subTest(theme=theme['id']):
                self.assertEqual(self.tokens_of(f'html[data-theme="{theme["id"]}"]'), default)

    def test_theme_js_follows_the_data(self):
        text = (ROOT / 'assets' / 'theme.js').read_text(encoding='utf-8')
        self.assertIn(f"'{THEME_STORAGE_KEY}'", text)
        self.assertIn(f"dark : '{self.data['default']}'", text)
        self.assertIn(f"light : '{self.data['whenPreferringLight']}'", text)
        self.assertIsNone(RE_COLOUR.search(text))

    def test_storage_key_is_the_allowed_one(self):
        keys = (ROOT / 'app' / 'config' / 'storage-keys.js').read_text(encoding='utf-8')
        self.assertRegex(keys, r"theme\s*:\s*'" + re.escape(THEME_STORAGE_KEY) + "'")

    def test_no_colour_outside_themes_css(self):
        for path in sorted(ROOT.rglob('*')):
            rel = path.relative_to(ROOT).as_posix()
            if path.suffix not in ('.css', '.js') or SKIP_DIRS & set(path.parts) or rel in COLOUR_FILES:
                continue
            text = path.read_text(encoding='utf-8')
            if rel == 'review/ui/tokens.css':                                     # fallbacks only: every literal sits inside var(--sg-…, …)
                text = RE_FALLBACK.sub('', text)
            with self.subTest(file=rel):
                self.assertIsNone(RE_COLOUR.search(text), 'a colour outside assets/themes.css')

    def test_every_page_loads_the_theme_before_the_stylesheet(self):
        pages = Site__Pages().html_files() + [ROOT / 'review' / 'ui' / 'index.html']
        for path in pages:
            text = path.read_text(encoding='utf-8')
            with self.subTest(page=path.relative_to(ROOT).as_posix()):
                script = text.index('<script src="/assets/theme.js"></script>')
                themes = text.index('<link rel="stylesheet" href="/assets/themes.css">')
                self.assertLess(script, themes)
                self.assertEqual(themes, text.index('<link rel="stylesheet" href="'))  # the first stylesheet is themes.css
                for theme in self.themes:
                    self.assertIn(f'data-theme-pick="{theme["id"]}"', text)
                self.assertNotIn('data-theme=', text.split('<body')[0].split('<html')[1].split('>')[0])  # no theme pinned in the markup

    def test_picker_is_generated_from_the_data(self):
        picker = Chrome().theme_picker()
        for theme in self.themes:
            self.assertIn(f'data-theme-pick="{theme["id"]}" aria-pressed="false"><b>{theme["name"]}</b><small>{theme["description"]}</small>', picker)
        self.assertIn(THEME_STORAGE_KEY, picker)
