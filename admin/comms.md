# Comms: asks and steps

> The state of play on this site, kept here rather than in a chat message: the asks back to the project lead, numbered, and the nine build steps of the brief with their status and the release that delivered each.

*Source: <https://secrets.sgit.ai/admin/comms.html> · site v0.1.2 (2026-10-05) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

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

## Open questions carried from the brief

Listed and dated at the end of [brief-corrections.md](/docs/design/brief-corrections.md): the Playwright virtual authenticator and PRF, Google's implicit flow, the Security Rules syntax, where Identity Platform stores user records, and whether `sgit pki import` reads a browser-generated bundle.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/admin/comms.html)*
