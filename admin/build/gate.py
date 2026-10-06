# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Gate
# The release gate, one command, identical locally and in CI. The CI validate
# job runs exactly this file, so a release that fails here fails the same way
# there. Order matters: the generators run before the gate reads their output.
# Usage: python3 admin/build/gate.py            check everything (what CI does)
#        python3 admin/build/gate.py --build    regenerate, then check everything
# ═══════════════════════════════════════════════════════════════════════════════

import subprocess
import sys

from pathlib import Path


ROOT       = Path(__file__).resolve().parents[2]
GENERATORS = ('gen_features', 'gen_docs', 'gen_chrome', 'gen_versions', 'gen_twins', 'gen_llms')   # in dependency order: reality.md before it is rendered, rendered pages before the chrome


class Gate:

    def __init__(self, build=False):
        self.build = build

    def commands(self):
        flag = [] if self.build else ['--check']
        review = [('python3 review/tools/sections.py' + ('' if self.build else ' --check'), ['python3', 'review/tools/sections.py', *flag]),
                  ('python3 review/tools/readme.py' + ('' if self.build else ' --check'), ['python3', 'review/tools/readme.py', *flag])]
        gens   = [(f'python3 admin/build/{name}.py' + ('' if self.build else ' --check'), ['python3', f'admin/build/{name}.py', *flag]) for name in GENERATORS]
        steps  = gens[:-1] + review + gens[-1:]                                   # the review README hashes the source tree, which the page generators rewrite, so it comes after them; gen_llms last, it concatenates the README
        if self.build:                                                            # after regenerating, prove --check is clean too
            steps += [(f'python3 admin/build/{name}.py --check', ['python3', f'admin/build/{name}.py', '--check']) for name in GENERATORS]
        steps += [('node admin/build/validate.js'       , ['node', 'admin/build/validate.js'                    ]),
                  ('python3 -m pytest tests/build/ -q'  , ['python3', '-m', 'pytest', 'tests/build/', '-q'      ]),
                  ('node --test tests/unit/**/*.test.js', ['node', '--test', 'tests/unit/**/*.test.js'          ])]   # Node 22 takes glob patterns, not a directory
        return steps

    def run(self):
        for label, argv in self.commands():
            print(f'== {label}')
            result = subprocess.run(argv, cwd=ROOT)
            if result.returncode != 0:
                print(f'gate: FAILED at `{label}` (exit {result.returncode})')
                return result.returncode
        print('gate: PASSED')
        return 0


if __name__ == '__main__':
    try:
        import pytest                                                             # noqa: F401  the gate needs it; say how to get it
    except ImportError:
        print('gate: pytest is not installed; run `pip install pytest` (CI does the same)')
        sys.exit(2)
    sys.exit(Gate(build='--build' in sys.argv).run())
