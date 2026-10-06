# Security

> The threat model: what each compromised party gets and does not get. Why the passkey RP ID is exactly secrets.sgit.ai and never sgit.ai. Why the code served to your browser is the boundary, and what we ask you to trust.

*Source: <https://secrets.sgit.ai/security/> · site v0.1.12 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [proposed](/review/ui/#node=claim.site.repo-protections) Branch protection, hardware-key 2FA, verified domain and the Actions policy in place and dated on /security/ · [proposed](/review/ui/#node=claim.tests.acceptance) Acceptance: an Owner of the dev project is handed a uid and asked to produce one plaintext field · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai

This page says what the design withholds from whom, and then says plainly what it cannot withhold. It describes a design. The acceptance test that will check it, an Owner of the [GCP project](/learn/gcp/index.md#gcp) being handed a uid and asked to produce one plaintext field, is listed as proposed above and its write-up will be published whatever the result.

## What a compromised party gets

| Party compromised | Gets | Does not get |
|---|---|---|
| GCP project, or the [Identity Platform](/learn/gcp/index.md#identity-platform) admin | User emails, login metadata, ciphertext, the ability to delete or roll back, the ability to log in as anyone | Any plaintext. The [PRF](/learn/passkeys/index.md#prf) output is bound to the origin and to the user's [authenticator](/learn/passkeys/index.md#authenticator); logging in as the user fetches ciphertext and nothing to open it with |
| Bucket reader | Ciphertext, object sizes and times | Plaintext |
| [Terraform](/learn/gcp/index.md#terraform) pipeline | Can change the rules, delete the [bucket](/learn/gcp/index.md#bucket) | Plaintext |
| Public-key directory tamperer (phase 2) | Future shares, unless fingerprints or signatures are checked | Existing keys |
| **This repository, or the DNS for sgit.ai** | **Everything, for the users who load the malicious page while it is served** | Nothing is withheld |

## The code is the boundary

Client-side cryptography is exactly as trustworthy as the code delivered to the browser. If this repository, the GitHub organisation that owns it, or the DNS zone for `sgit.ai` is compromised, the attacker can serve a page that asks for your [passkey](/learn/passkeys/index.md#passkey) gesture and sends the plaintext wherever they like. No amount of cloud hardening changes that, and the design does not pretend otherwise.

What it does instead is keep the site on a host that is separate from the GCP project, so that a cloud compromise does not reach the code, and put every guard it can on the repository:

| Guard | What it stops | In place? |
|---|---|---|
| `dev` and `main` protected: pull request required, one review, `validate` required, linear history, no force-push, no bypass for administrators | A single account pushing code to users | Unconfirmed as of 2026-10-05; asked for in [needs.md](/docs/ops/needs.md) |
| Hardware-key two-factor authentication for every organisation member | A phished password becoming a push | Unconfirmed as of 2026-10-05 |
| `sgit.ai` verified as an organisation domain | Another account claiming a dangling `*.sgit.ai` subdomain on Pages | Unconfirmed as of 2026-10-05 |
| Every third-party action pinned by commit SHA; minimal `permissions` per job; Actions may not approve pull requests | A compromised action or token widening its own reach | Pins and permissions: yes, since v0.1.0. Organisation policy: unconfirmed |
| No build step; every dependency vendored and hashed; the gate refuses any script from another origin | A supply-chain change arriving at runtime without a reviewed diff | Yes, since v0.1.0 (check 5 of the gate) |
| A leak tripwire over every file on every release | A credential entering the public tree | Yes, since v0.1.0 (check 4) |
| Registrar lock, DNSSEC and a CAA record on `sgit.ai` | The zone being moved or a rogue certificate issued | The DNS owner's decision; unconfirmed as of 2026-10-05 |
| A Content-Security-Policy on every page: `script-src 'self'`, `style-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'` | An injected script or form, if some other flaw let one in | Yes, since v0.1.0, on every page; `frame-ancestors` cannot be set in a meta tag, so app pages will add a frame-busting check |

Each "unconfirmed" row flips to a dated "yes" when the person who can check it has. The repository's own copy of these settings is [docs/ops/branch-protection.md](/docs/ops/branch-protection.md).

<a id="rp-id"></a>

## The RP ID is secrets.sgit.ai, never sgit.ai

A [WebAuthn](/learn/passkeys/index.md#webauthn) passkey is scoped to a [relying-party identifier](/learn/passkeys/index.md#rp-id), and the PRF secret it returns is derived per credential and per RP ID. The RP ID for the unlock passkey is exactly `secrets.sgit.ai` (and `localhost` when testing locally).

It is never the apex `sgit.ai`, and this is the single most important decision in the design. A passkey scoped to the apex can be asserted by any page on any subdomain: there are more than twenty-seven sibling sites under `sgit.ai`, each in its own repository, and a compromise of any one of them would then be able to ask for the [gesture](/learn/passkeys/index.md#gesture) that unlocks every user's secrets here. Scoping to this host means a sibling's compromise is a sibling's problem.

Consumers such as riskmandate.ai will use their own passkeys, or WebAuthn Related Origin Requests, later. Neither is in the MVP.

<a id="passkey-use"></a>

## What the passkey is, and is not, used for

The passkey is a plain WebAuthn credential registered by this site's own page. It is **not** an Identity Platform passkey and it is not a login. The page never verifies the assertion signature, because there is no server to verify it for: the proof that matters is that the PRF output unwraps the [keyring key](/learn/keys/index.md#kek), and a wrong authenticator produces bytes that unwrap nothing. Login is a separate step, through Identity Platform, and decides only which bucket paths the browser may read and write.

The credential's id and public key are stored in `meta.json` so the page can list devices and build `allowCredentials`. The WebAuthn [user handle](/learn/passkeys/index.md#user-handle) is 32 random bytes, not the [Firebase uid](/learn/gcp/index.md#uid).

The whole of this, from four sides and with the calls drawn, is on [Passkeys, WebAuthn and PRF](/learn/passkeys/index.md); the keys the bytes become are on [Keys](/learn/keys/index.md); and the [passkey lab](/learn/passkeys/index.md#lab) lets you run the two calls in this browser now.

## What we ask you to trust

- **Your authenticator.** Google Password Manager, iCloud Keychain or a hardware key holds the PRF secret and syncs it through your personal account, which no administrator of this service can reach.
- **Your browser's WebCrypto.** [AES-256-GCM](/learn/keys/index.md#aes-gcm), [HKDF-SHA256](/learn/keys/index.md#hkdf), RSA-OAEP and ECDSA come from the browser; the site vendors no cryptographic library.
- **This repository, as served.** Everything above this heading is about keeping that trust narrow and visible. You can read every line that will run, and the gate publishes what it checks.
- **Google, for availability and metadata only.** Google can see who signed in and when, can delete or roll back ciphertext, and can refuse service. Bucket versioning and soft-delete retention are the design's answer to deletion; export of the encrypted [keyring](/keyring/index.md) from the account page is yours.

## What this page does not claim

- That the system exists. See [/shipped/](/shipped/index.md).
- That the [Security Rules](/learn/gcp/index.md#rules) are correct. The rules text is in the repository and hashed; it is deployed to nothing yet, and its syntax is marked "verify first" in the brief.
- That the compatibility of PRF across authenticators is known. The matrix page (proposed) will say which browsers and authenticators returned PRF output, dated.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/security/)*
