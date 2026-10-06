# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Twins__Exist
# Every HTML page has a markdown twin beside it; the twin names its source and
# the site version, and every internal link inside it points at markdown.
# ═══════════════════════════════════════════════════════════════════════════════

import re
import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))

from chrome import Chrome                                                         # noqa: E402
from pages  import Site__Pages                                                    # noqa: E402


class Test__Twins__Exist(TestCase):

    def setUp(self):
        self.chrome = Chrome()
        self.pages  = Site__Pages()

    def test_every_page_has_a_twin(self):
        for path in self.pages.html_files():
            twin = self.pages.twin_file(path)
            if self.pages.meta_source(path):                                      # rendered from markdown: the markdown is beside it and is the twin
                self.assertEqual('/' + twin.relative_to(ROOT).as_posix(), self.pages.meta_source(path))
            with self.subTest(page=path.relative_to(ROOT).as_posix()):
                self.assertTrue(twin.exists(), f'{twin.relative_to(ROOT)} is missing')

    def test_twin_names_source_and_version(self):
        for path in self.pages.html_files():
            page = self.pages.meta(path)
            if page['source']:
                continue
            text = self.pages.twin_file(path).read_text(encoding='utf-8')
            with self.subTest(page=page['url']):
                self.assertIn(f'*Source: <{self.chrome.canonical_url(page["url"])}>', text)
                self.assertIn(f'· site v{self.chrome.version} ', text)
                self.assertTrue(text.startswith('# '))

    def test_internal_links_in_twins_point_at_markdown(self):
        for path in self.pages.html_files():
            if self.pages.meta_source(path):
                continue
            text  = self.pages.twin_file(path).read_text(encoding='utf-8')
            links = [href for href in re.findall(r'\]\(([^)\s]+)\)', text) if not href.startswith('http')]
            with self.subTest(page=path.relative_to(ROOT).as_posix()):
                for href in links:
                    target = href.split('#')[0]
                    twin   = target[:-5] + '.md' if target.endswith('.html') else target + 'index.md' if target.endswith('/') else None
                    if twin and (ROOT / twin.lstrip('/')).exists():
                        self.fail(f'{href} should point at its twin {twin}')      # a page with no twin (the review shell) keeps its HTML link

    def test_index_md_is_the_homepage_twin(self):
        text = (ROOT / 'index.md').read_text(encoding='utf-8')
        self.assertIn('secrets.sgit.ai', text.splitlines()[0])
        self.assertIn('| Area | Feature | Status |', text)                       # the status table survives conversion
