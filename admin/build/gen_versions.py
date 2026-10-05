# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gen__Versions
# Renders the release history table in admin/versions.html from
# data/versions.json, and checks the file agrees with version.txt.
# Usage: python3 admin/build/gen_versions.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import html
import json
import re
import sys

from chrome import ROOT, Chrome, VERSIONS_FILE
from pages  import Site__Pages


VERSIONS_PAGE = ROOT / 'admin' / 'versions.html'
RE_SEMVER     = re.compile(r'^\d+\.\d+\.\d+$')


class Gen__Versions:

    def __init__(self, check=False):
        self.check    = check
        self.chrome   = Chrome()
        self.pages    = Site__Pages()
        self.releases = json.loads(VERSIONS_FILE.read_text(encoding='utf-8'))['releases']
        self.validate()

    def validate(self):
        problems = []
        seen     = set()
        for release in self.releases:
            if not RE_SEMVER.match(release.get('version', '')):
                problems.append(f'{release.get("version")}: not X.Y.Z')
            if release['version'] in seen:
                problems.append(f'{release["version"]}: listed twice')
            seen.add(release['version'])
            for key in ('date', 'title', 'notes'):
                if not release.get(key):
                    problems.append(f'{release["version"]}: missing "{key}"')
        if self.releases and self.releases[0]['version'] != self.chrome.version:
            problems.append(f'newest release is {self.releases[0]["version"]} but version.txt says {self.chrome.version}')
        if problems:
            raise SystemExit('data/versions.json is invalid:\n  ' + '\n  '.join(problems))

    def table_html(self):
        rows = []
        for release in self.releases:
            rows.append('      <tr>'
                        f'<td><code>v{release["version"]}</code></td>'
                        f'<td>{release["date"]}</td>'
                        f'<td>{html.escape(release["title"])}</td>'
                        f'<td>{html.escape(release["notes"])}</td>'
                        '</tr>')
        return '\n'.join(['  <table class="sg-versions" data-generated-from="data/versions.json">'                     ,
                          '    <thead><tr><th>Version</th><th>Date</th><th>Release</th><th>What changed</th></tr></thead>',
                          '    <tbody>'                                                                                 ,
                          *rows                                                                                         ,
                          '    </tbody>'                                                                                ,
                          '  </table>'                                                                                  ])

    def run(self):
        text          = VERSIONS_PAGE.read_text(encoding='utf-8')
        text, found   = self.pages.replace_block(text, 'versions', self.table_html())
        if not found:
            raise SystemExit('admin/versions.html has no sg-secrets:versions block')
        if self.pages.write_if_changed(VERSIONS_PAGE, text, self.check):
            return ['admin/versions.html']
        return []


if __name__ == '__main__':
    check   = '--check' in sys.argv
    changed = Gen__Versions(check=check).run()
    verb    = 'stale' if check else 'updated'
    for name in changed:
        print(f'  versions {verb}: {name}')
    if check and changed:
        print('gen_versions --check: out of date; run python3 admin/build/gen_versions.py')
        sys.exit(1)
    print(f'gen_versions: {len(changed)} file(s) {verb}')
