# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Html__To__Md
# The twin converter on the fragments the site uses: headings, paragraphs,
# lists, tables, links (rewritten to .md), code and emphasis.
# ═══════════════════════════════════════════════════════════════════════════════

import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))

from html_to_md import Html__To__Markdown                                          # noqa: E402


class Test__Html__To__Md(TestCase):

    def convert(self, fragment):
        return Html__To__Markdown.convert(fragment)

    def test_headings_and_paragraphs(self):
        md = self.convert('<h1>Title</h1><p>One <strong>bold</strong> and <em>soft</em>.</p><h2>Next</h2>')
        self.assertEqual(md, '# Title\n\nOne **bold** and *soft*.\n\n## Next\n')

    def test_links_point_at_twins(self):
        md = self.convert('<p><a href="/admin/versions.html">v</a> <a href="/admin/">a</a> <a href="https://sgit.ai/x.html">x</a> <a href="/llms.txt">l</a></p>')
        self.assertEqual(md, '[v](/admin/versions.md) [a](/admin/index.md) [x](https://sgit.ai/x.html) [l](/llms.txt)\n')

    def test_lists(self):
        md = self.convert('<ul><li>a</li><li>b<ul><li>c</li></ul></li></ul><ol><li>one</li><li>two</li></ol>')
        self.assertEqual(md, '- a\n- b\n  - c\n\n1. one\n2. two\n')

    def test_table(self):
        md = self.convert('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>x | y</td></tr></tbody></table>')
        self.assertEqual(md, '| A | B |\n|---|---|\n| 1 | x \\| y |\n')

    def test_code(self):
        md = self.convert('<p>Run <code>gate.py</code>.</p><pre><code>line 1\nline 2</code></pre>')
        self.assertEqual(md, 'Run `gate.py`.\n\n```\nline 1\nline 2\n```\n')

    def test_spans_and_scripts(self):
        md = self.convert('<p><span class="sg-status">shipped v0.1.0</span></p><script>alert(1)</script>')
        self.assertEqual(md, 'shipped v0.1.0\n')
