# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gen__Diagrams
# Draws the flow diagrams from data/diagrams/<id>.json into the pages that carry
# a <!-- sg-secrets:diagram:start id="<id>" --> block: an inline SVG that uses
# the site's colour tokens (so it follows the theme), the same diagram as text
# in a <pre> (what the markdown twin and llms.txt carry; what a reader can copy),
# and a caption. Two shapes: `sequence` (lanes across, steps down, arrows
# between lanes, notes on a lane) and `chain` (boxes in rows and columns with
# labelled arrows between them, for a key hierarchy). No library, no script on
# the page, nothing fetched at runtime. `--check` fails on drift.
# Usage: python3 admin/build/gen_diagrams.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import html
import json
import sys
import textwrap

from chrome import ROOT
from pages  import Site__Pages


DIAGRAMS = ROOT / 'data' / 'diagrams'
FILLS    = {'secret' : ('var(--sg-danger-subtle)', 'var(--sg-danger)'),
            'public' : ('var(--sg-accent-subtle)', 'var(--sg-accent)'),
            'derived': ('var(--sg-bg-surface)'   , 'var(--sg-border)'),
            'note'   : ('var(--sg-bg-secondary)' , 'var(--sg-border)')}
CHAR_W   = 6.6                                                                   # an estimate of a 12px character, for wrapping


def esc(text):
    return html.escape(text, quote=True)


def wrap(text, width):
    lines = []
    for part in text.split('\n'):
        lines += textwrap.wrap(part, width) or ['']
    return lines


class Gen__Diagrams:

    def __init__(self, check=False):
        self.check    = check
        self.pages    = Site__Pages()
        self.diagrams = {}
        for path in sorted(DIAGRAMS.glob('*.json')):
            data = json.loads(path.read_text(encoding='utf-8'))
            if data.get('id') != path.stem:
                raise SystemExit(f'{path.relative_to(ROOT)}: id must be {path.stem}')
            self.diagrams[path.stem] = data

    # ── sequence ──────────────────────────────────────────────────────────────

    def sequence_svg(self, d):
        lanes  = d['lanes']
        lw     = 190
        pad    = 8
        top    = 50
        width  = pad * 2 + lw * len(lanes)
        x      = {lane['id']: pad + lw * i + lw / 2 for i, lane in enumerate(lanes)}
        rows   = []                                                               # (y, svg) collected with a running height
        y      = top + 12
        out    = []
        for step in d['steps']:
            if 'note' in step:
                lines = wrap(step['text'], int((lw - 24) / CHAR_W))
                h     = 14 * len(lines) + 12
                fill, stroke = FILLS[step.get('style', 'note')]
                cx    = x[step['note']]
                out.append(f'<rect x="{cx - lw / 2 + 10:.0f}" y="{y}" width="{lw - 20}" height="{h}" rx="4" fill="{fill}" stroke="{stroke}"/>')
                for i, line in enumerate(lines):
                    out.append(f'<text x="{cx:.0f}" y="{y + 14 + 14 * i}" text-anchor="middle" font-size="11" fill="var(--sg-text)">{esc(line)}</text>')
                y += h + 10
                continue
            x1, x2 = x[step['from']], x[step['to']]
            secret = step.get('style') == 'secret'
            colour = 'var(--sg-danger)' if secret else 'var(--sg-accent)'
            span   = abs(x2 - x1) if x1 != x2 else lw
            lines  = wrap(step['text'], max(12, int((span - 16) / CHAR_W)))
            ty     = y
            for i, line in enumerate(lines):
                out.append(f'<text x="{(x1 + x2) / 2:.0f}" y="{ty + 11 + 13 * i}" text-anchor="middle" font-size="11" fill="var(--sg-text-heading)">{esc(line)}</text>')
            ly = ty + 13 * len(lines) + 6
            if x1 == x2:                                                          # a step to itself: a small loop
                out.append(f'<path d="M{x1:.0f},{ly} h40 v16 h-34" fill="none" stroke="{colour}" stroke-width="1.5" marker-end="url(#{d["id"]}-arrow{"-s" if secret else ""})"/>')
                ly += 16
            else:
                dash = ' stroke-dasharray="5 3"' if secret else ''
                out.append(f'<line x1="{x1:.0f}" y1="{ly}" x2="{x2 + (-7 if x2 > x1 else 7):.0f}" y2="{ly}" stroke="{colour}" stroke-width="1.5"{dash} marker-end="url(#{d["id"]}-arrow{"-s" if secret else ""})"/>')
            y = ly + 16
        height = y + 8
        lane_svg = []
        for lane in lanes:
            cx    = x[lane['id']]
            lines = wrap(lane['label'], 24)[:2]
            lane_svg.append(f'<rect x="{cx - lw / 2 + 6:.0f}" y="6" width="{lw - 12}" height="36" rx="6" fill="var(--sg-accent-subtle)" stroke="var(--sg-accent)"/>')
            for i, line in enumerate(lines):
                ty = 28 if len(lines) == 1 else 21 + 13 * i
                lane_svg.append(f'<text x="{cx:.0f}" y="{ty}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--sg-text-heading)">{esc(line)}</text>')
            lane_svg.append(f'<line x1="{cx:.0f}" y1="42" x2="{cx:.0f}" y2="{height - 4}" stroke="var(--sg-border)" stroke-dasharray="3 4"/>')
        defs = (f'<defs><marker id="{d["id"]}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sg-accent)"/></marker>'
                f'<marker id="{d["id"]}-arrow-s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sg-danger)"/></marker></defs>')
        body = '\n      '.join([defs] + lane_svg + out)
        return width, height, body

    def sequence_text(self, d):
        lanes = d['lanes']
        cw    = 24
        n     = len(lanes)
        col   = {lane['id']: i for i, lane in enumerate(lanes)}
        width = cw * n
        rows  = [''.join(lane['label'][:cw - 2].ljust(cw) for lane in lanes)]

        def blank():
            row = [' '] * width
            for i in range(n):
                row[i * cw + 1] = '│'
            return row

        def put(row, x, text):
            for i, ch in enumerate(text):
                if 0 <= x + i < width:
                    row[x + i] = ch

        for step in d['steps']:
            if 'note' in step:
                c = col[step['note']]
                for line in wrap(step['text'], width - c * cw - 6):
                    row = blank()
                    put(row, c * cw + 3, '┆ ' + line)
                    rows.append(''.join(row))
                rows.append(''.join(blank()))
                continue
            a, b = col[step['from']], col[step['to']]
            lo   = min(a, b)
            label = ('🔒 ' if step.get('style') == 'secret' else '') + step['text']
            for line in wrap(label, width - lo * cw - 6):
                row = blank()
                put(row, lo * cw + 3, line)
                rows.append(''.join(row))
            row = blank()
            if a == b:
                put(row, a * cw + 2, '──┐')
            else:
                x1, x2 = a * cw + 1, b * cw + 1
                if x2 > x1:
                    put(row, x1 + 1, '─' * (x2 - x1 - 2) + '▶')
                else:
                    put(row, x2 + 1, '◀' + '─' * (x1 - x2 - 2))
            rows.append(''.join(row))
            rows.append(''.join(blank()))
        return '\n'.join(r.rstrip() for r in rows)

    # ── chain ─────────────────────────────────────────────────────────────────

    def chain_svg(self, d):
        cols   = {'left': 0, 'centre': 1, 'right': 2}
        bw, bh = 270, 60
        gx, gy = 36, 72
        width  = 3 * bw + 2 * gx + 16
        rows   = max(item['row'] for item in d['items']) + 1
        height = rows * (bh + gy) - gy + 16
        pos    = {}
        out    = []
        for item in d['items']:
            cx = 8 + cols[item.get('col', 'centre')] * (bw + gx) + bw / 2
            cy = 8 + item['row'] * (bh + gy) + bh / 2
            pos[item['id']] = (cx, cy)
            fill, stroke = FILLS[item.get('kind', 'derived')]
            out.append(f'<rect x="{cx - bw / 2:.0f}" y="{cy - bh / 2:.0f}" width="{bw}" height="{bh}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
            details = wrap(item['detail'], 44)[:2] if item.get('detail') else []
            ly      = cy - 6 if details else cy + 4
            out.append(f'<text x="{cx:.0f}" y="{ly:.0f}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--sg-text-heading)">{esc(item["label"])}</text>')
            for i, line in enumerate(details):
                out.append(f'<text x="{cx:.0f}" y="{cy + 8 + 12 * i:.0f}" text-anchor="middle" font-size="10" fill="var(--sg-text-muted)">{esc(line)}</text>')
        for link in d['links']:
            (x1, y1), (x2, y2) = pos[link['from']], pos[link['to']]
            sy = y1 + bh / 2
            ey = y2 - bh / 2 - 7
            if x1 == x2:
                path = f'M{x1:.0f},{sy:.0f} L{x2:.0f},{ey:.0f}'
                right = x1 > width / 2
                tx, ty, anchor = (x1 - 8 if right else x1 + 8), (sy + ey) / 2 - 2, ('end' if right else 'start')
            else:
                my   = (sy + ey) / 2
                path = f'M{x1:.0f},{sy:.0f} L{x1:.0f},{my:.0f} L{x2:.0f},{my:.0f} L{x2:.0f},{ey:.0f}'
                tx, ty, anchor = (x1 + x2) / 2, my - 6, 'middle'
            out.append(f'<path d="{path}" fill="none" stroke="var(--sg-accent)" stroke-width="1.5" marker-end="url(#{d["id"]}-arrow)"/>')
            for i, line in enumerate(wrap(link['text'], 38)):
                out.append(f'<text x="{tx:.0f}" y="{ty + 12 * i:.0f}" text-anchor="{anchor}" font-size="10.5" fill="var(--sg-text)">{esc(line)}</text>')
        defs = f'<defs><marker id="{d["id"]}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--sg-accent)"/></marker></defs>'
        return width, height, '\n      '.join([defs] + out)

    def chain_text(self, d):
        lines = []
        by_row = {}
        for item in d['items']:
            by_row.setdefault(item['row'], []).append(item)
        links_from = {}
        for link in d['links']:
            links_from.setdefault(link['from'], []).append(link)
        for row in sorted(by_row):
            for item in sorted(by_row[row], key=lambda i: i.get('col', 'centre')):
                tag = {'secret': 'secret', 'public': 'public', 'derived': 'derived'}.get(item.get('kind', 'derived'), '')
                lines.append(f'┌─ {item["label"]} ─ ({tag}) ─┐')
                if item.get('detail'):
                    lines.append(f'│  {item["detail"]}')
                lines.append('└' + '─' * (len(item['label']) + len(tag) + 8) + '┘')
                for link in links_from.get(item['id'], []):
                    lines.append(f'     │  {link["text"]}')
                    lines.append(f'     ▼  → {link["to"]}')
            lines.append('')
        return '\n'.join(lines).rstrip()

    # ── the figure ────────────────────────────────────────────────────────────

    def figure(self, attrs):
        d = self.diagrams.get(attrs.get('id', ''))
        if not d:
            raise SystemExit(f'diagram block names {attrs.get("id")!r}, which is not in data/diagrams/')
        if d['kind'] == 'sequence':
            width, height, body = self.sequence_svg(d)
            text = self.sequence_text(d)
        elif d['kind'] == 'chain':
            width, height, body = self.chain_svg(d)
            text = self.chain_text(d)
        else:
            raise SystemExit(f'{d["id"]}: unknown kind {d["kind"]}')
        return '\n'.join([
            f'  <figure class="sg-diagram" id="diagram-{d["id"]}" data-generated-from="data/diagrams/{d["id"]}.json">',
            f'    <svg viewBox="0 0 {width:.0f} {height:.0f}" width="{width:.0f}" role="img" aria-labelledby="diagram-{d["id"]}-title">',
            f'      <title id="diagram-{d["id"]}-title">{esc(d["title"])}</title>',
            f'      {body}',
            f'    </svg>',
            f'    <details class="sg-diagram-text"><summary>The same diagram as text</summary><pre>{html.escape(text)}</pre></details>',
            f'    <figcaption>{d["caption"]}</figcaption>',
            f'  </figure>'])

    def run(self):
        changed = []
        for path in self.pages.html_files():
            text = path.read_text(encoding='utf-8')
            if not self.pages.has_block(text, 'diagram'):
                continue
            new, _ = self.pages.replace_blocks(text, 'diagram', self.figure)
            if new != text and self.pages.write_if_changed(path, new, self.check):
                changed.append(path)
        return changed


if __name__ == '__main__':
    check   = '--check' in sys.argv
    changed = Gen__Diagrams(check=check).run()
    verb    = 'stale' if check else 'updated'
    print(f'gen_diagrams: {len(changed)} page(s) {verb}')
    if check and changed:
        print(f'gen_diagrams --check: {len(changed)} page(s) out of date; run python3 admin/build/gen_diagrams.py')
        sys.exit(1)
