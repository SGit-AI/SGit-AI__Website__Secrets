# Comms: asks and steps

> The state of play on this site, kept here rather than in a chat message: the asks back to the project lead, numbered, and the nine build steps of the brief with their status and the release that delivered each.

*Source: <https://secrets.sgit.ai/admin/comms.html> · site v0.1.8 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

The state of play, kept on the site rather than in a chat message, in the manner of the sibling sites' comms pages. Numbered so a reply can refer to an item without quoting it.

## Asks back to the project lead

The exact list, with who and which step waits on each, is [docs/ops/needs.md](/docs/ops/needs.md); it is the source and this page points at it rather than copying it. In one line each, as of v0.1.1 (2026-10-05):

| # | Ask | Blocks | Status |
|---|---|---|---|
| N1 | Branch protection on `dev` and `main` with `validate` required | section 9.5; every release from here on arrives by pull request | Open |
| N2 | Hardware-key 2FA for the organisation; `sgit.ai` verified as an organisation domain; the Actions policy | section 9.5; the rows on [/security/](/security/index.md) say "unconfirmed" | Open |
| N3 | A billing account, confirmed project ids, and the bootstrap run once the script exists | step 3 | Open |
| N4 | The Google OAuth client secret for sign-in, as the GitHub environment secret for `dev` | step 3 | Open |
| N5 | Confirm the versioning decision: every release bumps the third digit; the second digit is reserved for a milestone you name (brief-corrections C15) | nothing; recorded as decided on 2026-10-05 | Confirm |
| N6 | Confirm that documents are rendered at build time with the raw markdown one click away, rather than a client-side markdown viewer (C16) | nothing | Confirm |
| N7 | Walk the intent graph at [/review/ui/](/review/ui/) (stories, flows, components, deploy) and send corrections as numbered items; each accepted node then records you as its acceptor | review step 1; coverage counts only accepted nodes | Open |
| N8 | Finish the comms channel: store the vault key and the key passphrase as environment secrets, push the key pair into the vault, publish the contact file, register the lanes, prove one round trip ([docs/ops/comms.md](/docs/ops/comms.md), the four steps) | the reader's column's Send button; until then Copy for Claude | Open |
| N9 | Make an OpenRouter key with a spend limit for the chat on [/reader/](/reader/index.md); it stays in your browser, nothing to store in the repository | nothing; the chat works offline without it | Open |
| N0 | DNS, Pages with the custom domain and HTTPS, and the re-run of the v0.1.0 workflow | step 1 | Done, 2026-10-05 |

## The build order, as it stands

Section 11 of the brief, one row per step, from `data/steps.json`. The planned version is what the brief wrote; releases bump the third digit, so the delivered version differs.

| # | Step | Planned as | Delivered as | Status | Note |
|---|---|---|---|---|---|
| T1 | The pipeline before the site | `v0.1.0` | `v0.1.0` | done | Live at secrets.sgit.ai on 2026-10-05; verify-live green. |
| T2 | Content pages, everything marked proposed; /shipped/; twins; llms.txt; sitemap | `v0.2.0` | `v0.1.1` | done | The documents are rendered to HTML as well; the family nav with grouped menus. |
| T3 | Bootstrap, Terraform, infra.yml, rules, environments.json with dev real; sign in against dev | `v0.3.0` |  | open | Blocked on the GCP items in needs.md (billing, project ids, bootstrap run, OAuth client secret). |
| T4 | PRF probe page; keyring v1 library with KATs; setup and unlock; recovery code | `v0.4.0` |  | open | Not before step 3's probe pages are green on a real dev project. |
| T5 | Entries: kinds, vault list, entry page, copy and reveal, lock timers, merge | `v0.5.0` |  | open |  |
| T6 | Devices page; account export and import; meta.json; matrix page | `v0.6.0` |  | open |  |
| T7 | Admin pages with fixes; rules.yml; new-environment.md timed on a fresh main project | `v0.7.0` |  | open | Not before step 6: the users page needs meta.json. |
| T8 | prod live; homepage demo real; security page final; acceptance test published | `v0.8.0` |  | open |  |
| T9 | Phase 2 data only: public bundle in directory/, inbox rules live | `v0.9.0` |  | open | sgit pki import of the published bundle to verify. |

## The review brief's build order

The ten steps of [Code review graphs in the repository](https://sgit.ai/docs/briefs/code-review-graphs-in-the-repository.html), from the same file. Their corrections file is [review/BRIEF-CORRECTIONS.md](/review/BRIEF-CORRECTIONS.md).

| # | Step | Planned as | Delivered as | Status | Note |
|---|---|---|---|---|---|
| R0 | review/ skeleton, schemas, fixture repository, freshness wired into the gate |  | `v0.1.3` | done | Check 9 of the gate; a stale derived file fails the build, a fresh empty folder passes. |
| R1 | intent/ from the MVP brief, every node carrying its section; the shell and the first components to walk it |  |  | building | Written and walkable at /review/ui/ since v0.1.4; done when the project lead has walked it as a graph and recorded corrections (comms N7). |
| R2 | derive.py for Python (lifted from the vault), derive_js.py for the components, review/self/ built, review-set and review-ladder |  |  | open | The tool reviews itself; both sets open in the navigator. |
| R3 | derive_js.py extended to the site's pages and routes as surfaces; graph/ for the site; review-join |  |  | open | Coverage figure on the README and in the join view, from one script. |
| R4 | change.py, review-change, the moved-layer marking; every commit from here carries a change file |  |  | open |  |
| R5 | stream.py, review-source, review-reach, review-stream: down to source lines, up with hop counts |  |  | open | Story to line in six clicks; method to its stories in two. |
| R6 | check.py with the house rules as queries; review-checks with trend |  |  | open |  |
| R7 | bundle.py; the folder published once as a vault with a read key |  |  | open |  |
| R8 | Delta-first mode applied to sgit.ai's and the CLI's repositories |  |  | open | Not this repository's; listed for completeness. |
| R9 | The components lifted into a repository of their own, served from a versioned path |  |  | open |  |

## Open questions carried from the brief

Listed and dated at the end of [brief-corrections.md](/docs/design/brief-corrections.md): the Playwright virtual authenticator and PRF, Google's implicit flow, the Security Rules syntax, where Identity Platform stores user records, and whether `sgit pki import` reads a browser-generated bundle.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/admin/comms.html)*
