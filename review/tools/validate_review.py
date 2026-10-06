# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Validate__Review
# The schema checks: every JSON file under review/ and review/self/ validates
# against the schema for its shape, every edge uses a verb from verbs.json,
# every node id in a file is unique, and every edge endpoint resolves to a
# node in the folder's layers. Standard library only.
# Usage: python3 review/tools/validate_review.py
# ═══════════════════════════════════════════════════════════════════════════════

import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from review_tree import ROOT, REVIEW, Review__Tree                                # noqa: E402
from schema      import Schema__Validator                                         # noqa: E402


SCHEMAS   = REVIEW / 'tools' / 'schemas'
SHAPES    = {'intent/stories.json'    : 'intent-stories'   , 'intent/flows.json'    : 'intent-flows'    , 'intent/sections.json' : 'intent-sections' ,
             'intent/components.json' : 'intent-components', 'intent/deploy.json'   : 'intent-deploy'   ,
             'graph/files.json'       : 'graph-files'      , 'graph/methods.json'   : 'graph-methods'   ,
             'graph/classes.json'     : 'graph-classes'    , 'graph/modules.json'   : 'graph-modules'   ,
             'graph/surfaces.json'    : 'graph-surfaces'   , 'graph/tests.json'     : 'graph-tests'     ,
             'graph/deploy.json'      : 'graph-deploy'     , 'graph/stories.json'   : 'graph-stories'   ,
             'join/matches.json'      : 'join-matches'     , 'join/gaps.json'       : 'join-gaps'       ,
             'checks/rules.json'      : 'checks-rules'     , 'checks/results.json'  : 'checks-results'  }
PREFIXES  = {'changes/' : 'change', 'streams/' : 'stream'}
COLLECTIONS = ('stories', 'flows', 'components', 'environments', 'resources', 'pipelines', 'files', 'methods', 'classes', 'modules', 'surfaces', 'tests', 'nodes')


class Validate__Review:

    def __init__(self):
        self.tree  = Review__Tree()
        self.verbs = set(self.tree.read_json(REVIEW / 'tools' / 'verbs.json')['verbs'])

    def schema_for(self, relative):
        if relative in SHAPES:
            return SHAPES[relative]
        for prefix, name in PREFIXES.items():
            if relative.startswith(prefix):
                return name
        return None

    def node_ids(self, data):                                                     # every node id a file defines, including nested rules, examples, steps
        ids = []
        def walk(item):
            if isinstance(item, dict):
                if 'id' in item and isinstance(item['id'], str) and ('name' in item or 'text' in item):
                    ids.append(item['id'])
                for value in item.values():
                    walk(value)
            elif isinstance(item, list):
                for value in item:
                    walk(value)
        for key in COLLECTIONS:
            if key in data:
                walk(data[key])
        return ids

    def check_folder(self, folder):
        problems = []
        known    = set()
        edges    = []
        for path in sorted(folder.rglob('*.json')):
            if 'tools' in path.relative_to(folder).parts or path.parent.name == 'self' and folder.name != 'self':
                continue
            relative = path.relative_to(folder).as_posix()
            if relative.startswith('self/'):
                continue
            name = self.schema_for(relative)
            if name is None:
                problems.append(f'{path.relative_to(ROOT)}: no schema for this path')
                continue
            data   = self.tree.read_json(path)
            schema = self.tree.read_json(SCHEMAS / f'{name}.schema.json')
            for problem in Schema__Validator(schema).validate(data):
                problems.append(f'{path.relative_to(ROOT)}: {problem}')
            ids = self.node_ids(data)
            seen = set()
            for node_id in ids:
                if node_id in seen:
                    problems.append(f'{path.relative_to(ROOT)}: duplicate node id {node_id}')
                seen.add(node_id)
            known |= seen
            for edge in data.get('edges', []):
                edges.append((path.relative_to(ROOT), edge))
        for where, edge in edges:
            if edge.get('verb') not in self.verbs:
                problems.append(f'{where}: edge verb "{edge.get("verb")}" is not in review/tools/verbs.json')
            for end in ('from', 'to'):
                if edge.get(end) not in known:
                    problems.append(f'{where}: edge {end} "{edge.get(end)}" is not a node in this review set')
        return problems

    def run(self):
        problems = self.check_folder(REVIEW) + self.check_folder(REVIEW / 'self')
        for verb, spec in self.tree.read_json(REVIEW / 'tools' / 'verbs.json')['verbs'].items():
            if spec['inverse'] not in self.verbs:
                problems.append(f'verbs.json: {verb} names inverse {spec["inverse"]}, which is not defined')
            if spec['inverse'] == verb:
                problems.append(f'verbs.json: {verb} is its own inverse; the grammar needs a distinct one')
        if problems:
            print(f'validate_review: {len(problems)} problem(s)')
            for problem in problems:
                print(f'  {problem}')
            return 1
        print('validate_review: every review file validates; every edge uses a known verb and resolves')
        return 0


if __name__ == '__main__':
    sys.exit(Validate__Review().run())
