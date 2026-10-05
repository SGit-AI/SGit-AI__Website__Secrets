# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Markdown__To__Html
# Renders the markdown the site carries (the design documents, the ops notes,
# reality.md) to an HTML fragment: headings with GitHub-style ids, paragraphs,
# nested lists, task lists, tables, fenced code, blockquotes, rules, links,
# images, emphasis and inline code. Standard library only; no extensions.
# ═══════════════════════════════════════════════════════════════════════════════

import html
import re


RE_HEADING   = re.compile(r'^(#{1,6})\s+(.+?)\s*#*\s*$')
RE_FENCE     = re.compile(r'^(`{3,}|~{3,})\s*(\w+)?\s*$')
RE_HR        = re.compile(r'^(?:-{3,}|\*{3,}|_{3,})\s*$')
RE_LIST      = re.compile(r'^(\s*)([-*+]|\d+[.)])\s+(.*)$')
RE_TABLE_SEP = re.compile(r'^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$')
RE_TASK      = re.compile(r'^\[([ xX])\]\s+')
RE_INLINE    = re.compile(r'(`[^`]+`)|(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\))|(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(?!\s)(.+?)(?<!\s)\*)|(_(?!\s)([^_]+?)(?<!\s)_)|(<(https?://[^>\s]+)>)')


class Markdown__To__Html:

    def __init__(self, link_rewriter=None):
        self.link_rewriter = link_rewriter or (lambda href: href)
        self.ids           = {}

    # ── inline ────────────────────────────────────────────────────────────────

    def inline(self, text):
        out = []
        pos = 0
        for match in RE_INLINE.finditer(text):
            out.append(html.escape(text[pos:match.start()]))
            if match.group(1):
                out.append(f'<code>{html.escape(match.group(1)[1:-1])}</code>')
            elif match.group(2):
                out.append(f'<img src="{html.escape(self.link_rewriter(match.group(4)))}" alt="{html.escape(match.group(3))}">')
            elif match.group(5):
                out.append(f'<a href="{html.escape(self.link_rewriter(match.group(7)))}">{self.inline(match.group(6))}</a>')
            elif match.group(8):
                out.append(f'<strong>{self.inline(match.group(9))}</strong>')
            elif match.group(10):
                out.append(f'<strong>{self.inline(match.group(11))}</strong>')
            elif match.group(12):
                out.append(f'<em>{self.inline(match.group(13))}</em>')
            elif match.group(14):
                out.append(f'<em>{self.inline(match.group(15))}</em>')
            elif match.group(16):
                out.append(f'<a href="{html.escape(match.group(17))}">{html.escape(match.group(17))}</a>')
            pos = match.end()
        out.append(html.escape(text[pos:]))
        return ''.join(out)

    def slug(self, heading):
        base = re.sub(r'\s+', '-', re.sub(r'[^\w\s-]', '', re.sub(r'`|\*', '', heading).lower(), flags=re.U).strip())   # GitHub keeps _ and -
        count = self.ids.get(base, 0)
        self.ids[base] = count + 1
        return base if count == 0 else f'{base}-{count}'

    # ── blocks ────────────────────────────────────────────────────────────────

    def render(self, markdown):
        self.ids = {}
        lines    = markdown.replace('\r\n', '\n').split('\n')
        out      = []
        i        = 0
        while i < len(lines):
            line = lines[i]
            if not line.strip():
                i += 1
                continue
            fence = RE_FENCE.match(line)
            if fence:
                i, block = self.code_block(lines, i, fence)
                out.append(block)
                continue
            heading = RE_HEADING.match(line)
            if heading:
                level, text = len(heading.group(1)), heading.group(2)
                out.append(f'<h{level} id="{self.slug(text)}">{self.inline(text)}</h{level}>')
                i += 1
                continue
            if RE_HR.match(line):
                out.append('<hr>')
                i += 1
                continue
            if line.lstrip().startswith('>'):
                i, block = self.blockquote(lines, i)
                out.append(block)
                continue
            if '|' in line and i + 1 < len(lines) and RE_TABLE_SEP.match(lines[i + 1]):
                i, block = self.table(lines, i)
                out.append(block)
                continue
            if RE_LIST.match(line):
                i, block = self.list_block(lines, i)
                out.append(block)
                continue
            i, block = self.paragraph(lines, i)
            out.append(block)
        return '\n'.join(out) + '\n'

    def code_block(self, lines, i, fence):
        marker, lang = fence.group(1), fence.group(2)
        body = []
        i += 1
        while i < len(lines) and not lines[i].startswith(marker[0] * 3):
            body.append(lines[i])
            i += 1
        cls = f' class="language-{html.escape(lang)}"' if lang else ''
        return i + 1, f'<pre><code{cls}>{html.escape(chr(10).join(body))}</code></pre>'

    def blockquote(self, lines, i):
        inner = []
        while i < len(lines) and lines[i].lstrip().startswith('>'):
            inner.append(lines[i].lstrip()[1:].lstrip())
            i += 1
        return i, f'<blockquote>\n{Markdown__To__Html(self.link_rewriter).render(chr(10).join(inner)).strip()}\n</blockquote>'

    def paragraph(self, lines, i):
        body = []
        while i < len(lines) and lines[i].strip() and not (RE_HEADING.match(lines[i]) or RE_FENCE.match(lines[i]) or RE_HR.match(lines[i])
                                                           or RE_LIST.match(lines[i]) or lines[i].lstrip().startswith('>')
                                                           or ('|' in lines[i] and i + 1 < len(lines) and RE_TABLE_SEP.match(lines[i + 1]))):
            body.append(lines[i].strip())
            i += 1
        return i, f'<p>{self.inline(" ".join(body))}</p>'

    def table(self, lines, i):
        def cells(row):
            row = row.strip()
            if row.startswith('|'): row = row[1:]
            if row.endswith('|'):   row = row[:-1]
            return [c.strip() for c in re.split(r'(?<!\\)\|', row)]
        header = cells(lines[i])
        aligns = []
        for spec in cells(lines[i + 1]):
            aligns.append('right' if spec.endswith(':') and not spec.startswith(':') else 'center' if spec.startswith(':') and spec.endswith(':') else None)
        i += 2
        rows = []
        while i < len(lines) and lines[i].strip() and '|' in lines[i]:
            rows.append(cells(lines[i]))
            i += 1
        def cell(tag, index, text):
            align = f' align="{aligns[index]}"' if index < len(aligns) and aligns[index] else ''
            return f'<{tag}{align}>{self.inline(text.replace(chr(92) + "|", "|"))}</{tag}>'
        out = ['<table>', '<thead><tr>' + ''.join(cell('th', n, c) for n, c in enumerate(header)) + '</tr></thead>', '<tbody>']
        for row in rows:
            out.append('<tr>' + ''.join(cell('td', n, c) for n, c in enumerate(row)) + '</tr>')
        out += ['</tbody>', '</table>']
        return i, '\n'.join(out)

    def list_block(self, lines, i):
        items = []                                                                # [(indent, ordered, text_lines)]
        while i < len(lines):
            match = RE_LIST.match(lines[i])
            if match:
                items.append([len(match.group(1).expandtabs(4)), match.group(2)[0].isdigit(), [match.group(3)], match.group(2)])
                i += 1
            elif lines[i].strip() and items and (lines[i].startswith(' ') or lines[i].startswith('\t')):
                items[-1][2].append(lines[i].strip())                             # continuation line of the previous item
                i += 1
            elif not lines[i].strip() and i + 1 < len(lines) and RE_LIST.match(lines[i + 1]) and items:
                after = RE_LIST.match(lines[i + 1])
                if not after.group(1) and after.group(2)[0].isdigit() != items[0][1]:
                    break                                                         # a blank line then the other kind of list: a new list
                i += 1                                                            # a blank line between items keeps the list going
            else:
                break
        return i, self.render_items(items, 0)[0]

    def render_items(self, items, index):
        indent  = items[index][0]
        ordered = items[index][1]
        first   = int(items[index][3][:-1]) if ordered else 1
        out     = [f'<ol start="{first}">' if ordered and first != 1 else f'<{"ol" if ordered else "ul"}>']
        while index < len(items) and items[index][0] >= indent:
            if items[index][0] > indent:
                nested, index = self.render_items(items, index)
                out[-1] = out[-1][:-len('</li>')] + '\n' + nested + '</li>'
                continue
            text = ' '.join(items[index][2])
            task = RE_TASK.match(text)
            if task:
                box  = '☑' if task.group(1).lower() == 'x' else '☐'
                text = f'{box} {text[task.end():]}'
            out.append(f'<li>{self.inline(text)}</li>')
            index += 1
        out.append(f'</{"ol" if ordered else "ul"}>')
        return '\n'.join(out), index
