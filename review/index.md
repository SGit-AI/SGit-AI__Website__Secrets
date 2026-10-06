# Review graphs

> The review folder: this project as layered graphs. The design written top down from the brief, the code derived bottom up by parsers, the join between them, every commit read upwards, and a navigator to walk it all. What exists, what each step brings, and where to start.

*Source: <https://secrets.sgit.ai/review/> · site v0.1.12 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.3](/review/ui/#node=claim.review.skeleton) review/: schemas for every layer, the edge vocabulary, freshness by tree hash, a computed README, the fixture repository · [proposed](/review/ui/#node=claim.review.intent) review/intent/: the MVP brief as stories, rules, examples, flows, components and deploy, each node carrying its section, accepted by the project lead · [shipped v0.1.4](/review/ui/#node=claim.review.navigator-walk) The navigator at /review/ui/: walk the intent down and up, with the path as a breadcrumb and every node linked to its section of the brief · [shipped v0.1.7](/review/ui/#node=claim.review.graph-view) The native graph view in the navigator and on every page: the node in focus and its neighbours as an SVG graph, laid out by a small force simulation, no library; and the ladder of layers naming what does not exist yet with its step · [proposed](/review/ui/#node=claim.review.navigator) The rest of the navigator: set switch, join, change, reach, stream, checks, search · [shipped v0.1.11](/review/ui/#node=claim.review.derived) graph/: files, modules, classes, methods, tests and surfaces derived from the syntax tree by parsers, never a model; an index of counts and paths; calls resolved across files and through super() · [proposed](/review/ui/#node=claim.review.changes) Every commit read upwards: changes/<hash>.json with layers moved and held, reach, claim versus evidence · [proposed](/review/ui/#node=claim.review.self) review/self/: the same folder for the tools and the navigator, both sets green before a release

A repository is not only code. `review/` holds this project as graphs, one layer on another: the intent written top down from [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md) (stories, rules, examples; flows; components; the deploy layer), the code derived bottom up from the syntax tree by parsers (never by a model), the join between the two with a coverage figure, every commit read upwards, and the house rules as queries over all of it. The navigator walks the graphs; this page says what is there and what is not yet.

[Open the navigator](/review/ui/)   [review/README.md, with the counts](/review/README.md)   [corrections to the review brief](/review/BRIEF-CORRECTIONS.md)

## The layers, and the step that brings each

| Layer | Where | Written by | State |
|---|---|---|---|
| Stories, rules, examples | `review/intent/stories.json` | the build agent, from the brief; accepted by the project lead | Written at v0.1.4; awaiting the lead's walk (comms N7) |
| Flows and steps | `review/intent/flows.json` | the same | Written at v0.1.4 |
| Components and their edges | `review/intent/components.json` | the same | Written at v0.1.4 |
| Deploy: environments, resources, pipelines, jobs | `review/intent/deploy.json` | the same | Written at v0.1.4 |
| Surfaces, modules, classes, methods | `review/graph/` | parsers over the syntax tree (`review/tools/derive.py`, `derive_js.py`) | Step 2, not yet derived; the ladder in the navigator names it |
| The join and the coverage figure | `review/join/` | the join tool | Step 3 |
| Changes: every commit read upwards | `review/changes/` | `review/tools/change.py`, from the `Kind:` trailer and the diff | Step 4 |
| Streams and lines | `review/streams/` | the source resolver | Step 5 |
| Checks: the house rules as queries | `review/checks/` | `rules.json` by people, results by the tool | Step 6; `rules.json` exists |
| The tool reviewing itself | `review/self/` | the same tools over `review/tools` and `review/ui` | Step 2; the folders exist and are empty |

## How to walk it

1. Open [the navigator](/review/ui/). The ladder on the left lists every layer with its count, and the ones that do not exist yet with the step that brings them.
2. Pick a story in the tree. The right column shows the node, where in the brief it came from (linked to the section), what it is connected to, and above it the graph of its neighbours; click any node in the graph to move.
3. Every content page and mockup on this site names the intent nodes it realises; the reader's column's Graph tab draws them from any page, and its Log tab takes your corrections.
4. Say what is wrong: mark the node's page, leave a note, and send it (the reader's column) or paste the copy to Claude. Each accepted node then records you as its acceptor.

## What the folder holds

- `review/intent/`: the design as data, every node carrying the section of the brief it came from, and `sections.json`, the generated index of the brief's headings the nodes link into.
- `review/tools/`: the schemas for every layer as JSON Schema with a standard-library validator, the edge vocabulary with an inverse for every verb, freshness by tree hash, the README writer, and a fixture repository the tools are tested against.
- `review/ui/`: the navigator as web components in the coding.sgit.ai shape, three files each, no framework, no build step ([ui/README.md](/review/ui/README.md)).
- `review/BRIEF-CORRECTIONS.md`: what the review brief got wrong or left open, numbered, dated.

Check 9 of the gate validates every file in the folder against its schema and fails the build when a derived file is older than the tree it describes. The method is the sgit.ai brief [Code review graphs in the repository](https://sgit.ai/docs/briefs/code-review-graphs-in-the-repository.html).

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/review/)*
