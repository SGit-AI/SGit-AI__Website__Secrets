# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Sections
# Writes review/intent/sections.json: every numbered section of the MVP brief
# with the anchor the rendered page gives its heading, so a projected node's
# {doc, section} source can link to the exact place in the brief. Derived
# from the brief's markdown with the same slug rule the renderer uses.
# Usage: python3 review/tools/sections.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import re
import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'admin' / 'build'))

from review_tree import ROOT, REVIEW, Review__Tree                                # noqa: E402
from md_to_html  import Markdown__To__Html                                        # noqa: E402


RE_HEADING = re.compile(r'^(#{1,6})\s+(\d+(?:\.\d+)*)\.?\s+(.+?)\s*$')


class Sections:

    def __init__(self, check=False, doc='docs/design/secrets-sgit-ai__mvp-build-brief.md', target=REVIEW / 'intent' / 'sections.json'):
        self.check  = check
        self.doc    = doc
        self.target = Path(target)
        self.tree   = Review__Tree()

    def collect(self):
        renderer = Markdown__To__Html()
        sections = {}
        for line in (ROOT / self.doc).read_text(encoding='utf-8').splitlines():
            if line.startswith('#'):
                match   = RE_HEADING.match(line)
                heading = re.sub(r'^#+\s+', '', line).strip()
                anchor  = renderer.slug(heading)                                  # keeps the renderer's duplicate counting in step
                if match:
                    number = match.group(2)
                    sections[number] = {'anchor': anchor, 'title': f'{number} {match.group(3)}'}
        return sections

    def run(self):
        data = {'doc': self.doc, 'page': '/' + self.doc[:-3] + '.html', 'sections': self.collect()}
        changed = self.tree.write_json(self.target, data, check=self.check)
        if self.check and changed:
            print(f'sections --check: {self.target.relative_to(ROOT)} is out of date; run python3 review/tools/sections.py')
            return 1
        print(f'sections: {len(data["sections"])} numbered sections of {self.doc}{" (updated)" if changed else " (current)"}')
        return 0


if __name__ == '__main__':
    sys.exit(Sections(check='--check' in sys.argv).run())
