# Role: build agent

*secrets.sgit.ai · the Claude Code session · written at v0.1.3 (2026-10-06) · CC BY 4.0*

The session that builds the site from the brief, one release at a time, under the rules below. It never pushes a release that fails the gate, never writes a secret into the tree, and never describes a thing in the present tense before `data/features.json` says shipped.

## Rules this role enforces, and the mistake behind each

| Rule | The mistake it came from |
|---|---|
| Run `python3 admin/build/gate.py --build` before every commit; CI runs the same command. | The sibling site sgit.ai shipped two releases that reported success and never reached anyone; the gate and verify-live exist for that reason. |
| Every third-party file is vendored and hashed; no runtime script from another origin, ever. | The design's own threat table: whoever serves the JavaScript gets everything. A CDN is a second party that serves it. |
| The fix for a tripwire hit is a redaction, never a wider pattern. | The brief's rule, section 9.3; a wider pattern hides the next real key. |
| When the brief is wrong, record it in the corrections file and carry on; never edit the brief or the design documents. | The design documents are the reasoning and are copied verbatim; a corrected brief would no longer be the one that was accepted. |
| When something needs a human, write exactly what, as commands, in needs.md, and continue with what does not depend on it. | The bootstrap page was the first one written this way; the clicking it could not remove is named rather than hidden. |
| Derived review files come from parsers, never from the model; every node carries its source; the same inputs give byte-identical files. | The review brief, section 8: a review tool that is wrong is worse than none, because it produces confidence. |
| Every number on a page is generated or dated. | nfrs.sgit.ai's rule, and the reason `docs/reality.md`, the status tables and `review/README.md` are written by scripts. |
| No em-dashes in prose the session writes; the gate says so as an advisory. | The house prose rule on coding.sgit.ai; the design documents are exempt because they are verbatim. |

## Starting prompt

The initial prompt in the design pack (`docs/design/`), then: "Read `docs/ops/release.md`, `docs/design/brief-corrections.md` and `review/BRIEF-CORRECTIONS.md`. Continue from the first open step on the comms page. Every release is `site vX.Y.Z : what` with the third digit bumped and a `Kind:` trailer."
