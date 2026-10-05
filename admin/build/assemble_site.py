# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Assemble__Site
# Copies the deployable tree into _site/ for the Pages artifact: everything
# except .git, .github, infra, tests/unit and node_modules (section 9.1 of the
# brief). The exclude list lives here and nowhere else; the deploy job calls
# this file so the same tree can be assembled and inspected locally.
# Usage: python3 admin/build/assemble_site.py [--out _site]
# ═══════════════════════════════════════════════════════════════════════════════

import shutil
import sys

from pathlib import Path


ROOT     = Path(__file__).resolve().parents[2]
EXCLUDED = ('.git', '.github', 'infra', 'tests/unit', 'node_modules', '_site', '__pycache__', '.pytest_cache')


class Assemble__Site:

    def __init__(self, out='_site'):
        self.out = ROOT / out

    def excluded(self, path):
        relative = path.relative_to(ROOT).as_posix()
        if any(part in ('__pycache__', '.pytest_cache') for part in path.relative_to(ROOT).parts):
            return True
        return any(relative == item or relative.startswith(item + '/') for item in EXCLUDED)

    def run(self):
        if self.out.exists():
            shutil.rmtree(self.out)
        copied = 0
        for path in sorted(ROOT.rglob('*')):
            if not path.is_file() or self.excluded(path):
                continue
            target = self.out / path.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            copied += 1
        print(f'assembled {copied} files into {self.out.relative_to(ROOT)}/ (excluding {", ".join(EXCLUDED)})')
        return 0


if __name__ == '__main__':
    args = sys.argv[1:]
    out  = args[args.index('--out') + 1] if '--out' in args else '_site'
    sys.exit(Assemble__Site(out=out).run())
