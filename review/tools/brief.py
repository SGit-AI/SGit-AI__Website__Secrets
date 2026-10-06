# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Brief
# Splits the MVP brief into the review folder's own pieces: one JSON file per
# top-level section under review/brief/sections/ (fourteen files, not one per
# heading), each holding its subsections as markdown and as the same HTML the
# rendered page shows, plus the intent nodes written from each subsection; and
# review/brief/index.json, the table of contents. The navigator shows a section
# in place (review-brief) so a reader following a claim to the brief never
# leaves it. The markdown stays the source; this is derived and checked.
# Usage: python3 review/tools/brief.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import hashlib
import re
import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'admin' / 'build'))

from review_tree import ROOT, REVIEW, Review__Tree                                # noqa: E402
from md_to_html  import Markdown__To__Html                                        # noqa: E402


DOC        = 'docs/design/secrets-sgit-ai__mvp-build-brief.md'
TARGET     = REVIEW / 'brief'
RE_HEADING = re.compile(r'^(#{2,3})\s+(\d+(?:\.\d+)*)\.?\s+(.+?)\s*$')
INTENT     = ('stories', 'flows', 'components', 'deploy')


class Brief:

    def __init__(self, check=False):
        self.check    = check
        self.tree     = Review__Tree()
        self.renderer = Markdown__To__Html(self.rewrite_link)
        self.page     = '/' + DOC[:-3] + '.html'

    def rewrite_link(self, href):                                                 # the brief's relative links point at the repository; make them absolute to the site
        if href.startswith(('http://', 'https://', '/', '#', 'mailto:')):
            return href
        return '/' + href.replace('.md', '.html') if href.endswith('.md') else '/' + href

    def nodes_by_section(self):                                                   # every intent node, keyed by the brief section it came from
        found = {}
        def walk(item, layer):
            if isinstance(item, dict):
                source = item.get('source') or {}
                if isinstance(item.get('id'), str) and ('name' in item or 'text' in item) and source.get('section'):
                    found.setdefault(source['section'], []).append({'id': item['id'], 'name': item.get('name') or item.get('text', '')[:80], 'layer': layer})
                for key, value in item.items():
                    walk(value, key if key in ('rules', 'examples', 'steps') else layer)
            elif isinstance(item, list):
                for value in item:
                    walk(value, layer)
        for name in INTENT:
            path = REVIEW / 'intent' / f'{name}.json'
            if path.exists():
                walk(self.tree.read_json(path), name)
        return found

    def split(self):                                                              # -> [section]; a section is a top-level heading with its subsections
        text     = (ROOT / DOC).read_text(encoding='utf-8')
        sections = []
        current  = None
        sub      = None
        for line in text.splitlines():
            match = RE_HEADING.match(line) if line.startswith('#') else None
            if match and match.group(1) == '##':
                current = {'id': match.group(2), 'title': f'{match.group(2)}. {match.group(3)}', 'heading': re.sub(r'^#+\s+', '', line).strip(), 'lines': [], 'subsections': []}
                sections.append(current)
                sub = None
            elif match and match.group(1) == '###' and current:
                sub = {'id': match.group(2), 'title': f'{match.group(2)} {match.group(3)}', 'heading': re.sub(r'^#+\s+', '', line).strip(), 'lines': []}
                current['subsections'].append(sub)
            elif current:
                (sub['lines'] if sub else current['lines']).append(line)
        return sections

    def render(self, sections):
        nodes    = self.nodes_by_section()
        doc_hash = hashlib.sha256((ROOT / DOC).read_bytes()).hexdigest()
        files    = {}
        index    = []
        for section in sections:
            renderer = Markdown__To__Html(self.rewrite_link)
            anchor   = renderer.slug(section['heading'])
            subs     = []
            for sub in section['subsections']:
                markdown = '\n'.join(sub['lines']).strip() + '\n'
                subs.append({'id': sub['id'], 'title': sub['title'], 'anchor': renderer.slug(sub['heading']),
                             'markdown': markdown, 'html': renderer.render(markdown).strip(), 'nodes': nodes.get(sub['id'], [])})
            markdown = '\n'.join(section['lines']).strip() + '\n'
            number   = section['id'].zfill(2)
            data = {'id': section['id'], 'title': section['title'], 'anchor': anchor, 'doc': DOC, 'page': self.page,
                    'markdown': markdown, 'html': renderer.render(markdown).strip(), 'nodes': nodes.get(section['id'], []),
                    'subsections': subs,
                    'provenance': {'tool': 'review/tools/brief.py', 'doc_sha256': doc_hash}}
            files[f'sections/{number}.json'] = data
            index.append({'id': section['id'], 'title': section['title'], 'anchor': anchor, 'file': f'sections/{number}.json',
                          'subsections': [{'id': s['id'], 'title': s['title'], 'anchor': s['anchor'], 'nodes': len(s['nodes'])} for s in subs],
                          'nodes': len(data['nodes']) + sum(len(s['nodes']) for s in subs)})
        files['index.json'] = {'doc': DOC, 'page': self.page, 'sections': index, 'provenance': {'tool': 'review/tools/brief.py', 'doc_sha256': doc_hash}}
        return files

    def run(self):
        files   = self.render(self.split())
        changed = []
        (TARGET / 'sections').mkdir(parents=True, exist_ok=True)
        for relative, data in files.items():
            if self.tree.write_json(TARGET / relative, data, check=self.check):
                changed.append(relative)
        stale = sorted(p.relative_to(TARGET).as_posix() for p in (TARGET / 'sections').glob('*.json') if f'sections/{p.name}' not in files)
        if self.check and (changed or stale):
            print(f'brief --check: {len(changed)} file(s) out of date, {len(stale)} stale; run python3 review/tools/brief.py')
            return 1
        for relative in stale:
            (TARGET / relative).unlink()
        print(f'brief: {len(files) - 1} sections, {sum(len(s["subsections"]) for s in files["index.json"]["sections"])} subsections{" (updated " + str(len(changed)) + ")" if changed else " (current)"}')
        return 0


if __name__ == '__main__':
    sys.exit(Brief(check='--check' in sys.argv).run())
