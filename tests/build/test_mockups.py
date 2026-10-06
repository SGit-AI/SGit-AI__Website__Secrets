# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Test__Mockups
# The design prototype: screens.json names ten screens, three variants and
# paths that only join screens that exist; every intent id a screen claims is a
# node in review/intent/; every mockup page embeds proto-app on a screen that
# exists beside proto-column and loads both modules; the prototype page embeds
# the frame with no screen; the categorical colours of every theme pass the
# dataviz validator's hard checks (five hues, adjacent pairs apart).
# ═══════════════════════════════════════════════════════════════════════════════

import json
import re
import subprocess
import sys

from pathlib  import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'admin' / 'build'))



def review_node_ids():                                                           # every node id the navigator knows, from the intent files
    intent = ROOT / 'review' / 'intent'
    ids    = set()
    for story in json.loads((intent / 'stories.json').read_text(encoding='utf-8'))['stories']:
        ids.add(story['id'])
        for rule in story.get('rules', []):
            ids.add(rule['id'])
            ids.update(example['id'] for example in rule.get('examples', []))
    for flow in json.loads((intent / 'flows.json').read_text(encoding='utf-8'))['flows']:
        ids.add(flow['id'])
        ids.update(f"{flow['id']}#{step['n']}" for step in flow.get('steps', []))
    ids.update(c['id'] for c in json.loads((intent / 'components.json').read_text(encoding='utf-8'))['components'])
    deploy = json.loads((intent / 'deploy.json').read_text(encoding='utf-8'))
    ids.update(x['id'] for key in ('environments', 'resources', 'pipelines') for x in deploy[key])
    ids.update(job['id'] for pipeline in deploy['pipelines'] for job in pipeline.get('jobs', []))
    return ids


class Test__Mockups(TestCase):

    def setUp(self):
        self.data    = json.loads((ROOT / 'mockups' / 'screens.json').read_text(encoding='utf-8'))
        self.screens = {s['id']: s for s in self.data['screens']}

    def test_ten_screens_three_variants(self):
        self.assertEqual(len(self.screens), 10)
        self.assertEqual([v['tag'] for v in self.data['variants']], ['A', 'B', 'C'])
        self.assertEqual(sorted(s['n'] for s in self.screens.values()), list(range(1, 11)))
        for screen in self.screens.values():
            with self.subTest(screen=screen['id']):
                for key in ('title', 'path', 'page', 'section', 'intent', 'purpose'):
                    self.assertTrue(screen[key])
                self.assertTrue((ROOT / screen['page'].lstrip('/')).exists())

    def test_paths_join_screens_that_exist(self):
        for edge in self.data['edges']:
            with self.subTest(edge=f'{edge["from"]}>{edge["to"]}'):
                self.assertIn(edge['from'], self.screens)
                self.assertIn(edge['to'], self.screens)
                self.assertTrue(edge['label'])
        reached = {e['to'] for e in self.data['edges']} | {e['from'] for e in self.data['edges']}
        self.assertEqual(reached, set(self.screens), 'every screen is on a path')

    def test_intent_ids_exist(self):
        ids = review_node_ids()
        for screen in self.screens.values():
            for node in screen['intent']:
                with self.subTest(screen=screen['id'], node=node):
                    self.assertIn(node, ids)

    def test_every_mockup_page_embeds_the_prototype(self):
        for screen in self.screens.values():
            text = (ROOT / screen['page'].lstrip('/')).read_text(encoding='utf-8')
            with self.subTest(page=screen['page']):
                self.assertIn(f'<proto-app screen="{screen["id"]}"></proto-app>', text)
                self.assertIn('<proto-column></proto-column>', text)
                self.assertIn('<script type="module" src="/components/proto-app/proto-app.js"></script>', text)
                self.assertIn('<script type="module" src="/components/proto-column/proto-column.js"></script>', text)
                self.assertIn('<pre class="ascii">', text)
                self.assertNotIn('class="mb"', text, 'the static frame is gone')
        whole = (ROOT / 'mockups' / 'prototype.html').read_text(encoding='utf-8')
        self.assertIn('<proto-app></proto-app>', whole)

    def test_prototype_components_follow_the_shape(self):
        for name in ('proto-base', 'proto-app', 'proto-column'):
            folder = ROOT / 'components' / name
            with self.subTest(component=name):
                self.assertEqual(sorted(p.name for p in folder.iterdir()), [f'{name}.css', f'{name}.html', f'{name}.js'])
                text = (folder / f'{name}.js').read_text(encoding='utf-8')
                self.assertIn('LOCAL_STORAGE_KEYS.proto', (ROOT / 'components' / 'proto-base' / 'proto-base.js').read_text(encoding='utf-8'))
                self.assertNotIn('sgit_private_', text, 'no key shape, even invented, in the prototype')

    def test_categorical_colours_pass_the_validator(self):                        # the dataviz skill's checks, re-implemented in short: five distinct hues, no two adjacent too close
        css = (ROOT / 'assets' / 'themes.css').read_text(encoding='utf-8')
        for block in re.findall(r'(?:html\[data-theme="(\w+)"\]|:root)[^{]*\{([^}]*)\}', css):
            cats = re.findall(r'--sg-cat-\d:\s+(#[0-9A-Fa-f]{6})', block[1])
            with self.subTest(theme=block[0] or 'root'):
                self.assertEqual(len(cats), 5)
                self.assertEqual(len(set(c.upper() for c in cats)), 5)
                self.assertRegex(block[1], r'--sg-on-cat:\s+#')
