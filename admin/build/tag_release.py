# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Tag__Release
# The tag-release job. Reads admin/build/version.txt, finds the newest commit
# whose subject reads "site vX.Y.Z : what", asserts the two agree, asserts the
# version is the next minor (or a patch, or a deliberate major .0.0) after the
# newest existing tag, backfills any historical release that has no tag, and
# pushes the tags. Idempotent: a tag that already points at the right commit is
# left alone; one that points elsewhere is a failure, never moved.
# Usage: python3 admin/build/tag_release.py [--dry-run] [--remote origin] [--no-push]
# ═══════════════════════════════════════════════════════════════════════════════

import re
import subprocess
import sys

from pathlib import Path


ROOT        = Path(__file__).resolve().parents[2]
VERSION_RE  = re.compile(r'^site v(\d+\.\d+\.\d+) : .+')


class Tag__Release:

    def __init__(self, dry_run=False, remote='origin', push=True):
        self.dry_run = dry_run
        self.remote  = remote
        self.push    = push
        self.version = (ROOT / 'admin' / 'build' / 'version.txt').read_text(encoding='utf-8').strip()

    def git(self, *args, check=True):
        result = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)
        if check and result.returncode != 0:
            raise SystemExit(f'git {" ".join(args)} failed:\n{result.stderr.strip()}')
        return result.stdout

    def release_commits(self):                                                     # newest first: [(sha, version, subject)]
        found = []
        for line in self.git('log', '--format=%H%x09%s', 'HEAD').splitlines():
            sha, _, subject = line.partition('\t')
            match = VERSION_RE.match(subject)
            if match:
                found.append((sha, match.group(1), subject))
        return found

    def existing_tags(self):                                                       # {version: sha}
        tags = {}
        for line in self.git('tag', '--list', 'v*', '--format=%(refname:strip=2)%09%(*objectname)%09%(objectname)').splitlines():
            name, _, rest = line.partition('\t')
            peeled, _, plain = rest.partition('\t')
            tags[name[1:]] = peeled or plain
        return tags

    @staticmethod
    def as_tuple(version):
        return tuple(int(part) for part in version.split('.'))

    @staticmethod
    def next_version_ok(previous, nxt):
        if previous is None:
            return True
        pM, pm, pp = previous
        nM, nm, np = nxt
        return ((nM == pM and nm == pm + 1 and np == 0) or
                (nM == pM and nm == pm and np == pp + 1) or
                (nM == pM + 1 and nm == 0 and np == 0))

    def run(self):
        commits = self.release_commits()
        if not commits:
            raise SystemExit('no commit on this branch has a subject of the form "site vX.Y.Z : what"')
        head_sha, head_version, head_subject = commits[0]
        print(f'version.txt     : {self.version}')
        print(f'release commit  : {head_sha[:10]} "{head_subject}"')
        if head_version != self.version:
            raise SystemExit(f'version.txt says {self.version} but the newest release subject says {head_version}')

        tags     = self.existing_tags()
        previous = max((self.as_tuple(v) for v in tags if v != self.version), default=None)
        print(f'newest tag      : {"v" + ".".join(map(str, previous)) if previous else "(none)"}')
        if self.version in tags:
            if tags[self.version] != head_sha:
                raise SystemExit(f'tag v{self.version} already exists at {tags[self.version][:10]}, not at {head_sha[:10]}; tags are never moved')
            print(f'tag v{self.version} already points at the release commit')
        elif not self.next_version_ok(previous, self.as_tuple(self.version)):
            raise SystemExit(f'v{self.version} is not the next minor, a patch, or a major .0.0 after the newest tag')

        to_create = [(sha, version, subject) for sha, version, subject in reversed(commits) if version not in tags]
        for sha, version, subject in to_create:
            print(f'{"would tag" if self.dry_run else "tagging"}   v{version} -> {sha[:10]}  ({subject})')
            if not self.dry_run:
                self.git('tag', '-a', f'v{version}', sha, '-m', subject)
        if not to_create:
            print('nothing to tag')
            return 0
        if self.push and not self.dry_run:
            refs = [f'refs/tags/v{version}' for _, version, _ in to_create]
            self.git('push', self.remote, *refs)
            print(f'pushed {len(refs)} tag(s) to {self.remote}')
        return 0


if __name__ == '__main__':
    args   = sys.argv[1:]
    remote = args[args.index('--remote') + 1] if '--remote' in args else 'origin'
    sys.exit(Tag__Release(dry_run='--dry-run' in args, remote=remote, push='--no-push' not in args).run())
