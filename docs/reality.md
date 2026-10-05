# secrets.sgit.ai — reality

*Generated from `data/features.json` by `admin/build/gen_features.py` at site v0.1.1 (2026-10-05). If the reality document does not list it, it does not exist. Briefs are aspirations; this file is the fact.*

50 claims: 23 shipped, 22 proposed, 5 absent.

| Status | Meaning |
|---|---|
| shipped | exists in the repository, runs, and was exercised at the version shown |
| proposed | designed in the brief, not built; described only in the future tense |
| absent | deliberately not in the MVP; comes as a later version or a later site, or never |

## Shipped (23)

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
| site | brief-corrections.md: what the brief got wrong, dated, beside it | shipped v0.1.0 | docs/design/brief-corrections.md | Appended to as the build finds out. |
| site | docs/ops/needs.md: exactly what only a human can do | shipped v0.1.0 | docs/ops/needs.md | DNS, Pages, branch protection, GCP bootstrap, OAuth client secret. |
| admin | Release history page generated from data/versions.json | shipped v0.1.0 | admin/versions.html | One row per release; the newest row must equal version.txt. |
| tests | Unit tests under node --test, real WebCrypto, no mocks | shipped v0.1.0 | tests/unit/ | At this version: the gate's own checks against fake fixtures. Keyring tests come with step 4. |
| tests | Build tests: the generators run on the real tree, chrome in every page, twins exist, features schema | shipped v0.1.0 | tests/build/ | pytest, TestCase classes, no mocks. |

## Proposed (22)

| Area | Feature | Status | Where | Notes |
|---|---|---|---|---|
| site | Branch protection, hardware-key 2FA, verified domain and the Actions policy in place and dated on /security/ | proposed | docs/ops/branch-protection.md | Asked for in docs/ops/needs.md. Each row on /security/ flips to a dated yes when confirmed. |
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
| admin | Admin sign-in with the visitor's own Google account, token in memory only | proposed | admin/oauth.js | Step 7. Implicit flow to verify first; PKCE fallback. |
| admin | Setup checklist: every per-project resource as a row, with Fix where fixable client-side | proposed | admin/setup-checklist.html | Step 3 read-only, step 7 with fixes. |
| admin | Auth config, storage, rules diff and deploy, users, environment export | proposed | admin/*.html | Step 7. GCP IAM is the role; the pages are a client for GCP's own APIs. |
| tests | Browser probe pages: webauthn-prf, crypto, config, auth, storage, keyring-roundtrip, offline, leak-check, matrix | proposed | tests/*.html | Steps 3 to 6. Each prints PASS/FAIL/SKIP with the raw values; together they are the compatibility matrix. |
| tests | Playwright end to end against the real dev project with a virtual authenticator | proposed | tests/e2e/ | Whether the virtual authenticator does PRF is an open question. |
| tests | Acceptance: an Owner of the dev project is handed a uid and asked to produce one plaintext field | proposed | docs/acceptance.md | Before 1.0. The write-up is published whatever the result. |

## Absent (5)

| Area | Feature | Status | Where | Notes |
|---|---|---|---|---|
| app | Sharing an entry with another user through their inbox | absent | /sharing/ (step 2 describes it) | Phase 2. The data model ships first so it is not rewritten later. |
| app | A document kind in the keyring | absent | section 8.4 of the brief | Documents will be a pointer to an sgit vault plus that vault's key, not bytes in the keyring. |
| app | Browser extension or autofill | absent | section 12 of the brief | A later site or a later version. |
| app | An API for agents | absent | section 12 of the brief | A later version. |
| app | Any server-side code: Cloud Functions, proxies, a small API | absent | everywhere | Forbidden by design. A need for one is a proposal in brief-corrections.md, not code. |

Storage Security Rules source: `infra/rules/storage.rules`, `sha256:6caa0c5280ef2a5429e832ccef6dddc5e6cae5625ec284f895a516d221dae250` (the gate fails when the file and this hash disagree, so a rules change needs a release note).

*Source: [https://github.com/SGit-AI/SGit-AI__Website__Secrets](https://github.com/SGit-AI/SGit-AI__Website__Secrets) · CC BY 4.0*
