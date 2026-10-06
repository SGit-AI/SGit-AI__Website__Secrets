# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Chrome
# The one definition of the site chrome: head block, the family nav (grouped
# menus with dropdowns, the parent link, the stage pill, the version badge,
# the phone menu button), breadcrumbs, footer, CSP and canonical URL. Every
# HTML page gets it injected between markers by gen_chrome.py, so the chrome
# cannot drift between pages. The nav shape is the one sgit.ai, nfrs.sgit.ai
# and pki.sgit.ai run; the interaction lives in assets/nav.js.
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
STAGE             = 'mvp, being built'                                            # the stage pill; changes when /shipped/ says the MVP rows are shipped
PARENT_URL        = 'https://sgit.ai'
PARENT_TITLE      = 'sgit.ai: the parent project, the vault layer this secrets manager holds keys for'
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

# Each group: (label, the group's own page, [(href, label), ...]). A group label is a
# plain link to its first page, so the nav works with no JavaScript at all.
NAV_GROUPS        = (('The design'  , '/how-it-works/' , (('/how-it-works/'                                        , 'How it works'              ),
                                                          ('/security/'                                            , 'Security'                  ),
                                                          ('/keyring/'                                             , 'Keyring format v1'         ),
                                                          ('/sharing/'                                             , 'Sharing'                   ),
                                                          ('/environments/'                                        , 'Environments'              ))),
                     ('Shipped'     , '/shipped/'      , (('/shipped/'                                             , 'Shipped, proposed, absent' ),
                                                          ('/docs/reality.html'                                    , 'Reality: docs/reality.md'  ))),
                     ('Docs'        , '/docs/'         , (('/docs/'                                                , 'All documents'             ),
                                                          ('/docs/design/'                                         , 'Design documents'          ),
                                                          ('/docs/design/secrets-sgit-ai__mvp-build-brief.html'   , 'The MVP build brief'       ),
                                                          ('/docs/design/brief-corrections.html'                   , 'Brief corrections'         ),
                                                          ('/docs/ops/'                                            , 'Operations'                ),
                                                          ('/team/'                                                , 'The team'                  ))),
                     ('Admin'       , '/admin/'        , (('/admin/'                                               , 'How the site is built'     ),
                                                          ('/admin/versions.html'                                  , 'Release history'           ),
                                                          ('/admin/comms.html'                                     , 'Comms: asks and steps'     ),
                                                          ('/review/ui/'                                              , 'Review graphs'             ),
                                                          ('/docs/ops/needs.html'                                  , 'What needs a human'        ),
                                                          ('/docs/ops/bootstrap.html'                              , 'GCP bootstrap, as commands'),
                                                          ('/llms.txt'                                             , 'llms.txt, for agents'      ))))

CRUMB_FOLDERS     = {'/docs/'        : ('Docs'            , '/docs/'        ),
                     '/team/'        : ('The team'        , '/team/'        ),
                     '/team/roles/'  : ('Roles'           , '/team/'        ),
                     '/about/'       : ('About'           , '/about/participant.html'),
                     '/review/ui/'      : ('Review graphs'   , '/review/ui/'      ),   # breadcrumb names for folders that have no nav entry of their own
                     '/docs/design/' : ('Design documents', '/docs/design/' ),
                     '/docs/ops/'    : ('Operations'      , '/docs/ops/'    ),
                     '/admin/'       : ('Admin'           , '/admin/'       )}


class Chrome:

    def __init__(self):
        self.version   = VERSION_FILE.read_text(encoding='utf-8').strip()
        self.host      = CNAME_FILE.read_text(encoding='utf-8').strip()
        self.base_url  = f'https://{self.host}'
        self.released  = self.release_date()
        self.labels    = {href: label for _, _, items in NAV_GROUPS for href, label in items}

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

    # ── head ──────────────────────────────────────────────────────────────────

    def head(self, url_path, title, description):
        canonical  = self.canonical_url(url_path)
        twin       = self.twin_path(url_path)
        esc        = html.escape
        lines      = [f'<meta http-equiv="Content-Security-Policy" content="{CSP}">'                         ,
                      f'<link rel="canonical" href="{canonical}">'                                           ,
                      f'<link rel="alternate" type="text/markdown" href="{twin}">'                          ,
                      f'<link rel="license" href="{LICENCE_URL}">'                                           ,
                      f'<link rel="stylesheet" href="/assets/site.css">'                                     ,
                      f'<script src="/assets/nav.js" defer></script>'                                        ,
                      f'<meta property="og:type" content="website">'                                         ,
                      f'<meta property="og:site_name" content="{SITE_NAME}">'                               ,
                      f'<meta property="og:url" content="{canonical}">'                                      ,
                      f'<meta property="og:title" content="{esc(title)}">'                                   ,
                      f'<meta property="og:description" content="{esc(description)}">'                       ,
                      f'<meta name="sg-secrets:version" content="{self.version}">'                           ,
                      f'<meta name="sg-secrets:released" content="{self.released}">'                         ]
        return '\n'.join('  ' + line for line in lines)

    # ── nav ───────────────────────────────────────────────────────────────────

    def version_badge(self):
        return (f'<a class="sg-badge sg-badge-version ver" href="/admin/versions.html" '
                f'data-version="{self.version}" title="released {self.released}">v{self.version}</a>')

    def group_is_here(self, group, url_path):                                   # the group's own folder, or any page it lists
        _, own, items = group
        return url_path.startswith(own) or any(href == url_path for href, _ in items)

    def nav(self, url_path, title=''):
        groups = []
        for group in NAV_GROUPS:
            label, own, items = group
            here  = ' here' if self.group_is_here(group, url_path) else ''
            links = []
            for href, text in items:
                current = ' aria-current="page"' if href == url_path else ''
                links.append(f'          <a class="sl{" here" if href == url_path else ""}" href="{href}"{current}>{html.escape(text)}</a>')
            groups.append('\n'.join([f'        <div class="ni ni-has">'                                                           ,
                                     f'          <a class="nl{here}" href="{own}">{html.escape(label)}<span class="caret">&#9662;</span></a>',
                                     f'          <div class="sub">'                                                                  ,
                                     *links                                                                                          ,
                                     f'          </div>'                                                                             ,
                                     f'        </div>'                                                                               ]))
        return '\n'.join(['  <header class="sg-header">'                                                                                             ,
                          '    <nav class="site" aria-label="Site">'                                                                                  ,
                          '      <div class="row">'                                                                                                   ,
                          '        <a class="brand" href="/">secrets<span>.sgit.ai</span></a>'                                                        ,
                          f'        <a class="parent" href="{PARENT_URL}" title="{html.escape(PARENT_TITLE)}">&#8599; part of <b>sgit.ai</b></a>'    ,
                          f'        <span class="stage-pill">{STAGE}</span>'                                                                          ,
                          f'        {self.version_badge()}'                                                                                           ,
                          '        <button class="nav-toggle" type="button" aria-expanded="false" aria-label="Menu">Menu</button>'                    ,
                          '        <div class="nav-items">'                                                                                           ,
                          *groups                                                                                                                     ,
                          '        </div>'                                                                                                            ,
                          '      </div>'                                                                                                              ,
                          '    </nav>'                                                                                                                ,
                          self.crumbs(url_path, title)                                                                                                ,
                          '  </header>'                                                                                                               ])

    def crumbs(self, url_path, title):
        if url_path == '/':
            return ''
        parts  = ['<a href="/">Home</a>']
        folder = '/'
        for segment in url_path.strip('/').split('/')[:-1]:                     # every folder above the page
            folder += segment + '/'
            name, href = CRUMB_FOLDERS.get(folder, (segment, folder))
            parts.append(f'<a href="{href}">{html.escape(name)}</a>')
        leaf = self.labels.get(url_path) or CRUMB_FOLDERS.get(url_path, (None, None))[0] or title.split(' — ')[0]
        parts.append(f'<span aria-current="page">{html.escape(leaf)}</span>')
        return '    <div class="sg-crumbs" aria-label="Breadcrumb">' + ' <span class="sep">/</span> '.join(parts) + '</div>'

    # ── footer ────────────────────────────────────────────────────────────────

    def footer(self, url_path):
        twin = self.twin_path(url_path)
        return '\n'.join(['  <footer class="sg-footer">'                                                                                      ,
                          f'    <p>{SITE_NAME} · site {self.version_badge()} · released {self.released} · '
                          f'<a href="/admin/versions.html">releases</a> · <a href="{twin}">markdown twin of this page</a> · <a href="/llms.txt">llms.txt</a> · '
                          f'<a href="{REPO_URL}">source</a> · <a href="{PARENT_URL}">part of sgit.ai</a> · <a href="/about/participant.html">who publishes this</a></p>'                                  ,
                          f'    <p>Everything in the repository is public; nothing in it is secret. '
                          f'Content <a href="{LICENCE_URL}">{LICENCE_NAME}</a>, code Apache-2.0. '
                          f'What is shipped, proposed or absent is listed in <a href="/shipped/">/shipped/</a> and <a href="/docs/reality.html">docs/reality.md</a>; '
                          f'if it is not listed there, it does not exist.</p>'                                                                ,
                          '  </footer>'                                                                                                        ])
