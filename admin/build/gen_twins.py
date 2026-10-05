# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gen__Twins
# Writes the markdown twin of every HTML page (index.html -> index.md) from the
# page's <main>, with a header that names the source and the site version.
# Usage: python3 admin/build/gen_twins.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import sys

from chrome     import Chrome
from html_to_md import Html__To__Markdown
from pages      import Site__Pages


class Gen__Twins:

    def __init__(self, check=False):
        self.check  = check
        self.chrome = Chrome()
        self.pages  = Site__Pages()

    def render(self, page):
        canonical = self.chrome.canonical_url(page['url'])
        body      = Html__To__Markdown.convert(page['main'])
        if body.startswith('# '):                                                # the page's own h1 stays; do not add a second
            heading, _, body = body.partition('\n')
        else:
            heading = f'# {page["title"]}'
        return '\n'.join([heading                                                                                           ,
                          ''                                                                                                ,
                          f'> {page["description"]}'                                                                        ,
                          ''                                                                                                ,
                          f'*Source: <{canonical}> · site v{self.chrome.version} ({self.chrome.released}) · this file is '
                          f'generated from the same content as the page, so the two cannot drift. Every page on this site '
                          f'has a `.md` twin; internal links below point at them.*'                                        ,
                          ''                                                                                                ,
                          '---'                                                                                             ,
                          ''                                                                                                ,
                          body.strip()                                                                                      ,
                          ''                                                                                                ,
                          '---'                                                                                             ,
                          ''                                                                                                ,
                          f'*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · '
                          f'[HTML version]({canonical})*'                                                                   ,
                          ''                                                                                                ])

    def run(self):
        changed = []
        for path in self.pages.html_files():
            page = self.pages.meta(path)
            twin = self.pages.twin_file(path)
            if self.pages.write_if_changed(twin, self.render(page), self.check):
                changed.append(twin.relative_to(self.pages.root).as_posix())
        return changed


if __name__ == '__main__':
    check   = '--check' in sys.argv
    changed = Gen__Twins(check=check).run()
    verb    = 'stale' if check else 'updated'
    for name in changed:
        print(f'  twin {verb}: {name}')
    if check and changed:
        print(f'gen_twins --check: {len(changed)} twin(s) out of date; run python3 admin/build/gen_twins.py')
        sys.exit(1)
    print(f'gen_twins: {len(changed)} twin(s) {verb}')
