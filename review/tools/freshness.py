# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Freshness
# Fails when review/ is older than the code it describes: any derived file
# whose provenance names a tree hash other than the tree being built, or, once
# config.json#changes_required_from names a commit, a commit after it that
# touched source and has no review/changes/<hash>.json. A fresh empty folder
# (no derived files yet) passes and says so. Check 9 of the gate runs this.
# Usage: python3 review/tools/freshness.py [--set self]
# ═══════════════════════════════════════════════════════════════════════════════

import subprocess
import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from review_tree import ROOT, REVIEW, Review__Tree                                # noqa: E402


DERIVED_DIRS = ('graph', 'join', 'changes', 'streams', 'checks')


class Freshness:

    def __init__(self, review_set='project'):
        self.tree   = Review__Tree()
        self.folder = REVIEW if review_set == 'project' else REVIEW / 'self'
        self.label  = review_set

    def derived_files(self):
        found = []
        for name in DERIVED_DIRS:
            folder = self.folder / name
            if folder.exists():
                found += sorted(p for p in folder.glob('*.json') if p.name != 'rules.json')   # rules.json is written by people
        return found

    def stale_files(self):
        current  = self.tree.tree_hash()
        problems = []
        for path in self.derived_files():
            data = self.tree.read_json(path)
            prov = data.get('provenance', {})
            if 'tree_sha256' not in prov:
                problems.append(f'{path.relative_to(ROOT)}: no provenance.tree_sha256')
            elif prov['tree_sha256'] != current and path.parent.name in ('graph', 'join', 'checks'):
                problems.append(f'{path.relative_to(ROOT)}: derived from tree {prov["tree_sha256"][:12]}, the tree is {current[:12]}; re-run the derivation')
        return problems

    def missing_change_files(self):
        since = self.tree.config.get('changes_required_from')
        if not since or self.label != 'project':
            return []
        try:
            log = subprocess.run(['git', 'log', '--format=%H', f'{since}..HEAD'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
        except subprocess.CalledProcessError:
            return [f'cannot list commits since {since}']
        problems = []
        for sha in log:
            touched = subprocess.run(['git', 'show', '--format=', '--name-only', sha], cwd=ROOT, capture_output=True, text=True).stdout.split()
            if any(not self.tree.is_excluded(path) and path in self.tree.source_files() for path in touched):
                if not (self.folder / 'changes' / f'{sha[:7]}.json').exists() and not (self.folder / 'changes' / f'{sha}.json').exists():
                    problems.append(f'commit {sha[:7]} touched source and has no {self.folder.relative_to(ROOT)}/changes/{sha[:7]}.json')
        return problems

    def run(self):
        derived  = self.derived_files()
        problems = self.stale_files() + self.missing_change_files()
        if problems:
            print(f'freshness ({self.label}): {len(problems)} problem(s)')
            for problem in problems:
                print(f'  {problem}')
            return 1
        if not derived:
            print(f'freshness ({self.label}): no derived files yet; a fresh empty folder (tree {self.tree.tree_hash()[:12]}, {len(self.tree.source_files())} source files)')
        else:
            print(f'freshness ({self.label}): {len(derived)} derived file(s) match tree {self.tree.tree_hash()[:12]}')
        return 0


if __name__ == '__main__':
    args = sys.argv[1:]
    sys.exit(Freshness(args[args.index('--set') + 1] if '--set' in args else 'project').run())
