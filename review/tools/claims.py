# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Claims
# Writes review/intent/claims.json, the claims layer of the review graph: one
# node per claim in data/features.json, one per release in data/versions.json,
# and one anchor node per thing a chain of evidence ends on (a file, a test, a
# section of the brief, a document, a URL, a commit, a tag, a CI run), with
# the typed edges between them. A claim's evidence refs are strings
# "<verb> <kind>:<value>" in features.json; here they become edges to nodes,
# every one checked: the file exists, the section is in the brief, the intent
# node is in the set. Strict: a shipped claim with no anchor that resolves, or
# any claim with no intent it realises, fails the build.
# Usage: python3 review/tools/claims.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import json
import re
import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from review_tree import ROOT, REVIEW, Review__Tree                                # noqa: E402


FEATURES  = ROOT / 'data' / 'features.json'
VERSIONS  = ROOT / 'data' / 'versions.json'
SECTIONS  = REVIEW / 'intent' / 'sections.json'
TARGET    = REVIEW / 'intent' / 'claims.json'
REPO      = 'https://github.com/SGit-AI/SGit-AI__Website__Secrets'
SITE      = 'https://secrets.sgit.ai'
NOT_SERVED = ('.github/', 'infra/', 'tests/unit/')                                # assemble_site.py leaves these out of the deploy
ANCHOR_KINDS = ('file', 'test', 'section', 'doc', 'url', 'commit', 'tag', 'run')
RE_REF    = re.compile(r'^(\w+) (file|test|section|doc|url|node|release):(.+)$')


class Claims:

    def __init__(self, check=False):
        self.check    = check
        self.tree     = Review__Tree()
        self.features = json.loads(FEATURES.read_text(encoding='utf-8'))
        self.releases = json.loads(VERSIONS.read_text(encoding='utf-8'))['releases']
        self.sections = self.tree.read_json(SECTIONS)['sections']
        self.intent   = self.intent_ids()
        self.anchors  = {}
        self.edges    = []
        self.problems = []

    def intent_ids(self):
        ids = set()
        def walk(item):
            if isinstance(item, dict):
                if isinstance(item.get('id'), str) and ('name' in item or 'text' in item):
                    ids.add(item['id'])
                for value in item.values():
                    walk(value)
            elif isinstance(item, list):
                for value in item:
                    walk(value)
        for name in ('stories', 'flows', 'components', 'deploy'):
            walk(self.tree.read_json(REVIEW / 'intent' / f'{name}.json'))
        return ids

    # ── anchors: created once per thing, named by kind and value ─────────────

    def anchor(self, kind, value, name, href, opens=''):
        node_id = f'anchor.{kind}.{value}'.replace('#', '@')                        # a node id may not hold '#'; the ref keeps it
        if node_id not in self.anchors:
            self.anchors[node_id] = {'id': node_id, 'kind': kind, 'name': name, 'ref': f'{kind}:{value}', 'href': href, 'opens': opens, 'anchor': True}
        return node_id

    def file_anchor(self, kind, value, commit=None):
        path, _, lines = value.partition('#')
        if not (ROOT / path).exists():
            return None
        served  = not path.startswith(NOT_SERVED)
        in_nav  = f'/review/ui/#file={path}' + (f'&lines={lines}' if lines and lines.startswith('L') else '')
        github  = f'{REPO}/blob/{commit or "dev"}/{path}' + (f'#{lines}' if lines and lines.startswith('L') else '')
        name    = path + (f' ({lines})' if lines else '')
        return self.anchor(kind, value, name, in_nav if served else github, 'in the navigator' if served else 'on GitHub (not served by the site)')

    def resolve(self, claim, verb, kind, value):                                   # -> target node id, or None with a problem recorded
        if kind == 'node':
            if value in self.intent:
                return value
            self.problems.append(f'{claim}: realises {value}, which is not an intent node')
            return None
        if kind in ('file', 'test'):
            target = self.file_anchor(kind, value)
            if target is None:
                self.problems.append(f'{claim}: {kind} {value} does not exist')
            return target
        if kind == 'section':
            if value not in self.sections:
                self.problems.append(f'{claim}: section {value} is not in the brief')
                return None
            entry = self.sections[value]
            return self.anchor('section', value, f'brief §{entry["title"]}', f'/review/ui/#section={value}', 'in the navigator (review-brief)')
        if kind == 'doc':
            path, _, fragment = value.partition('#')
            if not (ROOT / path).exists():
                self.problems.append(f'{claim}: document {path} does not exist')
                return None
            page = '/' + (path[:-3] + '.html' if path.endswith('.md') and (ROOT / (path[:-3] + '.html')).exists() else path)
            return self.anchor('doc', value, path + (f' #{fragment}' if fragment else ''), page + (f'#{fragment}' if fragment else ''), 'the rendered page')
        if kind == 'url':
            if not value.startswith((SITE, REPO)):
                self.problems.append(f'{claim}: url {value} is not on this site or its repository')
                return None
            return self.anchor('url', value, value.replace(SITE, 'secrets.sgit.ai'), value, 'the page itself')
        if kind == 'release':
            return f'release.{value}' if any(r['version'] == value for r in self.releases) else None
        return None

    # ── the layer ─────────────────────────────────────────────────────────────

    def release_nodes(self):
        nodes = []
        for release in self.releases:
            node_id = f'release.{release["version"]}'
            nodes.append({'id': node_id, 'version': release['version'], 'name': f'v{release["version"]}: {release["title"]}', 'date': release['date'], 'notes': release['notes'],
                          'tag': release.get('tag'), 'commit': release.get('commit'), 'run': release.get('run'), 'verified': release.get('verified')})
            if release.get('tag'):
                self.edges.append({'from': node_id, 'to': self.anchor('tag', release['tag'], f'tag {release["tag"]}', f'{REPO}/releases/tag/{release["tag"]}', 'on GitHub'), 'verb': 'recorded_in'})
            if release.get('commit'):
                self.edges.append({'from': node_id, 'to': self.anchor('commit', release['commit'], f'commit {release["commit"][:7]}', f'{REPO}/commit/{release["commit"]}', 'on GitHub'), 'verb': 'recorded_in'})
            if release.get('run'):
                self.edges.append({'from': node_id, 'to': self.anchor('run', str(release['run']['id']), f'Actions run {release["run"]["id"]} ({release["run"]["conclusion"]})', release['run']['url'], 'the run: validate, tag-release, deploy, verify-live'), 'verb': 'recorded_in'})
            if release.get('verified'):
                self.edges.append({'from': node_id, 'to': self.anchor('url', release['verified']['url'], 'the live version.txt', release['verified']['url'], 'the page itself'), 'verb': 'proven_by'})
        return nodes

    def claim_nodes(self):
        nodes = []
        for feature in self.features['features']:
            node_id  = f'claim.{feature["id"]}'
            anchored = False
            realises = False
            for ref in feature.get('evidence', []):
                match = RE_REF.match(f'{ref["verb"]} {ref["to"]}')
                if not match:
                    self.problems.append(f'{node_id}: evidence "{ref}" is not "<verb> <kind>:<value>"')
                    continue
                verb, kind, value = match.groups()
                target = self.resolve(node_id, verb, kind, value)
                if target is None:
                    continue
                self.edges.append({'from': node_id, 'to': target, 'verb': verb})
                anchored |= target.startswith('anchor.')
                realises |= verb == 'realises'
            if feature['status'] == 'shipped':
                if feature.get('since'):
                    self.edges.append({'from': node_id, 'to': f'release.{feature["since"]}', 'verb': 'shipped_in'})
                    anchored = True
                if not anchored:
                    self.problems.append(f'{node_id}: shipped, and no anchor resolves (a file, a test, a section, a document, a URL)')
            if not realises:
                self.problems.append(f'{node_id}: realises no intent node')
            nodes.append({'id': node_id, 'feature': feature['id'], 'area': feature['area'], 'name': feature['title'], 'status': feature['status'],
                          'since': feature.get('since'), 'where': feature['where'], 'notes': feature['notes'], 'source': {'doc': 'data/features.json', 'section': None}})
        return nodes

    def build(self):
        claims   = self.claim_nodes()
        releases = self.release_nodes()
        anchors  = sorted(self.anchors.values(), key=lambda a: a['id'])
        known    = {n['id'] for n in claims} | {n['id'] for n in releases} | set(self.anchors) | self.intent
        for edge in self.edges:
            if edge['to'] not in known:
                self.problems.append(f'edge {edge["from"]} {edge["verb"]} {edge["to"]}: target unknown')
        return {'claims': claims, 'releases': releases, 'anchors': anchors, 'edges': self.edges,
                'provenance': {'tool': 'review/tools/claims.py', 'from': ['data/features.json', 'data/versions.json', 'review/intent/sections.json'], 'strict': True}}

    def run(self):
        data = self.build()
        if self.problems:
            print(f'claims: {len(self.problems)} problem(s); a claim is not a claim until its evidence resolves')
            for problem in self.problems:
                print(f'  {problem}')
            return 1
        changed = self.tree.write_json(TARGET, data, check=self.check)
        if self.check and changed:
            print('claims --check: review/intent/claims.json is out of date; run python3 review/tools/claims.py')
            return 1
        print(f'claims: {len(data["claims"])} claims, {len(data["releases"])} releases, {len(data["anchors"])} anchors, {len(data["edges"])} edges{" (updated)" if changed else " (current)"}')
        return 0


if __name__ == '__main__':
    sys.exit(Claims(check='--check' in sys.argv).run())
