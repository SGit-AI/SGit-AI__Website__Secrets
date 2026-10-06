# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gen__Terms
# The glossary, data/terms.json, applied to the pages. On every page whose
# <main> carries data-terms, the first occurrence of each term (or one of its
# aliases) in running text becomes <a class="sg-term" href="…" title="…">, the
# title being the definition, so a reader can hover or follow; text already in
# a link, in code, in a heading or in a generated block is left alone, and a
# page never links to itself. On /learn/ the <!-- sg-secrets:terms:start -->
# block becomes the glossary. Idempotent: existing term links are unwrapped
# before the pass. `--check` fails on drift.
# Usage: python3 admin/build/gen_terms.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import html
import json
import re
import sys

from chrome import ROOT, MARKER_PREFIX
from pages  import Site__Pages


TERMS_FILE  = ROOT / 'data' / 'terms.json'
RE_MAIN     = re.compile(r'(<main\b[^>]*\bdata-terms\b[^>]*>)(.*?)(</main>)', re.S)
RE_TOKEN    = re.compile(r'(<!--.*?-->|<[^>]+>)|([^<]+)', re.S)
RE_TERMLINK = re.compile(r'<a class="sg-term" href="[^"]*" title="[^"<>]*">([^<]*)</a>')             # the innermost link; unwrapping repeats to a fixpoint
SKIP_TAGS   = ('a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'svg', 'script', 'style', 'figure', 'summary', 'kbd', 'button', 'label', 'dt')
RE_TAG      = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9-]*)')
RE_BLOCK    = re.compile(rf'<!-- {MARKER_PREFIX}:[a-z-]+:(start|end)')


class Gen__Terms:

    def __init__(self, check=False):
        self.check = check
        self.pages = Site__Pages()
        self.terms = json.loads(TERMS_FILE.read_text(encoding='utf-8'))['terms']
        self.validate()
        self.patterns = [(term, self.pattern(term)) for term in self.terms]

    def validate(self):
        seen = set()
        for term in self.terms:
            for key in ('id', 'term', 'aliases', 'href', 'definition'):
                if key not in term:
                    raise SystemExit(f'data/terms.json: {term.get("id", "?")} is missing "{key}"')
            if term['id'] in seen:
                raise SystemExit(f'data/terms.json: duplicate id {term["id"]}')
            seen.add(term['id'])
            if not term['href'].startswith('/'):
                raise SystemExit(f'data/terms.json: {term["id"]}: href must be site-relative')

    @staticmethod
    def pattern(term):                                                            # the term and its aliases, whole words, longest first; lowercase words may take a plural s
        words = sorted([term['term']] + term['aliases'], key=len, reverse=True)
        alts  = []
        for word in words:
            escaped = re.escape(word)
            if word[:1].islower() and word.isalpha():
                escaped += 's?'
            alts.append(escaped)
        return re.compile(r'(?<![\w/.-])(' + '|'.join(alts) + r')(?![\w/-])')

    def unwrap(self, text):
        while True:
            new = RE_TERMLINK.sub(lambda m: m.group(1), text)
            if new == text:
                return text
            text = new

    def link(self, term, shown):
        title = html.escape(term['definition'], quote=True)
        return f'<a class="sg-term" href="{term["href"]}" title="{title}">{shown}</a>'

    def apply(self, body, page_url):
        done  = set()
        stack = []                                                                # open skip tags
        block = 0                                                                 # inside a generated block
        out   = []
        for match in RE_TOKEN.finditer(body):
            tag, text = match.group(1), match.group(2)
            if tag is not None:
                marker = RE_BLOCK.match(tag)
                if marker:
                    block += 1 if marker.group(1) == 'start' else -1
                else:
                    t = RE_TAG.match(tag)
                    if t and t.group(2).lower() in SKIP_TAGS and not tag.endswith('/>'):
                        if t.group(1):
                            if stack and stack[-1] == t.group(2).lower():
                                stack.pop()
                        else:
                            stack.append(t.group(2).lower())
                out.append(tag)
                continue
            if stack or block > 0:
                out.append(text)
                continue
            matches = []                                                          # found on the text as it is, never on text already linked
            for term, pattern in self.patterns:
                if term['id'] in done or term['href'].split('#')[0] == page_url:
                    continue
                found = pattern.search(text)
                if found and not any(found.start() < e and found.end() > b for b, e, _, _ in matches):
                    matches.append((found.start(), found.end(), term, found.group(1)))
                    done.add(term['id'])
            matches.sort()
            cursor = 0
            for start, end, term, shown in matches:
                out.append(text[cursor:start])
                out.append(self.link(term, shown))
                cursor = end
            out.append(text[cursor:])
        return ''.join(out)

    def glossary(self):
        lines = ['  <dl class="sg-terms" data-generated-from="data/terms.json">']
        for term in sorted(self.terms, key=lambda t: t['term'].lower()):
            aliases = f' <small>also: {html.escape(", ".join(term["aliases"]))}</small>' if term['aliases'] else ''
            lines.append(f'    <dt id="term-{term["id"]}"><a href="{term["href"]}">{html.escape(term["term"])}</a>{aliases}</dt>')
            lines.append(f'    <dd>{html.escape(term["definition"])}</dd>')
        lines.append('  </dl>')
        return '\n'.join(lines)

    def run(self):
        changed = []
        for path in self.pages.html_files():
            text    = path.read_text(encoding='utf-8')
            url     = self.pages.url_path(path)
            new     = text
            if self.pages.has_block(text, 'terms'):
                new, _ = self.pages.replace_block(new, 'terms', self.glossary())
            found = RE_MAIN.search(new)
            if found:
                body = self.apply(self.unwrap(found.group(2)), url)
                new  = new[:found.start(2)] + body + new[found.end(2):]
            if new != text and self.pages.write_if_changed(path, new, self.check):
                changed.append(path)
        return changed


if __name__ == '__main__':
    check   = '--check' in sys.argv
    changed = Gen__Terms(check=check).run()
    verb    = 'stale' if check else 'updated'
    print(f'gen_terms: {len(changed)} page(s) {verb}')
    if check and changed:
        print(f'gen_terms --check: {len(changed)} page(s) out of date; run python3 admin/build/gen_terms.py')
        sys.exit(1)
