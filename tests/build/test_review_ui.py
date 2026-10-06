# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Review__UI
# The navigator follows the coding.sgit.ai shape: three files per component
# with the same basename, the base contract in every component, no literal
# colour outside tokens.css, no inline handlers, data-* for behaviour, every
# interactive element a real control, the CSP on the shell, every component
# the README lists present, and every script parses.
# ═══════════════════════════════════════════════════════════════════════════════

import re
import subprocess

from pathlib  import Path
from unittest import TestCase


ROOT       = Path(__file__).resolve().parents[2]
UI         = ROOT / 'review' / 'ui'
COMPONENTS = UI / 'components'
RE_COLOUR  = re.compile(r'#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(')


class Test__Review__UI(TestCase):

    def components(self):
        return sorted(p for p in COMPONENTS.iterdir() if p.is_dir())

    def test_three_files_per_component_same_basename(self):
        for folder in self.components():
            with self.subTest(component=folder.name):
                files = sorted(p.name for p in folder.iterdir())
                self.assertEqual(files, [f'{folder.name}.css', f'{folder.name}.html', f'{folder.name}.js'])

    def test_base_contract_in_every_component(self):
        for folder in self.components():
            text = (folder / f'{folder.name}.js').read_text(encoding='utf-8')
            with self.subTest(component=folder.name):
                self.assertIn('static jsUrl = import.meta.url', text)
                self.assertIn(f"customElements.define('{folder.name}'", text)
                self.assertIn('@module', text)
                self.assertNotIn('connectedCallback', text) if folder.name != 'review-base' else None
                self.assertIn('get resourceName()', text)
                self.assertNotIn(';\n', text, 'the house writes JavaScript without semicolons')

    def test_no_colour_outside_tokens(self):
        for path in UI.rglob('*.css'):
            if path.name == 'tokens.css':
                continue
            with self.subTest(file=path.relative_to(ROOT).as_posix()):
                self.assertIsNone(RE_COLOUR.search(path.read_text(encoding='utf-8')))
        for path in UI.rglob('*.js'):
            with self.subTest(file=path.relative_to(ROOT).as_posix()):
                self.assertIsNone(RE_COLOUR.search(path.read_text(encoding='utf-8')))

    def test_markup_is_a_fragment_with_real_controls(self):
        for folder in self.components():
            text = (folder / f'{folder.name}.html').read_text(encoding='utf-8')
            with self.subTest(component=folder.name):
                self.assertNotIn('<html', text)
                self.assertNotIn('<style', text)
                self.assertNotRegex(text, r'\son[a-z]+=', 'no inline handlers')
                self.assertNotRegex(text, r'<div[^>]*\bonclick', 'a div is not a control')

    def test_shell_has_csp_and_no_inline_code(self):
        text = (UI / 'index.html').read_text(encoding='utf-8')
        self.assertIn('Content-Security-Policy', text)
        self.assertIn("script-src 'self'", text)
        self.assertNotIn('<style', text)
        self.assertNotRegex(text, r'<script\b(?![^>]*\bsrc=)')
        self.assertNotRegex(text, r'\bstyle\s*=')
        self.assertIn('data-version', text)

    def test_route_never_assigns_location_hash(self):
        for path in UI.rglob('*.js'):
            with self.subTest(file=path.relative_to(ROOT).as_posix()):
                self.assertNotRegex(path.read_text(encoding='utf-8'), r'location\.hash\s*=')

    def test_readme_lists_every_component_present(self):
        readme = (UI / 'README.md').read_text(encoding='utf-8')
        for folder in self.components():
            with self.subTest(component=folder.name):
                self.assertIn(f'`{folder.name}`', readme)

    def test_scripts_parse(self):
        for path in UI.rglob('*.js'):
            result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
            with self.subTest(file=path.relative_to(ROOT).as_posix()):
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_sections_index_matches_the_brief(self):
        result = subprocess.run(['python3', 'review/tools/sections.py', '--check'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
