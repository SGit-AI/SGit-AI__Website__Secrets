# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Html__To__Markdown
# Converts the <main> of a page into its markdown twin. Handles the elements the
# site uses (headings, paragraphs, lists, tables, links, code, emphasis) and
# rewrites internal .html links to their .md twins so an agent never parses HTML.
# ═══════════════════════════════════════════════════════════════════════════════

import re

from html.parser import HTMLParser


BLOCK_TAGS   = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'pre',
                'blockquote', 'hr', 'section', 'article', 'div', 'dl', 'dt', 'dd', 'figure', 'figcaption'}
SKIP_TAGS    = {'script', 'style', 'template', 'svg'}
RE_SPACE     = re.compile(r'[ \t\r\n]+')
RE_BLANKS    = re.compile(r'\n{3,}')


class Html__To__Markdown(HTMLParser):

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out         = []
        self.list_stack  = []                                                   # ('ul'|'ol', counter)
        self.link_href   = None
        self.in_pre      = False
        self.in_code     = False
        self.skip_depth  = 0
        self.table       = None                                                 # list of rows while inside <table>
        self.row         = None
        self.cell        = None
        self.cell_header = False

    @staticmethod
    def twin_href(href):
        if re.match(r'^[a-z][a-z0-9+.-]*:', href) and not href.startswith('/'):  # http:, mailto:, data: stay as they are
            return href
        base, _, fragment = href.partition('#')
        if base.endswith('.html'):
            base = base[:-len('.html')] + '.md'
        elif base.endswith('/'):
            base = base + 'index.md'
        return base + ('#' + fragment if fragment else '')

    def emit(self, text):
        if self.cell is not None:
            self.cell.append(text)
        else:
            self.out.append(text)

    def newline(self, count=1):
        if self.cell is not None:
            return
        joined = ''.join(self.out)
        trailing = len(joined) - len(joined.rstrip('\n'))
        if trailing < count:
            self.out.append('\n' * (count - trailing))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.skip_depth or tag in SKIP_TAGS:
            self.skip_depth += 1
            return
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self.newline(2)
            self.emit('#' * int(tag[1]) + ' ')
        elif tag == 'p':
            self.newline(2)
        elif tag == 'br':
            self.emit('  \n')
        elif tag == 'hr':
            self.newline(2)
            self.emit('---')
            self.newline(2)
        elif tag in ('ul', 'ol'):
            self.newline(2 if not self.list_stack else 1)
            self.list_stack.append([tag, 0])
        elif tag == 'li':
            kind, count = self.list_stack[-1] if self.list_stack else ('ul', 0)
            if self.list_stack:
                self.list_stack[-1][1] += 1
                count = self.list_stack[-1][1]
            self.newline(1)
            indent = '  ' * (len(self.list_stack) - 1)
            self.emit(indent + (f'{count}. ' if kind == 'ol' else '- '))
        elif tag == 'a':
            self.link_href = attrs.get('href')
            if self.link_href:
                self.emit('[')
        elif tag in ('strong', 'b'):
            self.emit('**')
        elif tag in ('em', 'i'):
            self.emit('*')
        elif tag == 'code':
            if not self.in_pre:
                self.emit('`')
                self.in_code = True
        elif tag == 'pre':
            self.newline(2)
            self.emit('```\n')
            self.in_pre = True
        elif tag == 'blockquote':
            self.newline(2)
            self.emit('> ')
        elif tag == 'table':
            self.newline(2)
            self.table = []
        elif tag == 'tr':
            self.row = []
        elif tag in ('th', 'td'):
            self.cell        = []
            self.cell_header = tag == 'th'
        elif tag == 'img':
            self.emit(f'![{attrs.get("alt", "")}]({attrs.get("src", "")})')
        elif tag in ('dt',):
            self.newline(1)
            self.emit('**')
        elif tag in ('dd',):
            self.newline(1)
            self.emit(': ')
        elif tag in BLOCK_TAGS:
            self.newline(1)

    def handle_endtag(self, tag):
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote'):
            self.newline(2)
        elif tag in ('ul', 'ol'):
            if self.list_stack:
                self.list_stack.pop()
            self.newline(2 if not self.list_stack else 1)
        elif tag == 'li':
            self.newline(1)
        elif tag == 'a':
            if self.link_href:
                self.emit(f']({self.twin_href(self.link_href)})')
            self.link_href = None
        elif tag in ('strong', 'b'):
            self.emit('**')
        elif tag in ('em', 'i'):
            self.emit('*')
        elif tag == 'code':
            if self.in_code:
                self.emit('`')
                self.in_code = False
        elif tag == 'pre':
            self.in_pre = False
            self.emit('\n```')
            self.newline(2)
        elif tag in ('th', 'td'):
            text = RE_SPACE.sub(' ', ''.join(self.cell)).strip().replace('|', '\\|')
            self.row.append((self.cell_header, text))
            self.cell = None
        elif tag == 'tr':
            if self.row is not None and self.table is not None:
                self.table.append(self.row)
            self.row = None
        elif tag == 'table':
            self.emit_table()
            self.table = None
        elif tag == 'dt':
            self.emit('**')
        elif tag in BLOCK_TAGS:
            self.newline(1)

    def emit_table(self):
        rows = [row for row in self.table if row]
        if not rows:
            return
        width = max(len(row) for row in rows)
        lines = []
        for index, row in enumerate(rows):
            cells = [text for _, text in row] + [''] * (width - len(row))
            lines.append('| ' + ' | '.join(cells) + ' |')
            if index == 0:
                lines.append('|' + '---|' * width)
        self.out.append('\n'.join(lines))
        self.newline(2)

    def handle_data(self, data):
        if self.skip_depth:
            return
        if self.in_pre:
            self.emit(data)
            return
        text = RE_SPACE.sub(' ', data)
        if self.cell is None and (not self.out or ''.join(self.out).endswith('\n')):
            text = text.lstrip()
        if text:
            self.emit(text)

    def markdown(self):
        text = ''.join(self.out)
        text = '\n'.join(line.rstrip() for line in text.split('\n'))
        text = RE_BLANKS.sub('\n\n', text)
        return text.strip() + '\n'

    @classmethod
    def convert(cls, fragment):
        parser = cls()
        parser.feed(fragment)
        parser.close()
        return parser.markdown()
