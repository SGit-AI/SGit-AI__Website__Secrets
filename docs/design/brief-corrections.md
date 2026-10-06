# Brief corrections

*secrets.sgit.ai · what the MVP build brief got wrong or left open, found while building, dated · beside the brief it corrects · CC BY 4.0*

The brief (`secrets-sgit-ai__mvp-build-brief.md`) is the instruction set. Where building it showed a statement to be wrong, incomplete or impossible as written, the finding is recorded here with the date and the version, and the build carried on with the correction. Sections 1 to 4 of the brief hold closed decisions; nothing here reopens one. The design documents beside this file are copied verbatim and are never edited.

## v0.1.0 (2026-10-05): the pipeline before the site

### C1. "Type_Safe style" for the generators, without the library

Section 7.2 asks for Python in Type_Safe style. `Type_Safe` is a runtime type system from `osbot-utils`, a dependency the gate would have to `pip install` before it could run. The brief also requires that "a release that fails the gate locally fails the same way in CI" and that `validate.js` has no dependencies. The generators therefore use the standard library only and keep the shape of the style (one class per file, `═══` banners instead of docstrings, aligned assignments, trailing comments carrying the reasoning, double-underscore class names such as `Site__Pages`, `Gen__Chrome`, `Tag__Release`), without the `Type_Safe` base class. The one Python dependency of the whole gate is `pytest`, which the brief itself names. If the house later publishes a stdlib-only `Type_Safe`, the base class can be added without changing a call site.

### C2. The generator filenames are the brief's, not the house's

The house rule is "filename equals class name". The brief names the files `admin/build/chrome.py` and `admin/build/gen_*.py`, and the CI table runs `gen_*.py --check`. The brief wins on the filenames; the class inside each file follows the house naming. `admin/build/version.txt` sits beside them as the brief says.

### C3. Check 1 cannot mean "every `vX.Y.Z` string in these files"

Section 9.3's first check says the version must equal `llms.txt`, `llms-full.txt` and `index.md`, and "no version listed twice". `llms-full.txt` concatenates every design document, and the brief itself lists `v0.1.0` to `v0.9.0` in its build-order table, so a literal reading fails forever. Check 1 reads each file's declared version at a fixed anchor (`Site version: vX.Y.Z` in the two indexes, `· site vX.Y.Z` in a twin's source line, `data-version="X.Y.Z"` on a badge, `"siteVersion"` in the config, the newest row of `data/versions.json`) and "listed twice" applies to the versions table.

### C4. The leak tripwire's patterns must not trip on the brief

The brief lists its own tripwire shapes in section 9.3 (`sgit_private_vault_`, `GOCSPX-`, `"private_key_id"`, and so on), and it is copied in verbatim. Each pattern therefore requires the shape of a real value, not the bare prefix: a key body after `sgit_private_vault_`, ten or more characters after `GOCSPX-`, a colon after `"private_key_id"` (the JSON shape), and so on. This is a sharper pattern, not a wider one, and the brief's rule stands: the fix for a trip is a redaction. Firebase `AIza…` keys are not in the brief's list; the gate adds them as a shape that may appear only in `config/environments.json`, so a web API key pasted into a page is caught and sent to the one file where it belongs.

### C5. `infra/` is excluded from the deploy but `admin/rules.html` reads `infra/rules/storage.rules`

Section 9.1 excludes `infra` from the Pages artifact. Section 6.3's `rules.html` diffs the deployed rules against "`infra/rules/storage.rules` in the repo". A page served from the site cannot read a file the deploy left out. Open until step 7; the likely resolution is that `gen_features.py` (which already hashes the rules file) also writes the rules text into `data/storage-rules.json` so the page reads a deployed copy whose hash the gate has already checked. Recorded here so the exclude list is not changed silently.

### C6. One Pages site, two deploying branches

Section 9.1 deploys both `dev` and `main` to Pages. A repository has one Pages site, so a push to `main` replaces what `dev` deployed. This is consistent with `main` being a fallback promoted from `dev`, and `docs/ops/release.md` says so; it is not a separate `main` site. The `main` environment in `config/environments.json` is a GCP project the `main` branch is tested against, not a second hostname.

### C7. Branch protection could not precede the first release

Section 9.5 says the protections are set on day one. The required status check is `validate`, which did not exist before the commit that created it, and the brief asks for that commit to be pushed to `dev` as release v0.1.0. v0.1.0 was therefore pushed directly to `dev`; the rules in `docs/ops/branch-protection.md` apply from the next release on, and `docs/ops/needs.md` asks for them.

### C8. `enablement` of Pages is not the workflow's to do

`actions/configure-pages` can try to create the Pages site, but that needs a token with administration rights the workflow does not and should not hold. Enabling Pages with the custom domain is a human step (`docs/ops/needs.md`, item 2). Until it is done the `deploy` job fails at `configure-pages`, which is the intended, visible failure.

### C9. Check 8 covers `sessionStorage` and IndexedDB too

Section 9.3 lists `localStorage.setItem(` only. The rules the session must never break name `sessionStorage` and IndexedDB as well. Check 8 also requires every `sessionStorage.setItem` key to be in `app/config/storage-keys.js` (the admin OAuth `state` is the only one listed, section 6.3) and fails on any use of `indexedDB` under `app/`, `components/` or `admin/`. `tests/leak-check.html` may scan IndexedDB, so `tests/` is exempt from that one rule.

### C10. Pinning actions by SHA from inside a scoped session

The six actions in `deploy-pages.yml` are pinned to the commit SHAs of `actions/checkout@v4.2.2`, `actions/setup-node@v4.1.0`, `actions/setup-python@v5.3.0`, `actions/configure-pages@v5.0.0`, `actions/upload-pages-artifact@v3.0.1` and `actions/deploy-pages@v4.0.5`, resolved with `git ls-remote` against the public repositories on 2026-10-05. A reviewer can re-check each with `git ls-remote https://github.com/<action> refs/tags/<tag>`.

### C11. `node --test tests/unit/` is not a valid Node 22 invocation

Section 9.1's validate job runs `node --test tests/unit/`. Node 22 treats a positional argument as a glob pattern for test files, not a directory, and fails with "Cannot find module .../tests/unit". The gate runs `node --test tests/unit/**/*.test.js`, which is the same intent in the form Node accepts.

## v0.1.1 (2026-10-05): the content pages and the family chrome

### C12. "The four design docs, rendered" became every document under docs/, rendered

Section 6.1 lists `/docs/design/` as the design documents rendered. Rendering needs a markdown-to-HTML step, and the house has no build step and no dependency the gate could rely on, so `admin/build/md_to_html.py` is a standard-library renderer for the constructs these documents use (headings with GitHub-style ids, nested and task lists, tables with alignment, fenced code, blockquotes, inline emphasis, links). Once it existed, rendering only the design folder would have left the ops notes and `docs/reality.md` as raw markdown on the site, so `gen_docs.py` renders every document under `docs/` and writes an index page for `docs/design/` and `docs/ops/`. The markdown stays the source of truth and is the markdown twin of the rendered page (`<meta name="sg-secrets:source">` names it), so the twin rule holds without a second copy.

### C13. The 404 page is not in the sitemap or llms.txt

Section 6.1 does not mention a not-found page. One exists (`404.html`, which GitHub Pages serves for a missing path) with the full chrome so the version badge and nav are there; it is excluded from `sitemap.xml` and `llms.txt` because it is not a page anyone navigates to.

### C14. The three guard rows on /security/ that this build cannot confirm

Section 9.5 says the protections are "listed on `/security/`". Four of them (branch protection, organisation 2FA, the verified domain, the Actions policy) are organisation settings this session cannot read, so each row says "unconfirmed as of 2026-10-05" rather than yes or no, and `needs.md` asks for them. A reviewer who sets them changes the row to a dated yes in the same pull request.

### C15. Releases bump the third digit, not the second

Section 9.1 says every push to `dev` is a minor bump and section 11 numbers the steps v0.1.0 to v0.9.0. Dinis decided on 2026-10-05 that each release bumps the third digit (v0.1.0, v0.1.1, v0.1.2, …), as the sibling sites do (sgit.ai is at v0.6.59 after hundreds of releases), and that the second digit is reserved for a milestone he names. The step numbers in section 11 therefore name the deliverable, not the release; `data/steps.json` records which release delivered each step. `tag_release.py` already accepted a patch bump, so nothing in the pipeline changed.

### C16. The admin section and the markdown viewer follow the siblings

Section 6.1 names `/admin/index.html` and `/admin/versions.html` only. The sibling sites (sgit.ai, nfrs.sgit.ai, pki.sgit.ai) share one nav shape, grouped dropdown menus with a parent link, a stage pill and the version, and an admin section of three pages: how the site is built, the release history, and a comms page of numbered asks and tasks. This site now follows that shape (`admin/build/chrome.py`, `assets/nav.js`, `admin/comms.html`). For documents, the family's own brief ("Markdown and file viewers in a vault: what not to build") says not to write a client-side viewer, and the sibling websites publish documents as pages rendered at build time with the raw markdown one click away as the source of truth; `gen_docs.py` does exactly that, so no viewer script runs in the browser and the CSP stays at `script-src 'self'` with one small nav script.

## v0.1.3 (2026-10-06): the repository guidance and the review folder

### C17. The repository guidance published on 6 October adds things the brief did not name

[Every sgit repository](https://sgit.ai/docs/guidance/repositories.html) was published after the brief. What it adds, and what this repository did about each: the `review/` folder (built from step 0 at v0.1.3, with its own corrections file `review/BRIEF-CORRECTIONS.md`); roles as files (`team/`); a participant disclosure (`about/participant.html`); one release script (`admin/build/release.py`); and three more gate checks (orphan pages, script parse-check, an em-dash advisory). The guidance's "honest column" row is on nfrs.sgit.ai, not here, and is a request to that site once step 3 has something to measure. The guidance's rule that every push goes through one script does not change the branch model: `release.py` pushes `dev` directly until branch protection is on (needs.md), then pushes a branch and the release is the merge.

## Open questions carried from section 12 (unanswered at this version)

- Does the Playwright virtual authenticator support PRF? (step 4)
- Does Google still issue implicit-flow tokens for a Web client with our origins? (step 7)
- Exact Security Rules syntax for the size and null checks; is `request.auth.token.firebase.tenant` available in Storage rules? (step 3)
- Where does Identity Platform store user records? (step 3, for `/environments/`)
- Does `sgit pki import` accept a browser-generated bundle? (step 9)
