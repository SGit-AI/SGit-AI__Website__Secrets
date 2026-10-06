# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Review__Readme
# Writes review/README.md: what the folder is, the counts per layer, the
# coverage figure, the change-file count, the open gaps and proposals, and how
# to regenerate and read it. Every number is computed here, never typed.
# Usage: python3 review/tools/readme.py [--check]
# ═══════════════════════════════════════════════════════════════════════════════

import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from review_tree import ROOT, REVIEW, Review__Tree                                # noqa: E402


LAYERS = (('stories'    , 'intent/stories.json'    , 'stories'     ),
          ('flows'      , 'intent/flows.json'      , 'flows'       ),
          ('components' , 'intent/components.json' , 'components'  ),
          ('deploy'     , 'intent/deploy.json'     , 'environments'),
          ('files'      , 'graph/files.json'       , 'files'       ),
          ('modules'    , 'graph/modules.json'     , 'modules'     ),
          ('classes'    , 'graph/classes.json'     , 'classes'     ),
          ('methods'    , 'graph/methods.json'     , 'methods'     ),
          ('surfaces'   , 'graph/surfaces.json'    , 'surfaces'    ),
          ('tests'      , 'graph/tests.json'       , 'tests'       ))


class Review__Readme:

    def __init__(self, check=False):
        self.check = check
        self.tree  = Review__Tree()

    def count(self, folder, relative, key):
        path = folder / relative
        if not path.exists():
            return None
        return len(self.tree.read_json(path).get(key, []))

    def intent_counts(self, folder):                                              # stories, rules, examples, and how many are proposed or accepted
        path = folder / 'intent' / 'stories.json'
        if not path.exists():
            return 0, 0, 0, 0
        data = self.tree.read_json(path)
        rules = examples = proposed = 0
        for story in data['stories']:
            proposed += 1 if 'proposed' in story else 0
            for rule in story.get('rules', []):
                rules += 1
                for example in rule.get('examples', []):
                    examples += 1
        return len(data['stories']), rules, examples, proposed

    def coverage(self, folder):
        path = folder / 'join' / 'matches.json'
        if not path.exists():
            return None
        return self.tree.read_json(path)['coverage']

    def section(self, label, folder):
        stories, rules, examples, proposed = self.intent_counts(folder)
        accepted = 'accepted' if (folder / 'intent' / 'stories.json').exists() and self.tree.read_json(folder / 'intent' / 'stories.json')['provenance']['accepted_by'] else 'not yet accepted'
        coverage = self.coverage(folder)
        changes  = len(list((folder / 'changes').glob('*.json'))) if (folder / 'changes').exists() else 0
        streams  = len(list((folder / 'streams').glob('*.json'))) if (folder / 'streams').exists() else 0
        gaps     = self.count(folder, 'join/gaps.json', 'gaps')
        lines    = [f'## {label}', '',
                    f'| Layer | Count |', '|---|---|',
                    f'| stories | {stories} ({accepted}; {proposed} proposed by a model) |',
                    f'| rules | {rules} |', f'| examples | {examples} |']
        for name, relative, key in LAYERS[1:]:
            value = self.count(folder, relative, key)
            lines.append(f'| {name} | {"not derived yet" if value is None else value} |')
        claims = self.tree.read_json(folder / 'intent' / 'claims.json') if (folder / 'intent' / 'claims.json').exists() else None
        if claims is not None:
            shipped = sum(1 for c in claims['claims'] if c['status'] == 'shipped')
            lines.append(f'| claims | {len(claims["claims"])} ({shipped} shipped, every one with evidence that resolves; strict) |')
            lines.append(f'| releases | {len(claims["releases"])} |')
            lines.append(f'| anchors | {len(claims["anchors"])} (files, tests, sections, documents, URLs, commits, tags, runs: where a chain ends) |')
        brief = self.tree.read_json(REVIEW / 'brief' / 'index.json') if folder == REVIEW and (REVIEW / 'brief' / 'index.json').exists() else None
        if brief is not None:
            lines.append(f'| brief sections | {len(brief["sections"])} top-level, {sum(len(s["subsections"]) for s in brief["sections"])} subsections, as review/brief/ |')
        figure = 'not computed yet: the join runs from step 3' if coverage is None else f'{coverage["figure"]:.1%} ({coverage["matched"]} of {coverage["projected"]})'
        lines += ['',
                  f'Coverage (projected nodes with a derived match beneath them): {figure}.',
                  f'Change files: {changes}. Streams: {streams}. Open gaps: {"none recorded yet" if gaps is None else gaps}.', '']
        return lines

    def markdown(self):
        tree_hash = self.tree.tree_hash()
        sources   = self.tree.source_files()
        lines = ['# review/: the project as layered graphs', '',
                 '*Generated by `review/tools/readme.py`; every number here is computed. The folder follows '
                 '[Code review graphs in the repository](https://sgit.ai/docs/briefs/code-review-graphs-in-the-repository.html); '
                 'where that brief was wrong for this repository, `BRIEF-CORRECTIONS.md` says so.*', '',
                 'What is here: `intent/` is the design written top down from the MVP brief (by an agent, accepted by a person, each node '
                 'carrying its section); `graph/` is the code derived bottom up from the syntax tree by parsers, never by a model; `join/` is '
                 'the match between the two with a coverage figure; `changes/` reads one commit upwards per file; `streams/` is the code on one '
                 'path; `checks/` is the house rules as queries over the graph; `ui/` is the navigator, web components in the coding.sgit.ai '
                 'shape; `self/` is the same folder for the tools and the navigator themselves. Nothing under `graph/`, `join/`, `changes/`, '
                 '`streams/` or `checks/results.json` is edited by hand.', '',
                 f'Source tree: {len(sources)} files, hash `{tree_hash[:16]}`. Derived files must carry this hash in their provenance or the gate fails (`tools/freshness.py`).', '']
        lines += self.section('The project', REVIEW)
        lines += self.section('The tool (review/self/)', REVIEW / 'self')
        lines += ['## Regenerate and check', '',
                  '```', 'python3 review/tools/sections.py             # the brief\'s section anchors, for the links from every intent node',
                  'python3 review/tools/brief.py                # the brief as sections, review/brief/, shown in place by the navigator',
                  'python3 review/tools/claims.py               # the claims layer from data/features.json and data/versions.json; strict on evidence',
                  'python3 review/tools/validate_review.py      # every JSON file against its schema; every edge a known verb',
                  'python3 review/tools/freshness.py            # derived files match the tree being built',
                  'python3 review/tools/readme.py               # this file',
                  'python3 -m http.server 8000                   # then open http://localhost:8000/review/ for the navigator', '```', '',
                  'The gate runs the first two as check 9 and the third as a generator, so a stale or malformed folder fails the build.', '',
                  '*Code Apache-2.0, content CC BY 4.0.*', '']
        return '\n'.join(lines)

    def run(self):
        path    = REVIEW / 'README.md'
        text    = self.markdown()
        current = path.read_text(encoding='utf-8') if path.exists() else None
        if current == text:
            print('readme: current')
            return 0
        if self.check:
            print('readme --check: review/README.md is out of date; run python3 review/tools/readme.py')
            return 1
        path.write_text(text, encoding='utf-8')
        print('readme: updated review/README.md')
        return 0


if __name__ == '__main__':
    sys.exit(Review__Readme(check='--check' in sys.argv).run())
