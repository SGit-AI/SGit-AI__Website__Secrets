# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Generators__Check
# Every generator, run on the real tree with --check, reports nothing stale.
# No mocks: the generators are tested by running them.
# ═══════════════════════════════════════════════════════════════════════════════

import subprocess
import sys

from pathlib  import Path
from unittest import TestCase


ROOT       = Path(__file__).resolve().parents[2]
GENERATORS = ('gen_features', 'gen_docs', 'gen_chrome', 'gen_versions', 'gen_twins', 'gen_llms')


class Test__Generators__Check(TestCase):

    def run_generator(self, name, *flags):
        return subprocess.run([sys.executable, f'admin/build/{name}.py', *flags], cwd=ROOT, capture_output=True, text=True)

    def test_every_generator_is_current(self):
        for name in GENERATORS:
            with self.subTest(generator=name):
                result = self.run_generator(name, '--check')
                self.assertEqual(result.returncode, 0, f'{name} --check:\n{result.stdout}{result.stderr}')
                self.assertIn('0 ', result.stdout)                                # "0 page(s) stale" / "0 file(s) stale"

    def test_generators_are_idempotent(self):
        for name in GENERATORS:
            with self.subTest(generator=name):
                first  = self.run_generator(name)
                second = self.run_generator(name, '--check')
                self.assertEqual(first.returncode , 0, first.stdout + first.stderr)
                self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
                self.assertIn('0 ', first.stdout, f'{name} rewrote files on a tree that --check called current')

    def test_validate_js_passes_on_the_tree(self):
        result = subprocess.run(['node', 'admin/build/validate.js'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('8/8 checks passed', result.stdout)
