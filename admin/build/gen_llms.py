# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gen__Llms
# Generates the machine indexes: llms.txt (every page and document, one line
# each), llms-full.txt (every page twin and every document concatenated) and
# sitemap.xml. Runs after gen_twins.
# Usage: python3 admin/build/gen_llms.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import re
import sys

from chrome import ROOT, Chrome, SITE_NAME, SITE_ONE_LINER, REPO_URL, LICENCE_NAME
from pages  import Site__Pages


LLMS_FILE      = ROOT / 'llms.txt'
LLMS_FULL_FILE = ROOT / 'llms-full.txt'
SITEMAP_FILE   = ROOT / 'sitemap.xml'
DOC_SECTIONS   = (('docs/design' , 'Design documents (the reasoning; the brief is the instruction)'),
                  ('docs/ops'    , 'Operations (what a human must do, and how a release works)'    ))
DOC_SKIP       = ('index.md',)                                                   # the twin of a generated index page
RE_MD_TITLE    = re.compile(r'^#\s+(.+?)\s*$', re.M)


class Gen__Llms:

    def __init__(self, check=False):
        self.check  = check
        self.chrome = Chrome()
        self.pages  = Site__Pages()

    def page_entries(self):
        entries = []
        for path in self.pages.html_files():
            page = self.pages.meta(path)
            if page['url'] == '/404.html' or page['source']:                     # rendered documents are listed under their own sections
                continue
            entries.append((self.chrome.twin_path(page['url']), page['title'], page['description'], page['url']))
        return sorted(entries, key=lambda e: (e[0] != '/index.md', e[0]))

    def doc_entries(self, folder):
        entries = []
        for path in sorted((ROOT / folder).glob('*.md')):
            if path.name in DOC_SKIP:
                continue
            text  = path.read_text(encoding='utf-8')
            title = RE_MD_TITLE.search(text)
            entries.append(('/' + path.relative_to(ROOT).as_posix(), title.group(1) if title else path.stem))
        return entries

    def header(self):
        return [f'# {SITE_NAME}'                                                                                           ,
                ''                                                                                                         ,
                f'> {SITE_ONE_LINER}'                                                                                      ,
                ''                                                                                                         ,
                f'Site version: v{self.chrome.version} ({self.chrome.released}). Content {LICENCE_NAME}, code Apache-2.0. '
                f'Source: {REPO_URL}'                                                                                      ,
                ''                                                                                                         ,
                'Every HTML page has a markdown twin at the same path with the extension swapped; links inside the '
                'markdown point at markdown, so an agent never has to parse HTML. What is shipped, proposed or absent is '
                'in /docs/reality.md, generated from data/features.json on every release: if it is not listed there, it '
                'does not exist. Nothing on this site is described in the present tense before that file says shipped.'   ,
                ''                                                                                                         ,
                'Notes for agents:'                                                                                        ,
                '- Everything in the repository is public and nothing in it is secret; a leak tripwire in the release '
                'gate scans every file.'                                                                                   ,
                '- The passkey RP ID is secrets.sgit.ai, never the apex sgit.ai.'                                           ,
                '- There is no server-side code: the browser does every cryptographic operation.'                           ,
                '- If your tooling cannot follow links, fetch /llms-full.txt: every page and document in one request.'      ]

    def llms_text(self):
        lines = self.header() + ['', '## Pages', '']
        for twin, title, description, _ in self.page_entries():
            lines.append(f'- [{title}]({twin}): {description}')
        for folder, label in DOC_SECTIONS:
            lines += ['', f'## {label}', '']
            for url, title in self.doc_entries(folder):
                lines.append(f'- [{title}]({url})')
        lines += ['', '## Reality', '', '- [What is built, by status](/docs/reality.md)', '']
        return '\n'.join(lines)

    def llms_full_text(self):
        parts = ['\n'.join(self.header()), '']
        sources = [(twin, ROOT / twin.lstrip('/')) for twin, _, _, _ in self.page_entries()]
        sources.append(('/docs/reality.md', ROOT / 'docs' / 'reality.md'))
        for folder, _ in DOC_SECTIONS:
            sources += [(url, ROOT / url.lstrip('/')) for url, _ in self.doc_entries(folder)]
        for url, path in sources:
            parts += ['', '=' * 78, f'source: {url}', '=' * 78, '', path.read_text(encoding='utf-8').rstrip(), '']
        return '\n'.join(parts) + '\n'

    def sitemap_xml(self):
        lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for _, _, _, url in self.page_entries():
            lines += ['  <url>', f'    <loc>{self.chrome.canonical_url(url)}</loc>', f'    <lastmod>{self.chrome.released}</lastmod>', '  </url>']
        lines.append('</urlset>')
        return '\n'.join(lines) + '\n'

    def run(self):
        changed = []
        for path, text in ((LLMS_FILE, self.llms_text()), (LLMS_FULL_FILE, self.llms_full_text()), (SITEMAP_FILE, self.sitemap_xml())):
            if self.pages.write_if_changed(path, text, self.check):
                changed.append(path.name)
        return changed


if __name__ == '__main__':
    check   = '--check' in sys.argv
    changed = Gen__Llms(check=check).run()
    verb    = 'stale' if check else 'updated'
    for name in changed:
        print(f'  index {verb}: {name}')
    if check and changed:
        print(f'gen_llms --check: {len(changed)} file(s) out of date; run python3 admin/build/gen_llms.py')
        sys.exit(1)
    print(f'gen_llms: {len(changed)} file(s) {verb}')
