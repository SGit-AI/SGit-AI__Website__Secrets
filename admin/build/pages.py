# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Site__Pages
# Finds every HTML page that carries the chrome markers and reads what the
# generators need from it: url path, title, description, main content.
# ═══════════════════════════════════════════════════════════════════════════════

import html
import re

from pathlib import Path

from chrome import ROOT, MARKER_PREFIX


SKIP_DIRS      = {'.git', 'node_modules', '__pycache__', '.pytest_cache', 'vendor', '_site'}
RE_TITLE       = re.compile(r'<title>(.*?)</title>'                                        , re.S)
RE_DESCRIPTION = re.compile(r'<meta\s+name="description"\s+content="(.*?)"'                , re.S)
RE_MAIN        = re.compile(r'<main\b[^>]*>(.*?)</main>'                                   , re.S)
RE_H1          = re.compile(r'<h1\b[^>]*>(.*?)</h1>'                                       , re.S)


class Site__Pages:

    def __init__(self, root=ROOT):
        self.root = Path(root)

    def html_files(self):
        found = []
        for path in sorted(self.root.rglob('*.html')):
            if SKIP_DIRS & set(path.relative_to(self.root).parts):
                continue
            if self.marker('head', 'start') in path.read_text(encoding='utf-8'):
                found.append(path)
        return found

    def marker(self, block, edge):
        return f'<!-- {MARKER_PREFIX}:{block}:{edge} -->'

    def url_path(self, path):
        relative = path.relative_to(self.root).as_posix()
        if relative == 'index.html':
            return '/'
        if relative.endswith('/index.html'):
            return '/' + relative[:-len('index.html')]
        return '/' + relative

    def twin_file(self, path):
        return path.with_suffix('.md')

    def meta(self, path):
        text        = path.read_text(encoding='utf-8')
        title       = RE_TITLE.search(text)
        description = RE_DESCRIPTION.search(text)
        main        = RE_MAIN.search(text)
        if not title or not description or not main:
            raise SystemExit(f'{path.relative_to(self.root)}: needs <title>, <meta name="description"> and <main>')
        return {'path'        : path                                            ,
                'url'         : self.url_path(path)                             ,
                'title'       : html.unescape(title.group(1).strip())           ,
                'description' : html.unescape(description.group(1).strip())     ,
                'main'        : main.group(1)                                   }

    def replace_block(self, text, block, body):                                  # one block, no attributes: returns (new_text, found)
        return self.replace_blocks(text, block, lambda attrs: body)

    def replace_blocks(self, text, block, render):                               # every block of this kind; render(attrs) -> body
        pattern = re.compile(rf'(<!-- {MARKER_PREFIX}:{block}:start((?:\s+\w+="[^"]*")*)\s*-->)\n?.*?(?:\n([ \t]*))?(<!-- {MARKER_PREFIX}:{block}:end -->)', re.S)
        found   = [False]

        def swap(match):                                                          # keeps the end marker's own indentation
            found[0] = True
            attrs    = dict(re.findall(r'(\w+)="([^"]*)"', match.group(2)))
            return f'{match.group(1)}\n{render(attrs)}\n{match.group(3) or ""}{match.group(4)}'

        return pattern.sub(swap, text), found[0]

    def has_block(self, text, block):
        return re.search(rf'<!-- {MARKER_PREFIX}:{block}:start', text) is not None

    def write_if_changed(self, path, text, check):                               # returns True when the file is (or would be) changed
        current = path.read_text(encoding='utf-8') if path.exists() else None
        if current == text:
            return False
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding='utf-8')
        return True
