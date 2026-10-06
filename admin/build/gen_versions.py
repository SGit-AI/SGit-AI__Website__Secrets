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
COMMS_PAGE    = ROOT / 'admin' / 'comms.html'
STEPS_FILE    = ROOT / 'data' / 'steps.json'
STEP_STATUSES = ('done', 'building', 'open')
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

    def steps_html(self, key='steps', prefix='T'):
        steps    = json.loads(STEPS_FILE.read_text(encoding='utf-8'))[key]
        released = {r['version'] for r in self.releases}
        rows     = []
        for step in steps:
            if step['status'] not in STEP_STATUSES:
                raise SystemExit(f'data/steps.json: step {step["step"]} has status {step["status"]}; use one of {STEP_STATUSES}')
            if step['status'] == 'done' and step['releasedAs'] not in released:
                raise SystemExit(f'data/steps.json: step {step["step"]} is done but v{step["releasedAs"]} is not in data/versions.json')
            delivered = f'<code>v{step["releasedAs"]}</code>' if step['releasedAs'] else ''
            rows.append('      <tr>'
                        f'<td>{prefix}{step["step"]}</td>'
                        f'<td>{html.escape(step["title"])}</td>'
                        f'<td>{"<code>v" + step["plannedVersion"] + "</code>" if step.get("plannedVersion") else ""}</td>'
                        f'<td>{delivered}</td>'
                        f'<td><span class="sg-status sg-status-{ {"done": "shipped", "building": "proposed", "open": "absent"}[step["status"]] }">{step["status"]}</span></td>'
                        f'<td>{html.escape(step["note"])}</td>'
                        '</tr>')
        return '\n'.join(['  <table class="sg-steps" data-generated-from="data/steps.json">'                                                       ,
                          '    <thead><tr><th>#</th><th>Step</th><th>Planned as</th><th>Delivered as</th><th>Status</th><th>Note</th></tr></thead>'  ,
                          '    <tbody>'                                                                                                               ,
                          *rows                                                                                                                       ,
                          '    </tbody>'                                                                                                              ,
                          '  </table>'                                                                                                                ])

    def run(self):
        changed = []
        for page, block, body in ((VERSIONS_PAGE, 'versions', self.table_html()), (COMMS_PAGE, 'steps', self.steps_html()), (COMMS_PAGE, 'review-steps', self.steps_html('review_steps', 'R'))):
            text        = page.read_text(encoding='utf-8')
            text, found = self.pages.replace_block(text, block, body)
            if not found:
                raise SystemExit(f'{page.relative_to(ROOT)} has no sg-secrets:{block} block')
            if self.pages.write_if_changed(page, text, self.check):
                changed.append(page.relative_to(ROOT).as_posix())
        return changed


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
