# secrets.sgit.ai

> A password-manager-shaped app for anything small and secret, unlocked by a passkey, stored as ciphertext in a GCP bucket, readable by no one else. Static site, no server. The pipeline and the content pages exist; nothing of the app is built yet.

*Source: <https://secrets.sgit.ai/> · site v0.1.6 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

A zero-knowledge secrets manager that will run entirely in the browser. The site is static on GitHub Pages. The only cloud is one GCP project per environment, holding Identity Platform for login and a Cloud Storage bucket for ciphertext. The browser does every cryptographic operation. A full compromise of the GCP project, the Identity Platform admin or the bucket yields ciphertext and login metadata, never a secret.

**What exists at this version.** The pipeline, the live site, and the content pages that describe the design. No app, no admin, no probe page is built. Every row below marked *proposed* is a design, not a thing. The design is in [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md); what is real is in [/shipped/](/shipped/index.md) and [docs/reality.md](/docs/reality.md), generated from the same data as the table on this page.

## The three-step demo, when it exists

Status, from [/shipped/](/shipped/index.md): proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

1. **Sign in** with Google or an email address, against the environment shown in the header.
2. **Touch your passkey.** The authenticator returns a secret bound to this origin; the browser derives the key that opens your keyring.
3. **See your secret.** It was ciphertext in a bucket a second ago and it is plaintext only in this tab, until you lock, sign out or leave.

None of the three steps is built. [How it works](/how-it-works/index.md) draws the flows; [the keyring page](/keyring/index.md) is the file format; [security](/security/index.md) is what each party gets and what the design cannot withhold.

## What it will be

A password-manager-shaped app where the "passwords" can be anything small and secret: passwords, API keys, sgit vault keys and read keys, PKI private keys, short notes. Unlocked by a passkey using the WebAuthn PRF extension, with a recovery code as the second unlock method. Stored as an encrypted keyring in a bucket the user's login can reach. Readable by no one else, including the people who run the bucket.

Three principles are not negotiable: plaintext exists only in the browser, briefly, after a passkey gesture; the login decides which paths you may touch and the passkey decides whether the bytes mean anything; and nothing in the repository is secret, so the whole configuration of every environment is public.

## What a compromised party would get

The design's threat table, from [section 3.4 of the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md), in full on [the security page](/security/index.md). It describes the design, not a shipped system; the acceptance test that checks it is listed as proposed below.

| Party compromised | Gets | Does not get |
|---|---|---|
| GCP project or Identity Platform admin | User emails, login metadata, ciphertext, the ability to delete or roll back, the ability to log in as anyone | Any plaintext: the PRF output is bound to the origin and the user's authenticator |
| Bucket reader | Ciphertext | Plaintext |
| Terraform pipeline | Can change rules, delete the bucket | Plaintext |
| This repository or the DNS | **Everything, for users who load the malicious page** | Nothing is withheld |

The last row is why the repository protections in [docs/ops/branch-protection.md](/docs/ops/branch-protection.md) exist. The code served to the browser is the boundary.

## Shipped, proposed, absent

Every claim this site makes, with its status, from `data/features.json`. *shipped* exists and runs at the version shown; *proposed* is designed and not built; *absent* is deliberately not in the MVP.

| Area | Feature | Status | Where | Notes |
|---|---|---|---|---|
| pipeline | One version in admin/build/version.txt, repeated in every badge, twin, index and config | shipped v0.1.0 | admin/build/version.txt | Check 1 of the gate fails on any disagreement. |
| pipeline | Chrome (head, nav, footer, version badge, CSP, canonical) generated into every page from one definition | shipped v0.1.0 | admin/build/chrome.py | gen_chrome.py --check is part of the gate. |
| pipeline | Markdown twin of every HTML page, links pointing at markdown | shipped v0.1.0 | admin/build/gen_twins.py | index.html has index.md beside it; the twin carries the site version. |
| pipeline | llms.txt, llms-full.txt and sitemap.xml generated on every release | shipped v0.1.0 | admin/build/gen_llms.py | llms-full.txt concatenates every twin and every design document. |
| pipeline | docs/reality.md and the status tables generated from data/features.json | shipped v0.1.0 | admin/build/gen_features.py | If the reality document does not list it, it does not exist. |
| pipeline | The eight-check release gate, no dependencies | shipped v0.1.0 | admin/build/validate.js | Version agreement, internal links, canonical host, leak tripwire, vendor manifest, rules in sync, reality, storage keys. |
| pipeline | The same gate locally and in CI, one command | shipped v0.1.0 | admin/build/gate.py | The CI validate job runs gate.py; a release that fails locally fails the same way in CI. |
| pipeline | Every push to dev is a release: version.txt and the commit subject agree, CI tags it | shipped v0.1.0 | admin/build/tag_release.py | Anchors on the newest commit whose subject is 'site vX.Y.Z : ...', asserts the next minor or patch or major .0, backfills missing tags. |
| pipeline | Deploy to GitHub Pages from the validated tree | shipped v0.1.0 | .github/workflows/deploy-pages.yml | Excludes .git, .github, infra, tests/unit and node_modules. Actions pinned by commit SHA. |
| pipeline | verify-live: the run is red until the live site serves the released version | shipped v0.1.0 | admin/build/verify_live.py | Green does not mean live. Polls version.txt and the homepage badge for up to ten minutes. |
| pipeline | Every third-party file vendored and hashed in vendor/MANIFEST.json; no runtime script from another origin | shipped v0.1.0 | vendor/MANIFEST.json | Check 5 of the gate. Today the only vendored file is the family design tokens. |
| site | secrets.sgit.ai served by GitHub Pages over HTTPS | shipped v0.1.0 | CNAME, docs/ops/dns.md | verify-live passed on the v0.1.0 run (attempt 2, 2026-10-05) after the DNS record and Pages settings were made. |
| site | Content pages: how it works, security, keyring spec, sharing, environments | shipped v0.1.1 | how-it-works/, security/, keyring/, sharing/, environments/ | Every page opens with a status line generated from this file and describes only designs in the future tense. |
| site | /shipped/ generated from this file, one table per status, beside docs/reality.md | shipped v0.1.1 | shipped/index.html | The same generator writes both, so the page and the reality document cannot disagree. |
| site | The five design documents published verbatim | shipped v0.1.0 | docs/design/ | The markdown is the source of truth; since v0.2.0 each is also rendered to an HTML page beside it. |
| site | Every markdown document under docs/ rendered to HTML on each release, with index pages | shipped v0.1.1 | admin/build/gen_docs.py, admin/build/md_to_html.py | Standard-library renderer; the markdown stays the twin. gen_docs --check is part of the gate. |
| site | The family nav: grouped menus with dropdowns, part-of-sgit.ai link, stage pill, phone menu, breadcrumbs | shipped v0.1.1 | admin/build/chrome.py, assets/nav.js | The shape sgit.ai, nfrs.sgit.ai and pki.sgit.ai run; works with no JavaScript because every group label is a link. |
| admin | Comms page: the asks back to the project lead and the nine build steps with status, from data/steps.json | shipped v0.1.1 | admin/comms.html | gen_versions.py renders the step tracker; a done step must name a release that exists. |
| review | review/: schemas for every layer, the edge vocabulary, freshness by tree hash, a computed README, the fixture repository | shipped v0.1.3 | review/tools/ | Step 0 of the review brief. Check 9 of the gate. |
| review | review/intent/: the MVP brief as stories, rules, examples, flows, components and deploy, each node carrying its section, accepted by the project lead | proposed | review/intent/ | Written at v0.1.4 (14 stories, 51 rules, 70 examples, 6 flows, 23 components, 5 environments, 11 resources, 5 pipelines); intent only once the lead has walked it and accepted it (comms N7). |
| review | The navigator at /review/ui/: walk the intent down and up, with the path as a breadcrumb and every node linked to its section of the brief | shipped v0.1.4 | review/ui/ | review-base, review-tree, review-node, review-crumb: web components in the coding.sgit.ai shape, three files each; colours only in tokens.css; the route never assigns location.hash. |
| review | The rest of the navigator: ladder, set switch, join, change, source, reach, stream, checks, search | proposed | review/ui/ | Steps 2 to 6; one visualiser per file shape, listed in review/ui/README.md. |
| review | graph/: files, modules, classes, methods, surfaces, tests and deploy derived from the syntax tree by parsers, never a model | proposed | review/tools/derive.py, derive_js.py | Steps 2 and 3. Python from the stdlib parser; JavaScript from a vendored, hashed acorn. |
| review | Every commit read upwards: changes/<hash>.json with layers moved and held, reach, claim versus evidence | proposed | review/tools/change.py | Step 4; the Kind: trailer carries the claim (R4). |
| review | review/self/: the same folder for the tools and the navigator, both sets green before a release | proposed | review/self/ | Step 2. |
| pipeline | One release script: bump, build, gate, commit with a Kind: trailer, push, verify live | shipped v0.1.3 | admin/build/release.py | The family's release discipline in one command; a clean push is not a release. |
| pipeline | The orphan-page rule, a parse-check of every script, and an em-dash advisory in the gate | shipped v0.1.3 | admin/build/validate.js | From section 4 of the repository guidance; the advisory never fails the build. |
| site | Roles as files with the rules each enforces and the mistake behind each; the board as data/steps.json and the comms page | shipped v0.1.3 | team/ | Two roles fill every seat: the project lead and the build agent. |
| site | Participant disclosure: who publishes this site and what they are building | shipped v0.1.3 | about/participant.html | Linked from the footer. |
| site | Four themes (Night, Day, Paper, Ember) picked from the nav, kept in this browser only; every colour a token valued in assets/themes.css | shipped v0.1.6 | data/themes.json, assets/themes.css, assets/theme.js | No colour is written anywhere else on the site; the review navigator and the mockups follow the pick. A build test fails when a theme misses a token or a stylesheet names a colour. |
| site | Design mockups: ten screens as static pictures in a mini browser frame and as ASCII art, each linked to the intent it realises | shipped v0.1.5 | mockups/ | Pictures of proposed screens, not screens; replaced by real screenshots as pages ship. |
| site | Branch protection, hardware-key 2FA, verified domain and the Actions policy in place and dated on /security/ | proposed | docs/ops/branch-protection.md | Asked for in docs/ops/needs.md. Each row on /security/ flips to a dated yes when confirmed. |
| site | brief-corrections.md: what the brief got wrong, dated, beside it | shipped v0.1.0 | docs/design/brief-corrections.md | Appended to as the build finds out. |
| site | docs/ops/needs.md: exactly what only a human can do | shipped v0.1.0 | docs/ops/needs.md | DNS, Pages, branch protection, GCP bootstrap, OAuth client secret. |
| infra | Bootstrap script for the tfstate project, env projects, Terraform service account and WIF pool | proposed | infra/bootstrap/bootstrap.sh | Step 3. Run once by a human; idempotent; --dry-run. |
| infra | Terraform module secrets-env and the dev environment root | proposed | infra/terraform/ | Step 3. Identity Platform, Firebase web app, bucket, rules release, IAM, WIF. |
| infra | infra.yml: plan on PR, apply on dispatch and on push to dev for dev | proposed | .github/workflows/infra.yml | Step 3. Workload Identity Federation, no JSON keys. |
| infra | Storage Security Rules deployed per environment | proposed | infra/rules/storage.rules | The rules text is in the repository and hashed; nothing is deployed yet. Syntax to verify on a real project. |
| infra | config/environments.json with real dev values from Terraform outputs | proposed | config/environments.json | Step 3. Today every environment is a placeholder with _source null. |
| app | Sign in and out with Google and email/password against the chosen environment | proposed | app/index.html | Step 3. Popup sign-in by default; vendored Firebase SDK. |
| app | Environment page: pick a built-in environment, enter a custom one, import, export, reset | proposed | app/environment.html | Step 3. The active environment is shown in the header at all times. |
| app | Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai | proposed | app/setup.html, app/unlock.html | Step 4. Not before the dev project exists and the probe pages are green. |
| app | Keyring v1 format: wraps per unlock method, AES-256-GCM body, known-answer tests | proposed | section 8 of the brief | Step 4. Published at /keyring/ as a specification. |
| app | Recovery code: 26 characters base32, 128 bits, shown once | proposed | app/setup.html | Step 4. Lose every passkey and the code and the data is gone; the site will say so. |
| app | Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers | proposed | app/vault.html, app/entry.html | Step 5. Kinds: password, api-key, sgit-vault-key, sgit-read-key, pki-private-key, note. |
| app | Optimistic concurrency on keyring writes with a three-way merge | proposed | section 8.5 of the brief | Step 5. rev in the AAD so a stale body fails to decrypt. |
| app | Devices page: add and remove passkeys, regenerate the recovery code | proposed | app/devices.html | Step 6. |
| app | Account page: export and import the encrypted keyring, sign out, wipe memory | proposed | app/account.html | Step 6. |
| app | Key pair per user generated at first run; public bundle written to directory/ | proposed | section 8.3 of the brief | Step 4 generates the keys; step 9 writes the public bundle. Phase 1 data model for phase 2 sharing. |
| app | Sharing an entry with another user through their inbox | absent | /sharing/ (step 2 describes it) | Phase 2. The data model ships first so it is not rewritten later. |
| app | A document kind in the keyring | absent | section 8.4 of the brief | Documents will be a pointer to an sgit vault plus that vault's key, not bytes in the keyring. |
| app | Browser extension or autofill | absent | section 12 of the brief | A later site or a later version. |
| app | An API for agents | absent | section 12 of the brief | A later version. |
| app | Any server-side code: Cloud Functions, proxies, a small API | absent | everywhere | Forbidden by design. A need for one is a proposal in brief-corrections.md, not code. |
| admin | Admin sign-in with the visitor's own Google account, token in memory only | proposed | admin/oauth.js | Step 7. Implicit flow to verify first; PKCE fallback. |
| admin | Setup checklist: every per-project resource as a row, with Fix where fixable client-side | proposed | admin/setup-checklist.html | Step 3 read-only, step 7 with fixes. |
| admin | Auth config, storage, rules diff and deploy, users, environment export | proposed | admin/*.html | Step 7. GCP IAM is the role; the pages are a client for GCP's own APIs. |
| admin | Release history page generated from data/versions.json | shipped v0.1.0 | admin/versions.html | One row per release; the newest row must equal version.txt. |
| tests | Browser probe pages: webauthn-prf, crypto, config, auth, storage, keyring-roundtrip, offline, leak-check, matrix | proposed | tests/*.html | Steps 3 to 6. Each prints PASS/FAIL/SKIP with the raw values; together they are the compatibility matrix. |
| tests | Unit tests under node --test, real WebCrypto, no mocks | shipped v0.1.0 | tests/unit/ | At this version: the gate's own checks against fake fixtures. Keyring tests come with step 4. |
| tests | Build tests: the generators run on the real tree, chrome in every page, twins exist, features schema | shipped v0.1.0 | tests/build/ | pytest, TestCase classes, no mocks. |
| tests | Playwright end to end against the real dev project with a virtual authenticator | proposed | tests/e2e/ | Whether the virtual authenticator does PRF is an open question. |
| tests | Acceptance: an Owner of the dev project is handed a uid and asked to produce one plaintext field | proposed | docs/acceptance.md | Before 1.0. The write-up is published whatever the result. |

## Where to read next

- [How it works](/how-it-works/index.md), [Security](/security/index.md), [Keyring format](/keyring/index.md), [Sharing](/sharing/index.md), [Environments](/environments/index.md): the design, every page marked with its status.
- [The MVP build brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md), the instruction set this site is built from, and [what it got wrong](/docs/design/brief-corrections.md); the four design documents are listed at [docs/design/](/docs/design/index.md).
- [How a release works](/docs/ops/release.md): the version gate, the commit subject, the tag, and why green does not mean live.
- [What only a human can do](/docs/ops/needs.md) before the next step.
- [Release history](/admin/versions.md) and [llms.txt](/llms.txt) for agents.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/)*
