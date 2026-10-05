# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gen__Features
# Reads data/features.json, validates it, and generates (1) docs/reality.md, the
# list of what is built, and (2) the status tables in pages that carry a
# <!-- sg-secrets:features:start area="..." --> block. `--check` fails on drift.
# Usage: python3 admin/build/gen_features.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import hashlib
import html
import json
import sys

from chrome import ROOT, Chrome, SITE_NAME, REPO_URL
from pages  import Site__Pages


FEATURES_FILE = ROOT / 'data' / 'features.json'
REALITY_FILE  = ROOT / 'docs' / 'reality.md'
STATUSES      = ('shipped', 'proposed', 'absent')
REQUIRED_KEYS = ('id', 'area', 'title', 'status', 'where', 'notes')


class Gen__Features:

    def __init__(self, check=False):
        self.check    = check
        self.chrome   = Chrome()
        self.pages    = Site__Pages()
        self.data     = json.loads(FEATURES_FILE.read_text(encoding='utf-8'))
        self.features = self.data['features']
        self.validate()

    def validate(self):
        problems = []
        seen     = set()
        for feature in self.features:
            for key in REQUIRED_KEYS:
                if key not in feature:
                    problems.append(f'{feature.get("id", "?")}: missing "{key}"')
            if feature.get('id') in seen:
                problems.append(f'{feature["id"]}: duplicate id')
            seen.add(feature.get('id'))
            if feature.get('status') not in STATUSES:
                problems.append(f'{feature.get("id")}: status must be one of {STATUSES}')
            if feature.get('status') == 'shipped' and not feature.get('since'):
                problems.append(f'{feature.get("id")}: shipped features need "since"')
            if feature.get('status') != 'shipped' and feature.get('since'):
                problems.append(f'{feature.get("id")}: only shipped features carry "since"')
        rules_file = ROOT / self.data['rulesSource']
        if rules_file.exists():
            digest = 'sha256:' + hashlib.sha256(rules_file.read_bytes()).hexdigest()
            if digest != self.data['rulesHash']:
                problems.append(f'rulesHash is {self.data["rulesHash"]} but {self.data["rulesSource"]} hashes to {digest}')
        else:
            problems.append(f'rulesSource {self.data["rulesSource"]} does not exist')
        if problems:
            raise SystemExit('data/features.json is invalid:\n  ' + '\n  '.join(problems))

    def status_label(self, feature):
        if feature['status'] == 'shipped':
            return f'shipped v{feature["since"]}'
        return feature['status']

    def by_status(self, features):
        return {status: [f for f in features if f['status'] == status] for status in STATUSES}

    # ── docs/reality.md ────────────────────────────────────────────────────────

    def reality_markdown(self):
        groups = self.by_status(self.features)
        counts = ', '.join(f'{len(groups[status])} {status}' for status in STATUSES)
        lines  = [f'# {SITE_NAME} — reality'                                                                                          ,
                  ''                                                                                                                  ,
                  f'*Generated from `data/features.json` by `admin/build/gen_features.py` at site v{self.chrome.version} '
                  f'({self.chrome.released}). If the reality document does not list it, it does not exist. '
                  f'Briefs are aspirations; this file is the fact.*'                                                                 ,
                  ''                                                                                                                  ,
                  f'{len(self.features)} claims: {counts}.'                                                                           ,
                  ''                                                                                                                  ,
                  '| Status | Meaning |'                                                                                              ,
                  '|---|---|'                                                                                                         ]
        for status in STATUSES:
            lines.append(f'| {status} | {self.data["statuses"][status]} |')
        for status in STATUSES:
            lines += ['', f'## {status.capitalize()} ({len(groups[status])})', '']
            if not groups[status]:
                lines.append('Nothing.')
                continue
            lines += ['| Area | Feature | Status | Where | Notes |', '|---|---|---|---|---|']
            for feature in groups[status]:
                lines.append(f'| {feature["area"]} | {feature["title"]} | {self.status_label(feature)} | '
                             f'{feature["where"]} | {feature["notes"]} |')
        lines += ['', f'Storage Security Rules source: `{self.data["rulesSource"]}`, `{self.data["rulesHash"]}` '
                      f'(the gate fails when the file and this hash disagree, so a rules change needs a release note).',
                  '', f'*Source: [{REPO_URL}]({REPO_URL}) · CC BY 4.0*', '']
        return '\n'.join(lines)

    # ── status tables in pages ─────────────────────────────────────────────────

    def table_html(self, area, features=None):
        if features is None:
            features = [f for f in self.features if area in ('', 'all') or f['area'] == area]
        if not features:
            raise SystemExit(f'features block: no features in area "{area}"')
        rows = []
        for feature in features:
            rows.append('      <tr>'
                        f'<td>{html.escape(feature["area"])}</td>'
                        f'<td>{html.escape(feature["title"])}</td>'
                        f'<td><span class="sg-status sg-status-{feature["status"]}">{self.status_label(feature)}</span></td>'
                        f'<td>{html.escape(feature["where"])}</td>'
                        f'<td>{html.escape(feature["notes"])}</td>'
                        '</tr>')
        return '\n'.join([f'  <table class="sg-features" data-area="{html.escape(area)}" data-generated-from="data/features.json">'    ,
                          '    <thead><tr><th>Area</th><th>Feature</th><th>Status</th><th>Where</th><th>Notes</th></tr></thead>'        ,
                          '    <tbody>'                                                                                                   ,
                          *rows                                                                                                           ,
                          '    </tbody>'                                                                                                  ,
                          '  </table>'                                                                                                    ])

    def grouped_html(self):                                                       # /shipped/: one table per status, in the order shipped, proposed, absent
        groups = self.by_status(self.features)
        parts  = []
        for status in STATUSES:
            parts.append(f'  <h2 id="{status}">{status.capitalize()} ({len(groups[status])})</h2>')
            parts.append(f'  <p>{html.escape(self.data["statuses"][status])}.</p>')
            parts.append(self.table_html(status, features=groups[status]))
        return '\n'.join(parts)

    def status_line_html(self, ids):                                              # a content page's status line, from the features it describes
        chips = []
        for feature_id in [i.strip() for i in ids.split(',') if i.strip()]:
            feature = next((f for f in self.features if f['id'] == feature_id), None)
            if feature is None:
                raise SystemExit(f'status block names unknown feature id "{feature_id}"')
            chips.append(f'<span class="sg-status sg-status-{feature["status"]}">{self.status_label(feature)}</span> {html.escape(feature["title"])}')
        return ('  <p class="sg-status-line" data-generated-from="data/features.json">Status, from <a href="/shipped/">/shipped/</a>: '
                + ' · '.join(chips) + '</p>')

    def run(self):
        changed = []
        if self.pages.write_if_changed(REALITY_FILE, self.reality_markdown(), self.check):
            changed.append('docs/reality.md')
        for path in self.pages.html_files():
            text = path.read_text(encoding='utf-8')
            if not (self.pages.has_block(text, 'features') or self.pages.has_block(text, 'status')):
                continue
            text, _ = self.pages.replace_blocks(text, 'features', lambda attrs: self.grouped_html() if attrs.get('group') == 'status' else self.table_html(attrs.get('area', 'all')))
            text, _ = self.pages.replace_blocks(text, 'status'  , lambda attrs: self.status_line_html(attrs.get('ids', '')))
            if self.pages.write_if_changed(path, text, self.check):
                changed.append(path.relative_to(ROOT).as_posix())
        return changed


if __name__ == '__main__':
    check   = '--check' in sys.argv
    changed = Gen__Features(check=check).run()
    verb    = 'stale' if check else 'updated'
    for name in changed:
        print(f'  features {verb}: {name}')
    if check and changed:
        print(f'gen_features --check: {len(changed)} file(s) out of date; run python3 admin/build/gen_features.py')
        sys.exit(1)
    print(f'gen_features: {len(changed)} file(s) {verb}')
