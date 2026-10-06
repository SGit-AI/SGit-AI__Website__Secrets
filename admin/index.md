# Admin

> How the site is built and gated, and the admin pages that are proposed: a client for GCP's own APIs, working only for a Google account with IAM on the chosen project. At this version only the build pipeline exists.

*Source: <https://secrets.sgit.ai/admin/> · site v0.1.12 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Two things live under `/admin/`: how this site is built and released, which exists, and the environment admin pages, which are proposed.

## How the site is built

There is no build step and no bundler. The committed tree is the deployed tree. Five generators under `admin/build/` write the parts that must not drift (the chrome, the status tables, the release table, the markdown twins, the machine indexes), each with a `--check` mode, and an eight-check gate in `admin/build/validate.js` refuses a release that disagrees with itself. The same command, `python3 admin/build/gate.py`, runs locally and in CI. Every push to `dev` is a release: the version in `admin/build/version.txt` is repeated in the commit subject as `site vX.Y.Z : what`, CI tags it, deploys it, and then polls the live site until it serves that version. The whole procedure is in [docs/ops/release.md](/docs/ops/release.md).

### The eight checks

1. **Version agreement.** `version.txt` equals every page badge, the newest row of the versions table, `llms.txt`, `llms-full.txt`, `index.md` and `config/environments.json#siteVersion`; no version is listed twice.
2. **Internal links and fragments** resolve, in every HTML and markdown file.
3. **Canonical host.** Every page has `rel=canonical` and `og:url` on the host in `CNAME`.
4. **Leak tripwire** on every file in the tree: sgit vault and read keys, AWS and GitHub tokens, API keys, PEM private key blocks, Slack tokens, Google OAuth client secrets, service-account JSON, bare twelve-digit numbers. The fix for a trip is always a redaction, never a wider pattern.
5. **Vendor manifest.** Every file under `vendor/` matches its SHA-256; no script is loaded from another origin anywhere under `app/`, `components/`, `admin/` or `tests/`.
6. **Storage rules in sync.** The hash of `infra/rules/storage.rules` equals the hash recorded in `data/features.json`, so a rules change without a release note fails.
7. **Reality.** `docs/reality.md` is what `data/features.json` generates.
8. **No storage of secrets in code.** Every `localStorage.setItem` and `sessionStorage.setItem` uses a key listed in `app/config/storage-keys.js`.

## The admin pages, proposed

The admin pages will work only when the visitor signs in with a Google account that has IAM on the selected environment's GCP project. There will be no admin role in the app: the project's IAM is the role, and the pages are a client for GCP's own APIs, calling them with the visitor's own token held in memory. Every write action will show the exact request before sending it. None of this exists yet.

| Area | Feature | Status | Where | Notes |
|---|---|---|---|---|
| admin | Comms page: the asks back to the project lead and the nine build steps with status, from data/steps.json | [shipped v0.1.1](/review/ui/#node=claim.admin.comms) | [admin/comms.html](/review/ui/#file=admin/comms.html) | gen_versions.py renders the step tracker; a done step must name a release that exists. |
| admin | Admin sign-in with the visitor's own Google account, token in memory only | [proposed](/review/ui/#node=claim.admin.oauth) | admin/oauth.js | Step 7. Implicit flow to verify first; PKCE fallback. |
| admin | Setup checklist: every per-project resource as a row, with Fix where fixable client-side | [proposed](/review/ui/#node=claim.admin.setup-checklist) | admin/setup-checklist.html | Step 3 read-only, step 7 with fixes. |
| admin | Auth config, storage, rules diff and deploy, users, environment export | [proposed](/review/ui/#node=claim.admin.pages) | admin/*.html | Step 7. GCP IAM is the role; the pages are a client for GCP's own APIs. |
| admin | Release history page generated from data/versions.json | [shipped v0.1.0](/review/ui/#node=claim.admin.versions) | [admin/versions.html](/review/ui/#file=admin/versions.html) | One row per release; the newest row must equal version.txt. |

## The pipeline, as it stands

| Area | Feature | Status | Where | Notes |
|---|---|---|---|---|
| pipeline | One version in admin/build/version.txt, repeated in every badge, twin, index and config | [shipped v0.1.0](/review/ui/#node=claim.pipeline.version-source) | [admin/build/version.txt](/review/ui/#file=admin/build/version.txt) | Check 1 of the gate fails on any disagreement. |
| pipeline | Chrome (head, nav, footer, version badge, CSP, canonical) generated into every page from one definition | [shipped v0.1.0](/review/ui/#node=claim.pipeline.chrome) | [admin/build/chrome.py](/review/ui/#file=admin/build/chrome.py) | gen_chrome.py --check is part of the gate. |
| pipeline | Markdown twin of every HTML page, links pointing at markdown | [shipped v0.1.0](/review/ui/#node=claim.pipeline.twins) | [admin/build/gen_twins.py](/review/ui/#file=admin/build/gen_twins.py) | index.html has index.md beside it; the twin carries the site version. |
| pipeline | llms.txt, llms-full.txt and sitemap.xml generated on every release | [shipped v0.1.0](/review/ui/#node=claim.pipeline.llms) | [admin/build/gen_llms.py](/review/ui/#file=admin/build/gen_llms.py) | llms-full.txt concatenates every twin and every design document. |
| pipeline | docs/reality.md and the status tables generated from data/features.json | [shipped v0.1.0](/review/ui/#node=claim.pipeline.reality) | [admin/build/gen_features.py](/review/ui/#file=admin/build/gen_features.py) | If the reality document does not list it, it does not exist. |
| pipeline | The eight-check release gate, no dependencies | [shipped v0.1.0](/review/ui/#node=claim.pipeline.gate) | [admin/build/validate.js](/review/ui/#file=admin/build/validate.js) | Version agreement, internal links, canonical host, leak tripwire, vendor manifest, rules in sync, reality, storage keys. |
| pipeline | The same gate locally and in CI, one command | [shipped v0.1.0](/review/ui/#node=claim.pipeline.gate-local) | [admin/build/gate.py](/review/ui/#file=admin/build/gate.py) | The CI validate job runs gate.py; a release that fails locally fails the same way in CI. |
| pipeline | Every push to dev is a release: version.txt and the commit subject agree, CI tags it | [shipped v0.1.0](/review/ui/#node=claim.pipeline.tag-release) | [admin/build/tag_release.py](/review/ui/#file=admin/build/tag_release.py) | Anchors on the newest commit whose subject is 'site vX.Y.Z : ...', asserts the next minor or patch or major .0, backfills missing tags. |
| pipeline | Deploy to GitHub Pages from the validated tree | [shipped v0.1.0](/review/ui/#node=claim.pipeline.deploy) | .github/workflows/deploy-pages.yml | Excludes .git, .github, infra, tests/unit and node_modules. Actions pinned by commit SHA. |
| pipeline | verify-live: the run is red until the live site serves the released version | [shipped v0.1.0](/review/ui/#node=claim.pipeline.verify-live) | [admin/build/verify_live.py](/review/ui/#file=admin/build/verify_live.py) | Green does not mean live. Polls version.txt and the homepage badge for up to ten minutes. |
| pipeline | Every third-party file vendored and hashed in vendor/MANIFEST.json; no runtime script from another origin | [shipped v0.1.0](/review/ui/#node=claim.pipeline.vendor) | [vendor/MANIFEST.json](/review/ui/#file=vendor/MANIFEST.json) | Check 5 of the gate. Today the only vendored file is the family design tokens. |
| pipeline | One release script: bump, build, gate, commit with a Kind: trailer, push, verify live | [shipped v0.1.3](/review/ui/#node=claim.pipeline.release-script) | [admin/build/release.py](/review/ui/#file=admin/build/release.py) | The family's release discipline in one command; a clean push is not a release. |
| pipeline | The orphan-page rule, a parse-check of every script, and an em-dash advisory in the gate | [shipped v0.1.3](/review/ui/#node=claim.pipeline.gate-extras) | [admin/build/validate.js](/review/ui/#file=admin/build/validate.js) | From section 4 of the repository guidance; the advisory never fails the build. |

## The admin section

- [How the site is built](/admin/index.md): this page.
- [Release history](/admin/versions.md): one row per release, generated from `data/versions.json`.
- [Comms](/admin/comms.md): the asks back to the project lead and the nine build steps with their status, generated from `data/steps.json`.
- [What needs a human](/docs/ops/needs.md), exactly, and the rest of the [documents](/docs/index.md), each rendered from its markdown with the raw file one click away.
- The build itself, served as plain files: [chrome.py](/admin/build/chrome.py) (the nav, footer, badges and CSP), [validate.js](/admin/build/validate.js) (the eight checks), [version.txt](/admin/build/version.txt), [nav.js](/assets/nav.js) (the menu interaction) and [theme.js](/assets/theme.js) (the theme picker; the four themes are [data/themes.json](/data/themes.json) and every colour on the site is in [themes.css](/assets/themes.css)). The reader's column ([components/reader-panel](/components/reader-panel/reader-panel.js), [reader-log](/components/reader-log/reader-log.js), [reader-chat](/components/reader-chat/reader-chat.js) on [sg-base](/components/sg-base/sg-base.js)) is the third script, a module, and the only one that holds state: the reader's own log, in this browser ([how the channel works](/docs/ops/comms.md)).

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/admin/)*
