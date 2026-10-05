# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gen__Docs
# Renders every markdown document under docs/ to an HTML page beside it
# (docs/design/x.md -> docs/design/x.html) and writes an index page per
# folder. The markdown stays the source and the twin; the HTML page names it
# in <meta name="sg-secrets:source">. Runs before gen_chrome, which fills the
# chrome; only the document block and the head metas are this generator's.
# Usage: python3 admin/build/gen_docs.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import html
import re
import sys

from chrome     import ROOT, Chrome, SITE_NAME
from md_to_html import Markdown__To__Html
from pages      import Site__Pages


DOCS_ROOT     = ROOT / 'docs'
RE_H1         = re.compile(r'^#\s+(.+?)\s*$', re.M)
RE_PARAGRAPH  = re.compile(r'^(?!#|\||>|-|\*|\d+\.|```|\s*$)(.+?)$', re.M)
RE_TITLE      = re.compile(r'<title>.*?</title>', re.S)
RE_DESC       = re.compile(r'<meta name="description" content=".*?">', re.S)
FOLDERS       = {'design' : ('Design documents',
                             'The brief that this site is built from, what it got wrong, and the four documents that carry the reasoning. '
                             'Copied in verbatim; the markdown is the source of truth and the HTML is rendered from it on every release.'),
                 'ops'    : ('Operations',
                             'How a release works, what only a human can do, the DNS record and the repository protections.')}
DESCRIPTIONS  = {'secrets-sgit-ai__mvp-build-brief.md'                      : 'The instruction set: architecture, environments, the site, the keyring specification, the pipeline, the build order.',
                 'brief-corrections.md'                                     : 'What the brief got wrong or left open, found while building, dated, beside it.',
                 'riskmandate-gcp-key-vault-password-manager-mvp.md'        : 'The primary design: all-GCP stack, keyring, PRF unlock, sharing scheme, storage layout, threat summary, password-manager MVP scope.',
                 'riskmandate-aws-cognito-architecture.md'                  : 'The AWS variant; why no secret can live inside an identity provider; the attack table.',
                 'riskmandate-user-onboarding-account-experience.md'        : 'The Workspace-based onboarding design, the Google terms research, and the five-tier model that led here.',
                 'riskmandate-workspace-architecture-briefing.md'           : 'The earlier Workspace architecture briefing.',
                 'release.md'                                               : 'The version, the commit subject, the gate, the four CI jobs, and why green does not mean live.',
                 'needs.md'                                                 : 'Exactly what only a human can do, who, and which step waits on it.',
                 'dns.md'                                                   : 'The CNAME record and the Pages settings for secrets.sgit.ai.',
                 'branch-protection.md'                                     : 'The settings for dev and main, the organisation, Actions and environments.'}


class Gen__Docs:

    def __init__(self, check=False):
        self.check  = check
        self.chrome = Chrome()
        self.pages  = Site__Pages()

    def sources(self):
        found = []
        for path in sorted(DOCS_ROOT.rglob('*.md')):
            if path.name == 'index.md':
                continue
            html_twin = path.with_suffix('.html')
            if html_twin.exists() and not self.pages.meta_source(html_twin):      # a hand-written page whose twin this is
                continue
            found.append(path)
        return found

    def rewrite_link(self, href):                                                 # .md links become .html where a rendering exists
        if re.match(r'^[a-z][a-z0-9+.-]*:', href) and not href.startswith('/'):
            return href
        base, _, fragment = href.partition('#')
        if base.endswith('.md'):
            base = base[:-3] + '.html'
        return base + ('#' + fragment if fragment else '')

    def description_of(self, path, text):
        if path.name in DESCRIPTIONS:
            return DESCRIPTIONS[path.name]
        for match in RE_PARAGRAPH.finditer(text):
            plain = re.sub(r'[*_`\[\]]|\(http[^)]*\)', '', match.group(1)).strip()
            if plain and not plain.startswith('Status:'):
                return plain if len(plain) <= 200 else plain[:197].rstrip() + '…'
        return path.stem

    def skeleton(self, title, description, rel_md, body):
        return '\n'.join(['<!doctype html>'                                                                                  ,
                          '<html lang="en">'                                                                                 ,
                          '<head>'                                                                                           ,
                          '  <meta charset="utf-8">'                                                                         ,
                          '  <meta name="viewport" content="width=device-width, initial-scale=1">'                           ,
                          f'  <title>{html.escape(title)} — {SITE_NAME}</title>'                                            ,
                          f'  <meta name="description" content="{html.escape(description)}">'                               ,
                          f'  <meta name="sg-secrets:source" content="{rel_md}">'                                            ,
                          '  <!-- sg-secrets:head:start -->'                                                                 ,
                          '  <!-- sg-secrets:head:end -->'                                                                   ,
                          '</head>'                                                                                          ,
                          '<body>'                                                                                           ,
                          '  <!-- sg-secrets:nav:start -->'                                                                  ,
                          '  <!-- sg-secrets:nav:end -->'                                                                    ,
                          '  <main class="sg-document">'                                                                     ,
                          '    <!-- sg-secrets:docs:start -->'                                                               ,
                          body                                                                                               ,
                          '    <!-- sg-secrets:docs:end -->'                                                                 ,
                          '  </main>'                                                                                        ,
                          '  <!-- sg-secrets:footer:start -->'                                                               ,
                          '  <!-- sg-secrets:footer:end -->'                                                                 ,
                          '</body>'                                                                                          ,
                          '</html>'                                                                                          ,
                          ''                                                                                                 ])

    def render_document(self, path):
        text   = path.read_text(encoding='utf-8')
        rel_md = '/' + path.relative_to(ROOT).as_posix()
        h1     = RE_H1.search(text)
        title  = re.sub(r'[*_`]', '', h1.group(1)) if h1 else path.stem
        body   = Markdown__To__Html(self.rewrite_link).render(text).rstrip()
        note   = (f'<p class="sg-doc-source">Rendered from <a href="{rel_md}">{rel_md[1:]}</a>, which is the source of truth and the '
                  f'markdown twin of this page. Rendered at site v{self.chrome.version}.</p>')
        return title, self.description_of(path, text), rel_md, f'{note}\n{body}'

    def render_index(self, folder):
        label, description = FOLDERS[folder]
        items = []
        for path in sorted((DOCS_ROOT / folder).glob('*.md')):
            if path.name == 'index.md':
                continue
            text  = path.read_text(encoding='utf-8')
            h1    = RE_H1.search(text)
            title = re.sub(r'[*_`]', '', h1.group(1)) if h1 else path.stem
            items.append(f'<li><a href="/docs/{folder}/{path.stem}.html">{html.escape(title)}</a>: {html.escape(self.description_of(path, text))} '
                         f'<a href="/docs/{folder}/{path.name}">(markdown)</a></li>')
        body = '\n'.join([f'<h1>{html.escape(label)}</h1>', f'<p>{html.escape(description)}</p>', '<ul>', *items, '</ul>'])
        return label, description, body

    def update(self, target, title, description, body, source=None):
        if target.exists():
            text = target.read_text(encoding='utf-8')
            text = RE_TITLE.sub(f'<title>{html.escape(title)} — {SITE_NAME}</title>', text, count=1)
            text = RE_DESC.sub(f'<meta name="description" content="{html.escape(description)}">', text, count=1)
            text, found = self.pages.replace_block(text, 'docs', body)
            if not found:
                raise SystemExit(f'{target.relative_to(ROOT)}: exists but has no sg-secrets:docs block')
        else:
            text = self.skeleton(title, description, source or '', body)
            if source is None:
                text = text.replace('  <meta name="sg-secrets:source" content="">\n', '')
        return self.pages.write_if_changed(target, text, self.check)

    def run(self):
        changed = []
        for path in self.sources():
            title, description, rel_md, body = self.render_document(path)
            if self.update(path.with_suffix('.html'), title, description, body, source=rel_md):
                changed.append(path.with_suffix('.html').relative_to(ROOT).as_posix())
        for folder in FOLDERS:
            title, description, body = self.render_index(folder)
            if self.update(DOCS_ROOT / folder / 'index.html', title, description, body):
                changed.append(f'docs/{folder}/index.html')
        return changed


if __name__ == '__main__':
    check   = '--check' in sys.argv
    changed = Gen__Docs(check=check).run()
    verb    = 'stale' if check else 'updated'
    for name in changed:
        print(f'  docs {verb}: {name}')
    if check and changed:
        print(f'gen_docs --check: {len(changed)} page(s) out of date; run python3 admin/build/gen_docs.py')
        sys.exit(1)
    print(f'gen_docs: {len(changed)} page(s) {verb}')
