# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Release
# One script for a release, in the family's order: bump, build, validate, push,
# verify. Sets the version, adds the release row, regenerates everything, runs
# the whole gate, commits "site vX.Y.Z : what" with a Kind: trailer, pushes,
# and then polls the live site until it serves the version. A clean push is
# not a release; this script does not say "done" until the origin does.
# Usage: python3 admin/build/release.py --version 0.1.3 --kind feature \
#            --title "what" --notes "why, in a sentence a reader can act on" [--branch dev] [--no-push] [--trailers "Co-Authored-By: …"]
# ═══════════════════════════════════════════════════════════════════════════════

import json
import re
import subprocess
import sys

from datetime import date
from pathlib  import Path


ROOT     = Path(__file__).resolve().parents[2]
KINDS    = ('fix', 'feature', 'refactor', 'docs')
RE_SEMVER = re.compile(r'^\d+\.\d+\.\d+$')


class Release:

    def __init__(self, version, kind, title, notes, branch='dev', push=True, trailers=''):
        self.version  = version
        self.kind     = kind
        self.title    = title
        self.notes    = notes
        self.branch   = branch
        self.push     = push
        self.trailers = trailers.replace('\\n', '\n').strip()                     # extra git trailers (authorship, session), one per line

    def run_cmd(self, *argv, check=True):
        print(f'   $ {" ".join(argv)}')
        return subprocess.run(argv, cwd=ROOT, check=check)

    def backfill_records(self, data):                                           # earlier releases get their commit (from the tag) and their Actions run (from GitHub); the newest at the next release
        runs = {}
        try:
            import urllib.request
            listing = json.loads(urllib.request.urlopen('https://api.github.com/repos/SGit-AI/SGit-AI__Website__Secrets/actions/runs?branch=dev&per_page=50', timeout=20).read())
            runs    = {r['head_sha']: r for r in listing['workflow_runs']}
        except Exception as error:                                               # offline: the records stay as they are and the next release tries again
            print(f'   (could not read the Actions runs: {error})')
        for release in data['releases']:
            tag = f"v{release['version']}"
            release.setdefault('tag', tag)
            if not release.get('commit'):
                sha = subprocess.run(['git', 'rev-list', '-n1', tag], cwd=ROOT, capture_output=True, text=True).stdout.strip()
                release['commit'] = sha or None
            if release.get('commit') and not release.get('run') and release['commit'] in runs:
                run = runs[release['commit']]
                release['run']      = {'id': run['id'], 'url': run['html_url'], 'conclusion': run['conclusion']}
                release['verified'] = {'url': 'https://secrets.sgit.ai/admin/build/version.txt', 'by': 'verify-live in the run above, and admin/build/verify_live.py after the push'} if run['conclusion'] == 'success' else None
            release.setdefault('run', None)
            release.setdefault('verified', None)

    def bump(self):
        (ROOT / 'admin' / 'build' / 'version.txt').write_text(self.version + '\n', encoding='utf-8')
        env = ROOT / 'config' / 'environments.json'
        env.write_text(re.sub(r'"siteVersion": "[^"]+"', f'"siteVersion": "{self.version}"', env.read_text(encoding='utf-8')), encoding='utf-8')
        versions = ROOT / 'data' / 'versions.json'
        data     = json.loads(versions.read_text(encoding='utf-8'))
        if data['releases'] and data['releases'][0]['version'] == self.version:
            data['releases'][0].update({'title': self.title, 'notes': self.notes, 'date': date.today().isoformat()})
        else:
            data['releases'].insert(0, {'version': self.version, 'date': date.today().isoformat(), 'title': self.title, 'notes': self.notes, 'tag': f'v{self.version}', 'commit': None, 'run': None, 'verified': None})
        self.backfill_records(data)
        versions.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'== bumped to v{self.version}')

    def build_and_gate(self):
        print('== build and gate')
        self.run_cmd('python3', 'admin/build/gate.py', '--build')

    def commit(self):
        print('== commit')
        subject = f'site v{self.version} : {self.title}'
        body    = f'{subject}\n\n{self.notes}\n\nKind: {self.kind}\n' + (f'{self.trailers}\n' if self.trailers else '')
        self.run_cmd('git', 'add', '-A')
        self.run_cmd('git', 'commit', '-q', '-F', '-', check=False) if False else subprocess.run(['git', 'commit', '-q', '-F', '-'], cwd=ROOT, input=body, text=True, check=True)
        print(f'   {subject}')

    def push_and_verify(self):
        print(f'== push {self.branch}')
        self.run_cmd('git', 'push', '-u', 'origin', self.branch)
        if self.branch != 'dev':
            print('   pushed a non-release branch; open a pull request to dev, and verify-live runs on the merge')
            return 0
        print('== verify live (the CI run tags and deploys; this waits for the origin)')
        host = (ROOT / 'CNAME').read_text(encoding='utf-8').strip()
        return subprocess.run(['python3', 'admin/build/verify_live.py', '--version', self.version, '--base', f'https://{host}', '--timeout', '900'], cwd=ROOT).returncode

    def run(self):
        if not RE_SEMVER.match(self.version):
            raise SystemExit(f'version {self.version} is not X.Y.Z')
        if self.kind not in KINDS:
            raise SystemExit(f'kind must be one of {KINDS}')
        current = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        if current != self.branch:
            raise SystemExit(f'on branch {current}, expected {self.branch}; pass --branch {current} to release from it')
        self.bump()
        self.build_and_gate()
        self.commit()
        if not self.push:
            print('== --no-push: committed, not pushed')
            return 0
        return self.push_and_verify()


if __name__ == '__main__':
    args = sys.argv[1:]

    def option(name, default=None):
        return args[args.index(name) + 1] if name in args else default

    missing = [name for name in ('--version', '--kind', '--title', '--notes') if name not in args]
    if missing:
        print(f'usage: release.py --version X.Y.Z --kind fix|feature|refactor|docs --title "…" --notes "…" [--branch dev] [--no-push]; missing {missing}')
        sys.exit(2)
    sys.exit(Release(option('--version'), option('--kind'), option('--title'), option('--notes'), option('--branch', 'dev'), '--no-push' not in args, option('--trailers', '')).run())
