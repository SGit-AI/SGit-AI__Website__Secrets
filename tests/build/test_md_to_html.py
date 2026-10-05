# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Md__To__Html
# The markdown renderer on the constructs the documents use, and on the real
# design documents: every heading rendered, every table rendered, no raw
# markdown table rows left in the HTML.
# ═══════════════════════════════════════════════════════════════════════════════

import re
import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))

from md_to_html import Markdown__To__Html                                          # noqa: E402


class Test__Md__To__Html(TestCase):

    def render(self, markdown):
        return Markdown__To__Html().render(markdown)

    def test_headings_get_github_ids(self):
        out = self.render('# A title\n\n## 3.4 What a compromised party gets\n\n## C1. "Type_Safe style"')
        self.assertIn('<h1 id="a-title">A title</h1>', out)
        self.assertIn('<h2 id="34-what-a-compromised-party-gets">', out)
        self.assertIn('<h2 id="c1-type_safe-style">', out)

    def test_inline(self):
        out = self.render('Some **bold**, *soft*, `code`, a [link](x.md#frag) and <https://sgit.ai/>.')
        self.assertEqual(out, '<p>Some <strong>bold</strong>, <em>soft</em>, <code>code</code>, a <a href="x.md#frag">link</a> and <a href="https://sgit.ai/">https://sgit.ai/</a>.</p>\n')

    def test_html_is_escaped(self):
        out = self.render('a <script>alert(1)</script> & `x < y`')
        self.assertNotIn('<script>', out)
        self.assertIn('&lt;script&gt;', out)
        self.assertIn('<code>x &lt; y</code>', out)

    def test_table(self):
        out = self.render('| A | B |\n|---|---:|\n| 1 | `x` |\n| 2 | y \\| z |')
        self.assertIn('<thead><tr><th>A</th><th align="right">B</th></tr></thead>', out)
        self.assertIn('<tr><td>1</td><td align="right"><code>x</code></td></tr>', out)
        self.assertIn('<td align="right">y | z</td>', out)

    def test_nested_and_ordered_lists(self):
        out = self.render('- a\n- b\n  - c\n\n4. four\n5. five\n\n- [ ] todo\n- [x] done')
        self.assertIn('<ul>\n<li>a</li>\n<li>b\n<ul>\n<li>c</li>\n</ul></li>\n</ul>', out)
        self.assertIn('<ol start="4">\n<li>four</li>\n<li>five</li>\n</ol>', out)
        self.assertIn('<li>☐ todo</li>', out)
        self.assertIn('<li>☑ done</li>', out)

    def test_code_fence_and_blockquote(self):
        out = self.render('```json\n{ "a": 1 }\n```\n\n> quoted **bold**\n> second line\n\n---')
        self.assertIn('<pre><code class="language-json">{ &quot;a&quot;: 1 }</code></pre>', out)
        self.assertIn('<blockquote>\n<p>quoted <strong>bold</strong> second line</p>\n</blockquote>', out)
        self.assertIn('<hr>', out)

    def test_link_rewriter(self):
        out = Markdown__To__Html(lambda h: h.replace('.md', '.html')).render('[x](a.md) [y](https://e.org/b.md)')
        self.assertIn('href="a.html"', out)
        self.assertIn('href="https://e.org/b.html"', out)                        # the rewriter decides; gen_docs leaves absolute links alone

    def test_real_documents_render_every_heading_and_table(self):
        for path in sorted((ROOT / 'docs' / 'design').glob('*.md')):
            text = path.read_text(encoding='utf-8')
            out  = self.render(text)
            with self.subTest(document=path.name):
                headings = len(re.findall(r'^#{1,6}\s', text, re.M))
                self.assertEqual(len(re.findall(r'<h[1-6] id=', out)), headings)
                self.assertNotRegex(out, r'^\|.*\|$', 'a markdown table row survived unrendered')
                self.assertNotIn('```', out)
