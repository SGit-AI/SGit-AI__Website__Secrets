# Review brief corrections

*secrets.sgit.ai · where [Code review graphs in the repository](https://sgit.ai/docs/briefs/code-review-graphs-in-the-repository.html) was wrong or left open for this repository, found while building, dated · the brief says it will be corrected from this file · CC BY 4.0*

The MVP brief has its own file, `docs/design/brief-corrections.md`. This one is for the review brief only.

## v0.1.3 (2026-10-06): step 0, the skeleton

### R1. The first "new project" already had source files

Section 2 says a project that begins after the brief writes `review/intent/` before the first source file exists, and names this repository as the first. The repository had shipped three releases (v0.1.0 to v0.1.2) with about sixty source files before the brief was published on 6 October 2026. The full-coverage mode still applies, because sixty files derive in seconds, so the folder is built as a new project: intent first (step 1), then every file derived on every release (step 2). The only consequence is that there was a period of three releases in which the code outran the graph, and this entry records it.

### R2. `review-base` is a sibling of the tools' `SgComponent`, not an import

Section 7 leaves open whether the base component imports the tools' `SgComponent` from its versioned CDN path. This repository's rule P4 (no runtime script from any origin but this site) and check 5 of its gate forbid the import, so `review-base` is written beside it with the same contract (`static jsUrl = import.meta.url`, `resourceName`, `sharedCssPaths`, `onReady()`), as the brief proposes. When the components move to a repository of their own (step 9) the question can be reopened there.

### R3. The schemas are JSON Schema, checked by a small validator of our own

Section 10 step 0 asks for the schemas as JSON Schema files. The gate has no dependencies, so `tools/schema.py` is a standard-library validator for the subset the schemas use (type, required, properties, additionalProperties, items, enum, const, minItems, pattern, anyOf, $ref within the file). A schema construct outside that subset is a bug the tests catch, not a silent pass.

### R4. The claim comes from a `Kind:` trailer, because the subject is already spoken for

Section 6 takes the claim from the commit message's first word or a `Kind:` trailer. This repository's subjects are `site vX.Y.Z : what` by the release rule, so the first word is always `site`. Every commit from step 4 on carries a `Kind: fix|feature|refactor|docs` trailer, and `change.py` reads that; a commit without one is read as `unknown` and reported as such.

### R5. Freshness compares a tree hash, not timestamps

Section 8 says a derived folder older than the tree it describes fails. File times are not stable across clones and checkouts, so `freshness.py` compares the `tree_sha256` in each derived file's provenance (a hash over every source file's path and content) with the tree being built. The set of source files is `tools/config.json`, so a new kind of source file is a one-line change there, recorded in this file when it happens.

### R6. The edge vocabulary is in one file and the validator refuses any other verb

Section 3 says the grammar may not change and the layers may add types. To keep the graphs honest to the grammar's first rule (every edge a verb with a distinct inverse), `tools/verbs.json` holds the only verbs any layer may use, each with its inverse, a sentence, a domain and a range, and `validate_review.py` fails on an edge whose verb is not there or whose ends do not resolve to nodes. Six of the verbs are from the established edge set at graphs.sgit.ai; the rest are this folder's and are marked as not established.

## v0.1.4 (2026-10-06): step 1, the intent graph

### R7. A section index links each node to the rendered brief

Section 3 says every projected node carries `{"doc", "section"}`. For the link in the navigator to land on the heading, the page's anchor for a section number has to be known, and the markdown renderer's slugs are not derivable from the number alone. `tools/sections.py` writes `intent/sections.json`, every numbered heading of the brief with its anchor and title, with the same slug rule the renderer uses; the gate keeps it current. It is a derived file under `intent/` because it describes the brief, not the code, and it carries no provenance block because it has no tree hash to carry.

### R8. Flow steps are nodes with generated ids

Section 5 describes flows as ordered steps naming surfaces, with no id per step. The navigator needs every node addressable, so a step's id is `<flow id>#<n>`, assigned by the store when it indexes the file; the JSON keeps steps as the brief describes them. A step therefore cannot be the target of an edge in the files, only of the implicit containment the store adds.

### R9. The first view switch is in the tree, not a ladder

Section 7 puts the layers on `review-ladder` in the left rail. The ladder arrives with step 2, when there are derived layers to count; until then `review-tree` carries four view buttons for the intent layers so the graph can be walked at all. The buttons move to the ladder at step 2 and this entry is closed then.

## Open, to be answered as the steps are built

- The JavaScript parser (section 12): decided in principle as a vendored, pinned, hashed `acorn` under `review/tools/vendor/`; verified at step 2.
- How examples are matched to tests by execution in a browser-only project (section 12): the proposal stands, a test page writes which example ids it satisfied to a results file; built at step 3.
- Whether the deploy layer is derived from the workflow and Terraform files or declared (section 12): both, with the join reporting the difference; step 3.
