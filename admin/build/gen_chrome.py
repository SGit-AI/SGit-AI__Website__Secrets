# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gen__Chrome
# Injects the chrome (head block, nav, footer) into every HTML page between the
# sg-secrets markers. `--check` fails when any page is not current.
# Usage: python3 admin/build/gen_chrome.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import sys

from chrome import Chrome
from pages  import Site__Pages


class Gen__Chrome:

    def __init__(self, check=False):
        self.check  = check
        self.chrome = Chrome()
        self.pages  = Site__Pages()

    def render(self, page):
        text        = page['path'].read_text(encoding='utf-8')
        text, head  = self.pages.replace_block(text, 'head'  , self.chrome.head(page['url'], page['title'], page['description']))
        text, nav   = self.pages.replace_block(text, 'nav'   , self.chrome.nav(page['url'], page['title']))
        text, foot  = self.pages.replace_block(text, 'footer', self.chrome.footer(page['url']))
        missing     = [name for name, found in (('head', head), ('nav', nav), ('footer', foot)) if not found]
        if missing:
            raise SystemExit(f'{page["path"].relative_to(self.pages.root)}: missing chrome markers for {", ".join(missing)}')
        return text

    def run(self):
        changed = []
        for path in self.pages.html_files():
            page = self.pages.meta(path)
            if self.pages.write_if_changed(path, self.render(page), self.check):
                changed.append(path.relative_to(self.pages.root).as_posix())
        return changed


if __name__ == '__main__':
    check   = '--check' in sys.argv
    changed = Gen__Chrome(check=check).run()
    verb    = 'stale' if check else 'updated'
    for name in changed:
        print(f'  chrome {verb}: {name}')
    if check and changed:
        print(f'gen_chrome --check: {len(changed)} page(s) out of date; run python3 admin/build/gen_chrome.py')
        sys.exit(1)
    print(f'gen_chrome: {len(changed)} page(s) {verb}')
