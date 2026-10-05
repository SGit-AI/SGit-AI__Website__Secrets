# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Chrome
# The one definition of the site chrome: head block, nav, footer, version badge,
# CSP and canonical URL. Every HTML page gets it injected between markers by
# gen_chrome.py, so the chrome cannot drift between pages.
# ═══════════════════════════════════════════════════════════════════════════════

import html
import json

from pathlib import Path


ROOT              = Path(__file__).resolve().parents[2]
VERSION_FILE      = ROOT / 'admin' / 'build' / 'version.txt'
CNAME_FILE        = ROOT / 'CNAME'
VERSIONS_FILE     = ROOT / 'data' / 'versions.json'

MARKER_PREFIX     = 'sg-secrets'                                                  # <!-- sg-secrets:<block>:start -->

SITE_NAME         = 'secrets.sgit.ai'
SITE_ONE_LINER    = ('A zero-knowledge secrets manager that runs entirely in the browser: '
                     'passkey unlock, ciphertext in a GCP bucket, readable by no one else.')
LICENCE_URL       = 'https://creativecommons.org/licenses/by/4.0/'
LICENCE_NAME      = 'CC BY 4.0'
REPO_URL          = 'https://github.com/SGit-AI/SGit-AI__Website__Secrets'

CSP               = ("default-src 'self'; "
                     "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com "
                     "https://accounts.google.com https://securetoken.googleapis.com "
                     "https://identitytoolkit.googleapis.com; "
                     "frame-src https://*.firebaseapp.com https://accounts.google.com; "
                     "img-src 'self' data:; "
                     "style-src 'self'; "
                     "script-src 'self'; "
                     "object-src 'none'; "
                     "base-uri 'none'; "
                     "form-action 'none'")                                        # section 9.5 of the brief, exact

NAV_ITEMS         = (('/'                                                   , 'Home'       ),   # only pages that exist: the gate checks every link
                     ('/docs/reality.md'                                    , 'Reality'    ),
                     ('/docs/design/secrets-sgit-ai__mvp-build-brief.md'   , 'The brief'  ),
                     ('/admin/'                                             , 'Admin'      ),
                     ('/admin/versions.html'                                , 'Versions'   ),
                     ('/llms.txt'                                           , 'llms.txt'   ))


class Chrome:

    def __init__(self):
        self.version   = VERSION_FILE.read_text(encoding='utf-8').strip()
        self.host      = CNAME_FILE.read_text(encoding='utf-8').strip()
        self.base_url  = f'https://{self.host}'
        self.released  = self.release_date()

    def release_date(self):
        releases = json.loads(VERSIONS_FILE.read_text(encoding='utf-8'))['releases']
        for release in releases:
            if release['version'] == self.version:
                return release['date']
        raise SystemExit(f'data/versions.json has no entry for version {self.version}')

    def marker(self, block, edge):
        return f'<!-- {MARKER_PREFIX}:{block}:{edge} -->'

    def canonical_url(self, url_path):
        return self.base_url + url_path

    def twin_path(self, url_path):
        if url_path.endswith('/'):
            return url_path + 'index.md'
        return url_path[:-len('.html')] + '.md'

    def head(self, url_path, title, description):
        canonical  = self.canonical_url(url_path)
        twin       = self.twin_path(url_path)
        esc        = html.escape
        lines      = [f'<meta http-equiv="Content-Security-Policy" content="{CSP}">'                         ,
                      f'<link rel="canonical" href="{canonical}">'                                           ,
                      f'<link rel="alternate" type="text/markdown" href="{twin}">'                          ,
                      f'<link rel="license" href="{LICENCE_URL}">'                                           ,
                      f'<link rel="stylesheet" href="/assets/site.css">'                                     ,
                      f'<meta property="og:type" content="website">'                                         ,
                      f'<meta property="og:site_name" content="{SITE_NAME}">'                               ,
                      f'<meta property="og:url" content="{canonical}">'                                      ,
                      f'<meta property="og:title" content="{esc(title)}">'                                   ,
                      f'<meta property="og:description" content="{esc(description)}">'                       ,
                      f'<meta name="sg-secrets:version" content="{self.version}">'                           ,
                      f'<meta name="sg-secrets:released" content="{self.released}">'                         ]
        return '\n'.join('  ' + line for line in lines)

    def version_badge(self):
        return (f'<a class="sg-badge sg-badge-version" href="/admin/versions.html" '
                f'data-version="{self.version}" title="released {self.released}">v{self.version}</a>')

    def nav(self, url_path):
        items = []
        for href, label in NAV_ITEMS:
            current = ' aria-current="page"' if href == url_path else ''
            items.append(f'      <li><a href="{href}"{current}>{label}</a></li>')
        return '\n'.join(['  <header class="sg-header">'                                                    ,
                          '    <a class="sg-brand" href="/">secrets<span>.sgit.ai</span></a>'               ,
                          '    <nav class="sg-nav" aria-label="Site">'                                       ,
                          '    <ul>'                                                                         ,
                          *items                                                                             ,
                          '    </ul>'                                                                        ,
                          '    </nav>'                                                                       ,
                          f'    {self.version_badge()}'                                                      ,
                          '  </header>'                                                                      ])

    def footer(self, url_path):
        twin = self.twin_path(url_path)
        return '\n'.join(['  <footer class="sg-footer">'                                                                                      ,
                          f'    <p>{SITE_NAME} · site {self.version_badge()} · released {self.released} · '
                          f'<a href="{twin}">markdown twin of this page</a> · <a href="/llms.txt">llms.txt</a> · '
                          f'<a href="{REPO_URL}">source</a></p>'                                                                               ,
                          f'    <p>Everything in the repository is public; nothing in it is secret. '
                          f'Content <a href="{LICENCE_URL}">{LICENCE_NAME}</a>, code Apache-2.0. '
                          f'What is shipped, proposed or absent is listed in <a href="/docs/reality.md">docs/reality.md</a>; '
                          f'if it is not listed there, it does not exist.</p>'                                                                ,
                          '  </footer>'                                                                                                        ])
