# secrets.sgit.ai — MVP build brief

Status: **brief, written to be executed** · 5 October 2026 · for the Claude Code session working in `SGit-AI/SGit-AI__Website__Secrets` · CC BY 4.0

> A zero-knowledge secrets manager that runs entirely in the browser. The site is static on GitHub Pages. The only cloud is one GCP project per environment, holding Identity Platform (login) and a Cloud Storage bucket (ciphertext). The browser does every cryptographic operation. A full compromise of the GCP project, the Identity Platform admin or the bucket yields ciphertext and login metadata, never a secret. Everything in this repository is public, including the configuration of every environment, because nothing in it is secret.

---

## 0. How to use this brief

1. Read sections 1–4 before writing anything. They hold the decisions that are already made; do not reopen them.
2. The build order in section 11 is the plan. Each step has acceptance criteria. Ship the pipeline first, then the content, then the app, then admin and tests. Every push to `dev` is a release.
3. Copy the four design documents listed in section 2 into `docs/design/` on your first commit, unchanged. They are the reasoning; this brief is the instruction.
4. Where this brief says PROPOSED or VERIFY FIRST, test before building on it. Where you find this brief wrong, correct it in `docs/design/brief-corrections.md` with what you found, and carry on.
5. The house rules are at coding.sgit.ai and nfrs.sgit.ai. Section 7 extracts what applies here. When in doubt, read `https://coding.sgit.ai/llms-full.txt` and `https://nfrs.sgit.ai/llms.txt`.

What exists today: the repository, with README, Apache-2.0 LICENSE and a Python .gitignore, on branches `dev` and `main`. Nothing else.

---

## 1. What this is

**One sentence.** A password-manager-shaped app where the "passwords" can be anything small and secret — passwords, API keys, sgit vault keys and read keys, PKI private keys, short notes — unlocked by a passkey, stored as ciphertext in a GCP bucket the user's login can reach, and readable by no one else, including the people who run the bucket.

**Why it exists.** It is the MVP for the key-vault layer under Risk Mandate and sgit: identity plus key storage, with every hard piece (login, browser-direct storage, passkey PRF unlock, keyring format, device enrolment, recovery, sharing) in one small, testable product. If an admin with full GCP access cannot read a stored password, the same model holds for vault keys. sgit's own docs say sgit is *not* a secrets manager and its partnerships page asks for exactly this: browser first, key kinds kept apart, release only on approval, end-to-end sharing, revocation, keys for agents. This site answers that call from inside the family.

**Principles (non-negotiable).**

| # | Principle | What it forbids |
|---|---|---|
| P1 | Plaintext exists only in the browser, briefly, after a passkey gesture | Any server-side decryption; any plaintext in storage, logs or URLs |
| P2 | The login decides *which paths you may touch*; the passkey decides *whether the bytes mean anything* | Deriving a key from the login; storing a key in Identity Platform |
| P3 | Nothing in the repo is secret | Any credential, account id or private key in the tree, ever; test fixtures use obviously fake values |
| P4 | No build step, no bundler, no runtime CDN in the app origin | `npm run build`; `<script src="https://…">` from anyone but Google's own auth endpoints (see 4.6) |
| P5 | Every release is validated, tagged and deployed by one pipeline, and a release that fails locally fails the same way in CI | Hand deploys; a version that differs between files |
| P6 | Every figure and every claim on the site is generated or dated; the site says what is built and what is proposed, on every page it applies to | "Coming soon" that reads as shipped |

---

## 2. Design documents (copy into `docs/design/`)

These were written before this brief and carry the reasoning. Copy them in verbatim as the first commit's `docs/design/*.md`.

| File | What it holds |
|---|---|
| `riskmandate-gcp-key-vault-password-manager-mvp.md` | **The primary design.** All-GCP stack, keyring, PRF unlock, sharing scheme, storage layout, threat summary, password-manager MVP scope |
| `riskmandate-aws-cognito-architecture.md` | The AWS variant; why no secret can live inside an identity provider; the attack table |
| `riskmandate-user-onboarding-account-experience.md` | The Workspace-based onboarding design, the Google terms research, and the five-tier model that led here |
| `riskmandate-workspace-architecture-briefing.md` | The earlier Workspace architecture briefing |

Decisions carried over from them, so you do not have to re-derive:

- All-GCP, one project per environment and per customer; project is the create/destroy unit.
- Identity Platform for login (Google sign-in + email/password now; OIDC/SAML federation later), Cloud Storage for Firebase with Security Rules for browser-direct storage.
- Passkey with WebAuthn PRF derives the keyring-wrapping key. Recovery code as the second unlock method. Lose both and the data is gone; the site says so.
- Keyring holds the user's private key and every secret; one unlock opens everything.
- Sharing uses a key pair per user, a public-key directory and an inbox of keys encrypted to the recipient. **Phase 2 for the UI, but the data model ships in phase 1** (the key pair is generated and stored from the first keyring).
- Name is `secrets`, not `secrets-manager`; short nouns match the family and avoid confusion with AWS Secrets Manager and GCP Secret Manager, which are server-side stores for machine secrets.

---

## 3. Architecture

### 3.1 Components

| Layer | Component | Where it runs | Trust |
|---|---|---|---|
| Site + app | Static HTML/JS/CSS from this repo, GitHub Pages, custom domain `secrets.sgit.ai` | Visitor's browser | **The boundary.** Whoever controls this repo or the `sgit.ai` DNS controls the app |
| Login | Identity Platform (Firebase Auth SDK, vendored) | Google | Can impersonate; cannot decrypt |
| Storage | Cloud Storage for Firebase bucket + Security Rules | Google | Holds ciphertext; can delete |
| Unlock | WebAuthn passkey, RP ID `secrets.sgit.ai`, PRF extension | User's authenticator (Google Password Manager, iCloud Keychain, hardware key) | The only thing that can decrypt |
| Admin | Same static pages, calling GCP REST APIs with the signed-in Google account's own OAuth token | Visitor's browser | Works only if that Google account has IAM on the project |
| Infra | Terraform in this repo, applied by GitHub Actions via Workload Identity Federation | GitHub Actions | Can reconfigure or delete; cannot read |

### 3.2 Flows

**First run.** Sign in (Identity Platform) → no keyring at `users/{uid}/keyring.json` → create passkey with PRF → generate keyring key (KEK), key pair, recovery code → write encrypted keyring → show recovery code once → done.

**Returning.** Sign in → fetch keyring → `navigator.credentials.get` with PRF eval → HKDF → unwrap KEK → decrypt body into memory → UI. Nothing decrypted is ever written to storage, localStorage, sessionStorage or IndexedDB.

**New device.** Sign in → fetch keyring → unlock via a synced passkey, cross-device passkey (QR) or the recovery code → register a new passkey → add a wrapped-KEK entry → write keyring (with optimistic concurrency, see 8.5).

**Admin.** Open `/admin/` → choose environment → "Sign in with Google for admin" (OAuth implicit flow, scope `cloud-platform`, token in memory only) → each check calls a GCP API; green/red/fix.

### 3.3 Origins and the passkey scope (the single most important decision)

- RP ID is exactly `secrets.sgit.ai`. **Never** `sgit.ai`: a passkey scoped to the apex can be asserted by any of the 27+ sibling sites, and a compromise of any sibling repo would unlock every user's secrets.
- The app runs on one origin and loads nothing from any other origin except Google's auth endpoints (popup/redirect, no script injection). All libraries are vendored (section 7.3).
- riskmandate.ai and other consumers will use their own passkey or WebAuthn Related Origin Requests later. Out of scope for the MVP.

### 3.4 What a compromised party gets

| Party compromised | Gets | Does not get |
|---|---|---|
| GCP project / Identity Platform admin | user emails, login metadata, ciphertext, ability to delete or roll back, ability to log in as anyone | any plaintext; PRF output is bound to the origin and the user's authenticator |
| Bucket reader | ciphertext | plaintext |
| Terraform pipeline | can change rules, delete bucket | plaintext |
| This repository or DNS | **everything, for users who load the malicious page** | — |

The last row is why section 9.5 exists. Say this on the site's security page in plain words.

---

## 4. GCP environments

### 4.1 Environments and naming

| Env | Purpose | GCP project id (PROPOSED, confirm availability) | Bucket | Who uses |
|---|---|---|---|---|
| `dev` | daily development, disposable | `sgit-secrets-dev` | `sgit-secrets-dev.firebasestorage.app` (Firebase default) or `sgit-secrets-dev-vaults` | builders |
| `main` | staging; what `main` branch is tested against | `sgit-secrets-main` | same pattern | review |
| `prod` | the public default | `sgit-secrets-prod` | same pattern | everyone |
| `<customer>` | a customer's own project, in their org and billing | theirs | theirs | them |

One site serves all environments. The environment is chosen at runtime by browser configuration (section 5), with `prod` as the default on `secrets.sgit.ai`. A customer running their own project either uses the public site pointed at their project (config) or forks the repo and changes `config/environments.json`.

### 4.2 Per-project resources (what Terraform creates)

Terraform lives in `infra/terraform/`, one module `modules/secrets-env`, one root per environment in `infra/terraform/envs/{dev,main,prod}/`. State in a GCS bucket in a separate bootstrap project (`sgit-secrets-tfstate`, PROPOSED), one prefix per env.

1. Project services: `identitytoolkit.googleapis.com`, `firebase.googleapis.com`, `firebasestorage.googleapis.com`, `storage.googleapis.com`, `firebaserules.googleapis.com`, `cloudresourcemanager.googleapis.com`, `serviceusage.googleapis.com`, `iam.googleapis.com`.
2. Firebase project link: `google_firebase_project` (google-beta provider).
3. Web app registration: `google_firebase_web_app` → yields `appId`; read `google_firebase_web_app_config` for `apiKey`, `authDomain`, `storageBucket`. These are **public identifiers**, written into `config/environments.json` by the pipeline. Restrict the API key by HTTP referrer to `https://secrets.sgit.ai/*` and `http://localhost:*` (dev only).
4. Identity Platform: `google_identity_platform_config` with `sign_in { email { enabled = true } }`, `authorized_domains = ["secrets.sgit.ai", "localhost"]`, multi-tenancy off for the MVP (on for customers that want several user pools in one project; the app already passes `tenantId` when configured).
5. Google provider: `google_identity_platform_default_supported_idp_config` with `idp_id = "google.com"`, `client_id`, `client_secret`. The client is a **Web application** OAuth client in the same project, authorised JavaScript origin `https://secrets.sgit.ai`, authorised redirect `https://<authDomain>/__/auth/handler`. The client secret is a GitHub Actions environment secret, passed as a Terraform variable; it never enters the repo. (The secret is only ever used by Google's own token exchange; it is not a secret the app holds.)
6. Admin OAuth client: a **second** Web application client, used only by `/admin/` and `/tests/` for the `cloud-platform` scope, authorised JavaScript origin `https://secrets.sgit.ai` (plus `http://localhost:8000` on dev), authorised redirect `https://secrets.sgit.ai/admin/oauth-return.html`. Its client id is public and goes into `config/environments.json`. Its secret is unused (implicit flow) and stays in the project.
7. Bucket: `google_storage_bucket` with uniform bucket-level access, versioning on, a soft-delete retention of 30 days, CORS for `https://secrets.sgit.ai` (methods GET, PUT, POST, DELETE, HEAD; response headers `Content-Type`, `x-goog-meta-*`, `ETag`, `x-goog-generation`), lifecycle: keep 10 noncurrent versions. Link to Firebase with `google_firebase_storage_bucket`.
8. Security Rules: `google_firebaserules_ruleset` + `google_firebaserules_release` named `firebase.storage/{bucket}` from `infra/rules/storage.rules` (section 8.6).
9. IAM: the Terraform service account `tf-secrets@…` with Editor on the project (narrow later); a `secrets-admins` Google group (or named accounts) with `roles/owner` on the project, which is what makes the admin pages work for those people; nothing else. No service account keys, anywhere.
10. Workload Identity Federation: pool `github`, provider `github-actions` restricted to `assertion.repository == "SGit-AI/SGit-AI__Website__Secrets"` and the `dev`/`main` branches or the environment name; binding `roles/iam.workloadIdentityUser` to the Terraform service account.

### 4.3 Bootstrap (done once, by a human, documented in `docs/ops/bootstrap.md`)

The first project and the WIF pool cannot be created by the pipeline that depends on them. The bootstrap is a short `gcloud` script in `infra/bootstrap/bootstrap.sh`, run by Dinis locally, that creates the tfstate project and bucket, the three env projects, enables billing, creates the Terraform service account and the WIF pool, and prints the values that go into GitHub environment variables. The script is idempotent and prints what it would do with `--dry-run`. Everything after bootstrap is Terraform.

### 4.4 What a customer runs

`docs/ops/new-environment.md`: "You have a GCP org and a billing account. Run bootstrap for one project, add your domain to `authorized_domains`, run Terraform, paste the printed config into the site's Environment page (or into your fork's `config/environments.json`)." Target: under thirty minutes with no support. The admin pages' setup checklist (section 6.3) verifies each step.

### 4.5 Identity Platform notes

- Use **popup** sign-in (`signInWithPopup`) by default; redirect sign-in relies on the `authDomain` helper and third-party cookies, which fail on GitHub Pages in Safari and increasingly in Chrome. Offer `signInWithRedirect` only as a fallback switch on the Environment page.
- Add `secrets.sgit.ai` and `localhost` to Identity Platform authorised domains, or every sign-in fails with `auth/unauthorized-domain`. The admin checklist tests this.
- Identity Platform's own passkey support is not used. The unlock passkey is a plain WebAuthn credential registered by our page.
- Pricing reference: free to 50,000 MAU on basic providers; SAML/OIDC free only to 50 MAU.

### 4.6 The one external dependency: Google's auth endpoints

The app contacts `https://<project>.firebaseapp.com/__/auth/*` (the Firebase auth helper, in a popup) and `https://accounts.google.com` (the OAuth consent, in a popup or redirect). Both are separate browsing contexts; neither injects a script into our origin. That is the whole external surface of the app pages. Admin pages add `https://*.googleapis.com` REST calls with the user's own token. No Google Identity Services script, no gapi, no analytics, no fonts from CDNs.

---

## 5. Browser-side environment configuration

The site ships `config/environments.json` (generated by the pipeline from Terraform outputs; validated by the gate):

```json
{
  "version": 1,
  "default": "prod",
  "environments": {
    "prod": {
      "label":              "secrets.sgit.ai (production)",
      "projectId":          "sgit-secrets-prod",
      "apiKey":             "AIza…public web api key…",
      "authDomain":         "sgit-secrets-prod.firebaseapp.com",
      "storageBucket":      "sgit-secrets-prod.firebasestorage.app",
      "appId":              "1:…:web:…",
      "adminOauthClientId": "….apps.googleusercontent.com",
      "tenantId":           null,
      "region":             "europe-west2",
      "signInMethod":       "popup"
    },
    "main": { "…": "…" },
    "dev":  { "…": "…" }
  }
}
```

Rules:

- Every value in this file is a public identifier. The leak tripwire (section 9.3) must **not** flag `AIza…` web API keys from this file; add a line-level allow for `config/environments.json` and document why (Firebase web API keys are not secrets; they are restricted by referrer).
- The app reads the active config from `localStorage['sgit.secrets.config.v1']` if present, else from the file's `default`. The Environment page (`/app/environment.html`) lets the user pick a built-in environment or enter a custom one (all fields above), export it as JSON, import one, and reset. `?env=dev` in the URL selects a built-in environment for that load and persists it.
- Nothing secret is ever stored in localStorage. The only other localStorage keys are UI conveniences (`sgit.secrets.ui.theme`, `sgit.secrets.ui.lastEnv`). Every read is wrapped in try/catch and the app works when storage is empty.
- Changing environment signs the user out and clears every in-memory key.
- The active environment is shown in the app header at all times (`prod` in neutral, anything else in a coloured badge) so nobody enters a real secret into `dev` by mistake.

---

## 6. The site

### 6.1 Structure

```
/                         index.html + index.md     what it is, what is shipped, the three-step demo
/how-it-works/            the flows, drawn; what each party can and cannot see
/security/                the threat model (3.4), the RP ID decision, the code-is-the-boundary statement, what we ask you to trust
/keyring/                 the file format (section 8), published as a specification with versions
/sharing/                 the sharing scheme, marked PROPOSED until the UI ships
/environments/            how environments and customer deployments work; the setup guide
/shipped/                 what is built vs proposed vs absent, per feature, generated from data/features.json
/app/                     the application (6.2)
/admin/                   admin pages (6.3)
/tests/                   test and probe pages (6.4)
/docs/design/             the four design docs, rendered
/admin/versions.html      release history, generated
/llms.txt  /llms-full.txt /index.md  /sitemap.xml  /robots.txt  CNAME
/.well-known/             reserved for sgit-agents.json (agent contact) later; not in MVP
```

Every HTML page has a `.md` twin generated from the same source. The chrome (nav, footer, version badge, environment badge on app pages) is one definition in `admin/build/chrome.py`.

### 6.2 App pages (`/app/`)

| Page | Does | Needs |
|---|---|---|
| `index.html` | Sign in; shows environment; routes to setup or unlock | config |
| `setup.html` | First-run: create passkey (PRF), generate keyring, show recovery code once with a "I have written it down" gate | signed in, no keyring |
| `unlock.html` | Passkey assertion with PRF; fallback to recovery code; unlocks into memory | signed in, keyring exists |
| `vault.html` | The list: search, kinds filter, add, open | unlocked |
| `entry.html` | One entry: view/copy with reveal, edit, delete; kind-specific fields | unlocked |
| `devices.html` | Registered passkeys (name, created, last used), add passkey, remove passkey (requires another unlock method to remain), regenerate recovery code | unlocked |
| `environment.html` | Section 5 | — |
| `account.html` | Email, uid, env, sign out, wipe memory, export encrypted keyring (download the ciphertext file), import (replace) | signed in |

Entry kinds (the "kinds kept apart" rule): `password`, `api-key`, `sgit-vault-key`, `sgit-read-key`, `pki-private-key`, `note`. Each kind has its own fields and its own reveal behaviour; an `sgit-vault-key` entry displays its prefix (`sgit_private_vault_…`) and refuses to be put in a shareable (phase 2) set without a confirmation. Kinds are a closed list in `app/kinds.js`, frozen.

Lock behaviour: keys cleared from memory on sign-out, environment change, tab hidden for more than 5 minutes (configurable), and on `beforeunload`. Clipboard copies clear after 30 s where the Clipboard API allows.

### 6.3 Admin pages (`/admin/`)

Admin pages work only when the visitor signs in with a Google account that has IAM on the selected environment's GCP project. There is no "admin role" in the app: the GCP project's IAM is the role, and the pages are a client for GCP's own APIs.

**Auth.** `admin/oauth.js` implements the OAuth 2.0 implicit flow by redirect to `https://accounts.google.com/o/oauth2/v2/auth` with `response_type=token`, `scope=https://www.googleapis.com/auth/cloud-platform`, `client_id` from config, `redirect_uri=https://secrets.sgit.ai/admin/oauth-return.html`, a random `state` kept in sessionStorage; the return page reads the fragment, validates `state`, keeps the access token **in memory only** (never storage), and clears the fragment from history. No external script. Token lifetime is about an hour; the pages re-prompt when a call returns 401. VERIFY FIRST: that Google still issues implicit-flow tokens for a Web application client with these origins; if not, switch to Authorization Code with PKCE using a client of type "Desktop" (no secret required) and note the change.

| Page | Checks / actions | APIs |
|---|---|---|
| `index.html` | Pick environment, sign in, show who you are and which project | `oauth2/v3/tokeninfo`, `cloudresourcemanager/v1/projects/{id}` |
| `setup-checklist.html` | Every section-4.2 item as a row: exists / enabled / configured / **Fix** where fixable client-side | `serviceusage/v1/projects/{id}/services`, `identitytoolkit.googleapis.com/admin/v2/projects/{id}/config`, `…/defaultSupportedIdpConfigs`, `storage/v1/b/{bucket}` (+ `?fields=cors,versioning,iamConfiguration`), `firebaserules.googleapis.com/v1/projects/{id}/releases` |
| `auth-config.html` | Authorised domains (list/add/remove), providers enabled, tenants (list/create) | Identity Toolkit admin v2 |
| `storage.html` | Bucket CORS (show/apply the canonical set), versioning, object count per prefix, soft-delete status | Storage JSON API |
| `rules.html` | Show the deployed Security Rules source vs `infra/rules/storage.rules` in the repo (diff), deploy the repo version | Firebase Rules API: create ruleset, update release |
| `users.html` | Users in Identity Platform (email, uid, providers, created, last sign-in), whether each has a keyring object, disable/enable | `identitytoolkit.googleapis.com/v1/projects/{id}/accounts:batchGet`, Storage list |
| `environment-export.html` | Produce the `config/environments.json` entry for this project from live values (so a customer can paste it) | Firebase Management API `firebase.googleapis.com/v1beta1/projects/{id}/webApps` + `…/config` |

Every write action shows the exact request it will send before sending it, and logs the response on the page. Admin pages never touch a keyring's contents (they cannot; they are ciphertext) and never store the token.

Hardening noted for later, not MVP: move `/admin/` and `/tests/` to their own origin (`admin.secrets.sgit.ai`, second repo) so that nothing with `cloud-platform` tokens runs in the vault's origin.

### 6.4 Test and probe pages (`/tests/`)

Each page is self-contained, runs in the browser, needs no secrets, and prints a result table with PASS/FAIL/SKIP and the raw values behind each row. They double as the compatibility matrix: a visitor can run them on any device and paste the result into an issue.

| Page | Verifies |
|---|---|
| `webauthn-prf.html` | Platform authenticator present; `create` with `prf` extension; `getClientExtensionResults().prf.enabled`; `get` with `prf.eval` returns 32 bytes; same salt → same bytes twice; different salt → different bytes. Registers a throwaway credential under RP ID `secrets.sgit.ai` and tells the user how to delete it |
| `crypto.html` | WebCrypto: HKDF-SHA256, AES-256-GCM, RSA-OAEP-4096 keygen/wrap/unwrap, ECDSA P-256 sign/verify; known-answer tests for the keyring format (section 8) against fixtures in `tests/fixtures/` |
| `config.html` | Active environment, which store it came from, every field present, API key restricted (calls a harmless endpoint and reports) |
| `auth.html` | Sign in to the active environment, report uid/email/tenant, token claims (redacted), sign out |
| `storage.html` | With a signed-in user: write `users/{uid}/_probe` (random bytes), read it back, overwrite with precondition, delete; attempt to read another uid's path and expect 403 |
| `keyring-roundtrip.html` | Full first-run and unlock in one page with a throwaway passkey: create → write → fetch → unlock → compare |
| `offline.html` | What works with the network off (unlock of a cached keyring: no; viewing already-unlocked entries: yes) |
| `leak-check.html` | Scans the page's own localStorage, sessionStorage and IndexedDB for anything that looks like key material; expects none |
| `matrix.html` | Runs the above headlessly in sequence and renders a shareable summary (browser, OS, authenticator, results) |

### 6.5 The content pages: what they say

The site publishes its argument before the thing is finished, in the family's manner. Each content page carries a status line (`shipped vX.Y.Z` / `proposed` / `absent`) generated from `data/features.json`. The homepage leads with the three-step demo (sign in, passkey, see your secret) and a one-line statement of the model, then the "what a compromised admin gets" table, then the shipped/proposed table. No feature is described in the present tense until `features.json` says shipped.

---

## 7. House style (from coding.sgit.ai and nfrs.sgit.ai)

### 7.1 JavaScript

- Native web components, no framework, no build step, ESM everywhere (`<script type="module">`).
- The three-file triplet per component: `sg-secrets-<name>.js/.html/.css` under `components/sg-secrets-<name>/v0/v0.1/v0.1.0/`; `static jsUrl = import.meta.url`; `get resourceName()`; `get sharedCssPaths()`; `onReady()` not `connectedCallback`.
- 4-space indent, single quotes, no semicolons, trailing commas in multi-line literals, aligned object keys, `_` prefix for private, `Object.freeze` on exported constants, JSDoc banner on components.
- Events namespaced `sg-secrets:` through `document` with `bubbles: true, composed: true`.
- Shared state via small modules (`app/state/session.js` holds the unlocked keyring in a closure; nothing exports the raw keys).

### 7.2 HTML / CSS / Python

- HTML fragments 2-space indented; ARIA on controls; `data-*` as the behaviour hook; the chrome is injected by the generator.
- CSS: design tokens in `assets/sg-tokens.css` (copy the family's tokens, pin the version in a comment); `:host` scoping; per-block value alignment.
- Python (generators and tests): Type_Safe style, one class per file, banner comments, no docstrings, `__init__.py` empty; test files `test_*.py` with no mocks (the generators are tested by running them on the tree).

### 7.3 Dependencies: vendored, pinned, hashed

`vendor/` holds every third-party file the app loads, with `vendor/MANIFEST.json` listing source URL, version, SHA-256, licence. The gate (9.3) recomputes the hashes. Expected contents:

- `sg-component.js` (the family base class, copied from the CDN path and pinned) and `sg-tokens.css`.
- Firebase JS SDK modular ESM bundles for `app`, `auth`, `storage` (the `firebase-*.js` files from the pinned gstatic path), referenced by relative import. No runtime fetch from gstatic.
- Nothing else. No crypto libraries: WebCrypto only. No base32/base64 libraries: write the forty lines.

### 7.4 Documentation rules

- Every page has a `.md` twin; `index.md` and `llms.txt` are generated; `llms-full.txt` concatenates every page and every design doc.
- "If the reality document doesn't list it, it does not exist": `docs/reality.md` is the list of what is built, regenerated from `data/features.json` on every release. Briefs are aspirations; this brief is an aspiration until `reality.md` says otherwise.
- Every number on a page comes from a data file or carries an as-of date.
- Agents never push to `dev` directly from a session branch without the gate passing; branch naming `claude/<description>-<session-id>`.

---

## 8. Keyring and crypto specification (v1)

Publish this at `/keyring/` as the format spec. Known-answer fixtures live in `tests/fixtures/keyring-v1/` and the crypto test page checks them.

### 8.1 Objects in the bucket

```
users/{uid}/keyring.json          the encrypted keyring (one object, versioned by GCS)
users/{uid}/meta.json             { "v":1, "createdAt", "keyringRev", "devices":[{"id","name","createdAt","lastUsedAt"}] }   (not secret)
directory/{uid}.pub.json          the user's public-key bundle, signed (phase 1 writes it; phase 2 reads it)
inbox/{uid}/{shareId}.json        keys encrypted to this user (phase 2)
```

### 8.2 Key hierarchy

```
passkey PRF output (32 bytes, from authenticator, never stored)
  └─ HKDF-SHA256(ikm=prf, salt=keyring.prfSalt, info="sgit-secrets/v1/wrap/<credentialId>") → WK_passkey (AES-256-GCM key)
recovery code (26 chars base32, 128 bits, shown once)
  └─ HKDF-SHA256(ikm=code bytes, salt=keyring.prfSalt, info="sgit-secrets/v1/wrap/recovery") → WK_recovery
KEK (32 random bytes)             wrapped once per unlock method, under WK_*
  └─ decrypts body
body (AES-256-GCM under KEK)     { privateKeys, entries[] }
```

PRF input salt: `keyring.prfSalt` (32 random bytes, fixed for the keyring's life) is passed as `prf.eval.first`. One salt for all passkeys; the per-credential HKDF `info` keeps the wrapping keys apart. (The authenticator's PRF is already per-credential; the info string is belt and braces.)

Recovery-code KDF: HKDF alone is fast; an attacker holding the keyring can brute-force a weak code. 128 bits of entropy makes that irrelevant, which is why the code is long and machine-generated, never user-chosen. Do not add PBKDF2 "for safety"; it only slows legitimate recovery.

### 8.3 `keyring.json`

```json
{
  "v": 1,
  "keyringId": "uuid",
  "rev": 7,
  "prfSalt": "base64(32)",
  "wraps": [
    { "id": "pk-<credentialId b64url>", "kind": "passkey",  "name": "MacBook Chrome", "createdAt": "…", "iv": "b64", "ct": "b64" },
    { "id": "recovery-1",               "kind": "recovery", "createdAt": "…",                            "iv": "b64", "ct": "b64" }
  ],
  "body": { "iv": "b64", "ct": "b64", "aad": "keyringId|rev" }
}
```

- `wraps[].ct` is AES-256-GCM of the 32-byte KEK under WK_*, AAD = `keyringId|wrap.id`.
- `body.ct` is AES-256-GCM of the UTF-8 JSON body under KEK, AAD = `keyringId|rev`, so a body cannot be transplanted between keyrings or revisions.
- Decrypted body:

```json
{
  "v": 1,
  "keys": {
    "encrypt": { "alg": "RSA-OAEP-4096", "jwk": { "…private…" } },
    "sign":    { "alg": "ECDSA-P256",    "jwk": { "…private…" } }
  },
  "entries": [
    { "id": "uuid", "kind": "password", "title": "…", "createdAt": "…", "updatedAt": "…", "fields": { "username": "…", "password": "…", "url": "…", "notes": "…" }, "tags": [] }
  ]
}
```

The key pair algorithms match `sgit pki` (RSA-OAEP 4096 for encryption, ECDSA P-256 for signing) so that a phase-2 share envelope can be the sgit hybrid envelope and `sgit pki decrypt` can open what the browser sealed. The public bundle written to `directory/{uid}.pub.json` uses sgit's JSON bundle shape `{v, encrypt, sign, label, fingerprint, signing_fingerprint}` with PEM blocks; VERIFY FIRST against `https://sgit.ai/docs/pki.md` before freezing.

### 8.4 Entry size and documents

Entries are small (soft limit 16 KB each, keyring soft limit 1 MB). Documents are not stored in the keyring: a `document` kind is **absent** in the MVP and, when it comes, will be a pointer to an sgit vault plus that vault's key. Say so on `/shipped/`.

### 8.5 Concurrency

Writes use GCS preconditions: `x-goog-if-generation-match` (via the Firebase SDK's metadata or the JSON API) against the generation read at unlock. On mismatch, re-fetch, re-unlock with the in-memory KEK (no new gesture: the KEK is already in memory), three-way merge entries by `id` and `updatedAt`, bump `rev`, retry once, else surface a conflict page. `rev` is also in the AAD so a stale body fails to decrypt rather than silently winning.

### 8.6 Security Rules (`infra/rules/storage.rules`)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function signedIn()        { return request.auth != null; }
    function isOwner(uid)      { return signedIn() && request.auth.uid == uid; }
    function sameTenant()      { return true; }   // tenant check added when multi-tenancy is on; see admin checklist

    match /users/{uid}/{file=**}   { allow read, delete: if isOwner(uid) && sameTenant();
                                     allow write:        if isOwner(uid) && sameTenant() && request.resource.size < 2 * 1024 * 1024; }
    match /directory/{uid}.pub.json { allow read: if signedIn(); allow write: if isOwner(uid) && request.resource.size < 16 * 1024; }
    match /inbox/{uid}/{shareId}    { allow create: if signedIn() && request.resource.size < 64 * 1024; allow read, delete: if isOwner(uid); }
  }
}
```

The `tests/storage.html` page asserts the owner path works and a foreign path returns 403; `rules.html` in admin diffs this file against what is deployed. VERIFY FIRST the exact rule syntax for the size and null checks; simplify rather than guess.

### 8.7 Passkey details

- `create`: `rp: { id: 'secrets.sgit.ai', name: 'secrets.sgit.ai' }`, `user.id` = 32 random bytes stored in `meta.json` (not the Firebase uid, which is not a secret but should not be a WebAuthn handle either), `pubKeyCredParams` ES256 then RS256, `authenticatorSelection: { residentKey: 'required', userVerification: 'required' }`, `extensions: { prf: {} }`. Check `prf.enabled`; if false, tell the user this authenticator cannot be used for unlock and offer recovery-code-only or another authenticator.
- `get`: `rpId`, `allowCredentials` from `meta.json` devices, `userVerification: 'required'`, `extensions: { prf: { eval: { first: prfSalt } } }`. Read `getClientExtensionResults().prf.results.first`.
- Store the credential id and the public key only in `meta.json` for display and `allowCredentials`; we never verify the assertion signature (there is no server to verify it for; the PRF output is the proof that matters). Say this on `/security/` so nobody assumes a WebAuthn login happened.
- Known support (dated 2026-10-05, re-check on `/tests/webauthn-prf.html`): Chrome/Edge on macOS, Windows and Android with Google Password Manager; Safari 18+ with iCloud Keychain; hardware keys with hmac-secret. Build the matrix page before promising more.

---

## 9. CI/CD and DevOps pipelines

All workflows in `.github/workflows/`. Branch model: work on `claude/*` or feature branches → PR to `dev` → push to `dev` is a release → `main` is promoted from `dev` and is deploy-only (no tag), used as a fallback and as the branch `main` environment tests against.

### 9.1 `deploy-pages.yml` — validate → tag-release → deploy (the house pipeline)

Triggers: push to `dev` and `main`, PR to either, manual dispatch.

| Job | When | Does | On failure |
|---|---|---|---|
| `validate` | always | `python3 admin/build/gen_*.py --check` for every generator; `node admin/build/validate.js`; `python3 -m pytest tests/build/`; `node --test tests/unit/` | nothing tagged or deployed |
| `tag-release` | push to `dev` only | reads `admin/build/version.txt`; finds the newest commit whose subject matches `site vX.Y.Z : …`; asserts equal; asserts next minor (or deliberate major `.0`); backfills missing historical tags idempotently; `git push origin refs/tags/vX.Y.Z` | no deploy |
| `deploy` | any push or dispatch, never PR | assembles the tree minus `.git`, `.github`, `infra`, `tests/unit`, `node_modules`; `upload-pages-artifact`; `deploy-pages` | previous version stays live |
| `verify-live` | after deploy | fetches `https://secrets.sgit.ai/admin/build/version.txt` and the homepage badge until they equal the tag or 10 minutes pass; fails the run otherwise ("green does not mean live") | run is red; site may be stale |

The release commit is not always HEAD (merge commits); anchor on the newest versioned subject. Every push to `dev` is a minor bump; patch versions are for a same-day fix and must still be in the subject.

### 9.2 `infra.yml` — Terraform per environment

Triggers: PR touching `infra/**` (plan only, posted as a PR comment per env), manual dispatch with inputs `environment` ∈ {dev, main, prod, custom} and `action` ∈ {plan, apply}, and push to `dev` for `dev` apply.

- Auth: `google-github-actions/auth@v2` with `workload_identity_provider` and `service_account` from GitHub **environment** variables (`dev`, `main`, `prod` environments; `prod` requires a reviewer).
- `terraform fmt -check`, `validate`, `plan -out`, `apply` the saved plan only.
- After apply: run `infra/scripts/export_env_config.py` which reads Terraform outputs and rewrites that env's block in `config/environments.json`; open a PR to `dev` with the change (never commit directly). The validate gate will refuse a config whose values do not match the environment's Terraform state file hash recorded in the file (`_source` field).
- Secrets: `GOOGLE_OAUTH_CLIENT_SECRET` per GitHub environment. No JSON key files.

### 9.3 The gate: `admin/build/validate.js` (no dependencies)

1. **Version agreement**: `version.txt` == every page badge == versions table row == `llms.txt` == `llms-full.txt` == `index.md` == `config/environments.json#siteVersion`; no version listed twice.
2. **Internal links and fragments** resolve, in every HTML and MD file.
3. **Canonical host**: every page has `rel=canonical` and `og:url` on the host in `CNAME`.
4. **Leak tripwire** on every file in the tree: sgit vault keys (`sgit_private_vault_`, `sgit_private_read_`, passphrase:uuid shape), AWS `AKIA/ASIA`, GitHub `gh[pousr]_`, `sk-`/`sk-ant-`, PEM private key blocks, Slack `xox[bpa]-`, Google OAuth client secrets (`GOCSPX-`), service-account JSON (`"private_key_id"`), bare 12-digit numbers. Allow-list: `validate.js` itself and `config/environments.json` for `AIza` web keys only. The fix for a trip is always a redaction, never a wider pattern.
5. **Vendor manifest**: every file under `vendor/` matches its SHA-256 in `MANIFEST.json`; no `<script src="http` or `import 'http` anywhere under `app/`, `components/`, `admin/`, `tests/` except the allow-listed Google auth hosts in `app/auth/`.
6. **Storage rules in sync**: `infra/rules/storage.rules` hash equals the hash recorded in `data/features.json#rulesHash` (so a rules change without a release note fails).
7. **Reality**: `docs/reality.md` regenerated from `data/features.json` with `--check`.
8. **No storage of secrets in code**: grep for `localStorage.setItem(` and assert each key is in the allowed list in `app/config/storage-keys.js`.

### 9.4 Other workflows

- `tests-browser.yml`: on PR and nightly, Playwright (Chromium) runs `tests/e2e/` against a local `python3 -m http.server` of the tree with `?env=dev`, using a Firebase email/password test user created by Terraform in `dev` only and a **virtual authenticator** (CDP `WebAuthn.addVirtualAuthenticator` with `hasPrf: true` VERIFY FIRST; if the virtual authenticator cannot do PRF, the e2e covers everything up to the gesture and the PRF path stays on the manual matrix). Credentials for the test user are GitHub environment secrets; they protect nothing but `dev`.
- `rules.yml`: manual dispatch `deploy rules to <env>`; same WIF auth; `firebase deploy --only storage` or the Rules API; posts the ruleset name.
- `link-check.yml`: weekly external link check, opens an issue.
- `dependabot.yml` is **off** (no package.json for the app); `vendor/` updates are a manual, reviewed PR with hash changes.

### 9.5 Repository protections (the boundary, section 3.4)

Set on day one and listed on `/security/`:

- `dev` and `main` protected: PR required, one review, no force-push, linear history; status checks `validate` required.
- All org members with write: hardware-key 2FA (org setting).
- Actions: pin every third-party action by commit SHA; `permissions:` minimal per job (`contents: read`, `pages: write`, `id-token: write` only where needed); environment `prod` with required reviewers; `GITHUB_TOKEN` not allowed to approve PRs.
- Verified domain `sgit.ai` in the GitHub org (subdomain-takeover guard). DNS: registrar lock, DNSSEC and a CAA record are the DNS owner's job; the security page says whether they are in place (dated).
- `<meta http-equiv="Content-Security-Policy">` on every app/admin/test page: `default-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://accounts.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com; frame-src https://*.firebaseapp.com https://accounts.google.com; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. Plus a frame-busting check (`if (top !== self) …`) since `frame-ancestors` cannot be set in a meta tag. Keep the list exact and tested on `tests/config.html`.

---

## 10. Testing

| Layer | Where | Runs | Covers |
|---|---|---|---|
| Unit (Node ≥ 22, WebCrypto) | `tests/unit/*.test.js` | gate | keyring encode/decode, KATs, HKDF info strings, merge logic, base32, config loader, kinds |
| Build | `tests/build/test_*.py` | gate | generators on the real tree, chrome in every page, twins exist, features.json schema |
| Browser probe pages | `/tests/` | humans and the matrix | PRF, auth, storage, rules, CSP |
| E2E | `tests/e2e/` Playwright | PR, nightly | sign in → setup → add entry → lock → unlock → see entry → new device via recovery code |
| Acceptance | `docs/acceptance.md` | before 1.0 | an Owner of the `dev` project is handed a uid and asked to produce one plaintext field; the write-up of the attempt is published |

No mocks: the unit tests run the real WebCrypto; the e2e runs the real `dev` project. The only stand-in is the virtual authenticator, and only if it does PRF.

---

## 11. Build order

Every step ends with a release (`site vX.Y.Z : …`) and an entry in `data/features.json` so `/shipped/` and `docs/reality.md` are true at every version.

| Step | Version | Deliverable | Acceptance |
|---|---|---|---|
| 1 | v0.1.0 | **The pipeline before the site**: repo layout, `version.txt`, chrome generator, placeholder index with badge, `validate.js` with all eight checks, `deploy-pages.yml` incl. `verify-live`, CNAME, DNS note for Dinis (`secrets` CNAME → `sgit-ai.github.io`), branch protections, `docs/design/` copied in | A push to `dev` tags v0.1.0 and `verify-live` passes against `secrets.sgit.ai` |
| 2 | v0.2.0 | Content pages (6.1, 6.5) with everything marked proposed; `/shipped/` generated; `.md` twins; `llms.txt`/`llms-full.txt`; sitemap | Gate green; every claim on the site carries a status |
| 3 | v0.3.0 | `infra/bootstrap`, Terraform module + `dev` env, `infra.yml`, Security Rules, `config/environments.json` with `dev` real and `main`/`prod` placeholders; environment page; vendored Firebase; sign-in/out with Google and email/password against `dev` | `tests/auth.html` and `tests/storage.html` pass on `dev`; admin checklist exists as read-only and is green for `dev` |
| 4 | v0.4.0 | PRF probe page; keyring v1 library with unit KATs; setup and unlock flows; recovery code | `tests/keyring-roundtrip.html` passes on Chrome + Safari; e2e passes to "unlock" |
| 5 | v0.5.0 | Entries: kinds, vault list, entry page, copy/reveal, lock timers, concurrency merge | e2e passes end to end; soft limits enforced |
| 6 | v0.6.0 | Devices page: add/remove passkey, regenerate recovery; account export/import; `meta.json` | Second-device flow passes manually on a phone; matrix page shipped with the first three rows |
| 7 | v0.7.0 | Admin pages with fixes: auth-config, storage, rules diff/deploy, users, environment-export; `rules.yml` | A fresh `main` project is brought from bootstrap to green checklist using only the admin pages and Terraform, timed and written up in `docs/ops/new-environment.md` |
| 8 | v0.8.0 | `prod` environment live; homepage demo real; security page final; acceptance test performed and published | `/shipped/` shows the MVP rows as shipped; acceptance write-up published |
| 9 | v0.9.0 | Phase 2 data only: public bundle written to `directory/`, inbox rules live, sharing UI still proposed | `sgit pki` can import the published bundle (VERIFY) |

Do not start step 4 until step 3's probe pages are green on a real `dev` project; do not start step 7 before step 6, because the admin users page needs `meta.json`.

---

## 12. Open questions, and what not to do

**Open (test, then record the answer in `docs/design/brief-corrections.md`):**

- Does the Playwright virtual authenticator support PRF? Decides how much of the e2e is automated.
- Does Google's implicit flow still work for a Web client with our origins? Decides the admin auth implementation (6.3).
- Exact Security Rules syntax for size/null checks (8.6), and whether `request.auth.token.firebase.tenant` is available in Storage rules.
- Where Identity Platform stores user records (data residency note for `/environments/`).
- Does `sgit pki import` accept a browser-generated bundle (8.3)? Decides whether phase-2 envelopes are sgit-native.

**Do not:**

- Do not add a server, a Cloud Function, a proxy or "just a small API". If something needs one, it is out of scope and goes in `docs/design/brief-corrections.md` as a proposal.
- Do not store anything derived from a key in any browser storage, even "encrypted".
- Do not load any script from any origin at runtime. Vendor it, hash it, or do without.
- Do not use the apex domain as RP ID, ever, even on `localhost` testing (use `localhost` as RP ID there).
- Do not put a `document` kind, a browser extension, autofill, or an agent API in the MVP. Each is a later site or a later version.
- Do not describe a feature in the present tense before `features.json` says shipped.

---

## 13. The prompt to paste into the Claude Code session

```
You are working in SGit-AI/SGit-AI__Website__Secrets, the repository for secrets.sgit.ai, a static site on GitHub Pages that is also a zero-knowledge, browser-only secrets manager backed by one GCP project per environment (Identity Platform + Cloud Storage for Firebase). Read docs/design/secrets-sgit-ai__mvp-build-brief.md in full first; it is the instruction set, and sections 1–4 hold decisions that are closed. Then read the four design documents it names in docs/design/. House style is https://coding.sgit.ai/llms-full.txt and https://nfrs.sgit.ai/llms.txt; section 7 of the brief extracts what applies.

Rules you never break: no server-side code of any kind; plaintext only in the browser after a passkey gesture; nothing secret in the repo; no build step and no runtime script from any other origin (vendor and hash instead); the passkey RP ID is exactly secrets.sgit.ai; every push to dev is a release tagged by CI from admin/build/version.txt and a commit subject of the form "site vX.Y.Z : <what>"; a release that fails the gate locally fails the same way in CI; every claim on the site carries a status from data/features.json.

Work through section 11 in order. Step 1 is the pipeline before the site: layout, version file, chrome generator, the eight-check gate in admin/build/validate.js, deploy-pages.yml with validate → tag-release → deploy → verify-live, CNAME, branch protection notes, and docs/design/ populated. Do not begin step 4 until the dev GCP project exists and tests/auth.html, tests/storage.html and tests/webauthn-prf.html are green against it. When the brief is wrong, write what you found in docs/design/brief-corrections.md and continue; when something needs a human (DNS, billing, bootstrap, reviewer approval), stop and list exactly what you need in docs/ops/needs.md.

Start by printing the repository layout you intend to create and the contents of version.txt, then create step 1.
```

---

*Written from the Risk Mandate / sgit design session of 4–5 October 2026. Companion documents: the four design docs in section 2. This brief is itself to be published at `/docs/design/` on the site, with its corrections file beside it.*
