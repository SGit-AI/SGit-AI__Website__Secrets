# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Chrome__In__Every__Page
# Every HTML page on the real tree carries the generated chrome: the CSP, the
# canonical URL on the CNAME host, the version badge equal to version.txt, the
# nav, the footer and a <main>.
# ═══════════════════════════════════════════════════════════════════════════════

import re
import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))

from chrome import Chrome, CSP                                                    # noqa: E402
from pages  import Site__Pages                                                    # noqa: E402


class Test__Chrome__In__Every__Page(TestCase):

    def setUp(self):
        self.chrome = Chrome()
        self.pages  = Site__Pages()
        self.files  = self.pages.html_files()

    def test_there_are_pages(self):
        self.assertGreaterEqual(len(self.files), 4)                             # index, 404, admin/index, admin/versions
        self.assertIn(ROOT / 'index.html', self.files)

    def test_every_page_has_the_chrome(self):
        for path in self.files:
            text = path.read_text(encoding='utf-8')
            with self.subTest(page=path.relative_to(ROOT).as_posix()):
                self.assertIn(f'<meta http-equiv="Content-Security-Policy" content="{CSP}">', text)
                self.assertIn(f'<link rel="canonical" href="{self.chrome.base_url}', text)
                self.assertIn('<header class="sg-header">', text)
                self.assertIn('<footer class="sg-footer">', text)
                self.assertRegex(text, r'<main\b')
                self.assertIn('<link rel="stylesheet" href="/assets/site.css">', text)
                self.assertIn('<script src="/assets/nav.js" defer></script>', text)
                self.assertIn('<nav class="site" aria-label="Site">', text)
                self.assertIn('<button class="nav-toggle"', text)
                self.assertEqual(text.count('<div class="ni ni-has">'), 4)      # the four groups

    def test_every_badge_equals_version_txt(self):
        for path in self.files:
            badges = re.findall(r'data-version="([^"]+)"', path.read_text(encoding='utf-8'))
            with self.subTest(page=path.relative_to(ROOT).as_posix()):
                self.assertTrue(badges)
                self.assertEqual(set(badges), {self.chrome.version})

    def test_canonical_matches_the_page_location(self):
        for path in self.files:
            page = self.pages.meta(path)
            text = path.read_text(encoding='utf-8')
            with self.subTest(page=page['url']):
                self.assertIn(f'<link rel="canonical" href="{self.chrome.canonical_url(page["url"])}">', text)
                self.assertIn(f'<meta property="og:url" content="{self.chrome.canonical_url(page["url"])}">', text)

    def test_no_inline_script_or_style(self):                                     # the CSP forbids both; a page must not depend on them
        for path in self.files:
            text = path.read_text(encoding='utf-8')
            with self.subTest(page=path.relative_to(ROOT).as_posix()):
                self.assertNotRegex(text, r'<script\b(?![^>]*\bsrc=)')
                self.assertNotIn('<style', text)
                self.assertNotRegex(text, r'\bstyle\s*=')
