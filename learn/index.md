# Learn: the parts, explained in context

> Explanations in context: what a passkey, WebAuthn, PRF, the key hierarchy and the GCP project are from this site's point of view, with diagrams, a glossary every page links into, and a lab where you try the passkey in your own browser.

*Source: <https://secrets.sgit.ai/learn/> · site v0.1.13 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.12](/review/ui/#node=claim.site.learn) Learn pages: passkeys, WebAuthn and PRF; keys from PRF to plaintext; GCP from this site's side; each term defined once in data/terms.json and linked from its first use on every content page; flow diagrams drawn by the build as inline SVG with a text twin · [shipped v0.1.12](/review/ui/#node=claim.site.passkey-lab) The passkey lab on /learn/passkeys/: create lab passkeys in this browser under this host's RP ID, ask for PRF bytes, derive the wrapping key, wrap a lab KEK, encrypt a lab body, unlock again with the same or a second passkey, and watch what is stored where; headless in the build against Chromium's virtual authenticator with PRF · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai

The design pages say what this site does. These pages say what the words mean, here, for this site, and nowhere more general than that: what a [passkey](/learn/passkeys/index.md#passkey) is when it is the thing that unlocks your [keyring](/keyring/index.md), what the [PRF](/learn/passkeys/index.md#prf) bytes are, where each key comes from and goes, and what [Google Cloud](/learn/gcp/index.md#gcp) sees. Every term below is linked from the first place it appears on any page of the site, and the reader's column lists the terms a page uses.

## The pages

| Page | Answers | Try it |
|---|---|---|
| [Passkeys, WebAuthn and PRF](/learn/passkeys/index.md) | What a passkey is and is not here; the two [WebAuthn](/learn/passkeys/index.md#webauthn) calls, drawn; what your [authenticator](/learn/passkeys/index.md#authenticator), your browser, this site and Google each store; why one site, one [RP ID](/learn/passkeys/index.md#rp-id); what happens with two passkeys | [The passkey lab](/learn/passkeys/index.md#lab): create a lab passkey in this browser, ask it for PRF bytes, derive the [wrapping key](/learn/keys/index.md#wrapping-key), wrap and unwrap a lab [KEK](/learn/keys/index.md#kek), add a second passkey, and watch what is stored where |
| [Keys: from PRF to plaintext](/learn/keys/index.md) | Is there a [passphrase](/learn/keys/index.md#passphrase) (no); the [PRF salt](/learn/keys/index.md#prf-salt); [HKDF](/learn/keys/index.md#hkdf); the wrapping keys; the KEK; [AES-256-GCM](/learn/keys/index.md#aes-gcm); the [recovery code](/learn/keys/index.md#recovery-code) and why it is long; what is in memory, when | The lab's steps 3 and 4 run this chain on real WebCrypto, with the bytes shown |
| [GCP, from this site's side](/learn/gcp/index.md) | What the project is for; [Identity Platform](/learn/gcp/index.md#identity-platform) and the uid; the [bucket](/learn/gcp/index.md#bucket) and the [Security Rules](/learn/gcp/index.md#rules); [Terraform](/learn/gcp/index.md#terraform) and [Workload Identity Federation](/learn/gcp/index.md#wif); what Google sees and cannot see | The admin checklist on [/admin/](/admin/index.md), once a project exists (needs a human; see [needs.md](/docs/ops/needs.md)) |

<a id="glossary"></a>

## The glossary

One entry per term, in this site's context. The data is `data/terms.json`; the build links the first occurrence of each term on every content page and sets the definition as the link's hover text, so a definition is written once.

<a id="term-aes-gcm"></a>
**[AES-256-GCM](/learn/keys/index.md#aes-gcm) also: AES-GCM**
: The authenticated cipher the browser provides; every wrap and the body use it, so a wrong key or a tampered byte fails loudly instead of decrypting to garbage.

<a id="term-authenticator"></a>
**[authenticator](/learn/passkeys/index.md#authenticator) also: authenticators, platform authenticator**
: Whatever holds the passkey's private key and PRF secret: Google Password Manager, iCloud Keychain, Windows Hello or a hardware key; it never hands the secret out, only results computed with it.

<a id="term-bucket"></a>
**[bucket](/learn/gcp/index.md#bucket) also: Cloud Storage, Cloud Storage for Firebase**
: The Cloud Storage bucket where users/{uid}/keyring.json and meta.json live, versioned, reachable from the browser directly with the login's token.

<a id="term-credential-id"></a>
**[credential id](/learn/passkeys/index.md#credential) also: credentialId, allowCredentials**
: The public identifier of one passkey, stored in meta.json so the page can list your devices and ask the authenticator for that passkey by name.

<a id="term-uid"></a>
**[Firebase uid](/learn/gcp/index.md#uid) also: users/{uid}**
: The login's stable id for a user; it names the user's prefix in the bucket and appears in the rules, and it is not a secret.

<a id="term-gcp"></a>
**[GCP](/learn/gcp/index.md#gcp) also: Google Cloud, GCP project**
: The Google Cloud project that holds the login and the bucket for one environment; it sees who signed in and stores ciphertext, and can open none of it.

<a id="term-gesture"></a>
**[gesture](/learn/passkeys/index.md#gesture) also: passkey gesture**
: The touch, face, PIN or tap your authenticator asks for before it computes anything; one gesture per unlock, and nothing happens without it.

<a id="term-hkdf"></a>
**[HKDF](/learn/keys/index.md#hkdf) also: HKDF-SHA256**
: The standard key-derivation function the browser provides; turns 32 PRF bytes (or the recovery code) plus a salt and a label into a wrapping key, deterministically.

<a id="term-identity-platform"></a>
**[Identity Platform](/learn/gcp/index.md#identity-platform) also: Firebase Auth**
: Google's login service, used through the vendored Firebase Auth SDK; the login decides which bucket paths you may touch and nothing else.

<a id="term-kek"></a>
**[KEK](/learn/keys/index.md#kek) also: keyring key**
: The keyring's one real key: 32 random bytes that encrypt the body, themselves stored only wrapped, once per unlock method.

<a id="term-keyring"></a>
**[keyring](/keyring/index.md) also: keyring.json**
: The one encrypted file per user in the bucket: the PRF salt, the wrapped copies of the KEK, and the encrypted body with the entries; version 1 is specified on its own page.

<a id="term-meta-json"></a>
**[meta.json](/learn/passkeys/index.md#storage)**
: The small public file next to the keyring in the bucket: the user handle, each passkey's credential id, public key and name, and the keyring revision; nothing secret.

<a id="term-passkey"></a>
**[passkey](/learn/passkeys/index.md#passkey) also: passkeys**
: A WebAuthn credential your authenticator keeps and syncs; here it is the thing that unlocks your keyring, not a login.

<a id="term-passphrase"></a>
**[passphrase](/learn/keys/index.md#passphrase) also: master password**
: There is none. Nothing you type unlocks the keyring; the passkey's PRF output and the machine-made recovery code are the only unlock methods, by design.

<a id="term-prf"></a>
**[PRF](/learn/passkeys/index.md#prf) also: PRF extension, hmac-secret**
: The WebAuthn extension that makes the authenticator return 32 secret bytes for a given input, the same bytes every time for the same passkey, origin and input; those bytes are what derives the wrapping key.

<a id="term-prf-salt"></a>
**[PRF salt](/learn/keys/index.md#prf-salt) also: prfSalt, prf.eval**
: 32 random public bytes fixed for the keyring's life, given to every passkey as the PRF input; stored in keyring.json in the clear, because it is an input, not a secret.

<a id="term-recovery-code"></a>
**[recovery code](/learn/keys/index.md#recovery-code)**
: 26 characters of base32, 128 random bits, shown once at first run: the one unlock method that lives in your head or on paper, and the only way back in when every passkey is gone.

<a id="term-rp-id"></a>
**[RP ID](/learn/passkeys/index.md#rp-id) also: relying-party identifier, rpId**
: The host a passkey is scoped to; here exactly secrets.sgit.ai (localhost when testing), never sgit.ai, so no sibling site can ask for the gesture.

<a id="term-security-rules"></a>
**[Security Rules](/learn/gcp/index.md#rules) also: storage.rules**
: The rules file Google enforces in front of the bucket: a signed-in user may read and write only their own prefix, with size limits; the whole access control of the MVP.

<a id="term-terraform"></a>
**[Terraform](/learn/gcp/index.md#terraform)**
: The infrastructure description in infra/terraform/ that creates each environment's project, login, bucket and rules, applied by GitHub Actions; it can delete and reconfigure, and cannot read.

<a id="term-user-handle"></a>
**[user handle](/learn/passkeys/index.md#user-handle) also: user.id**
: The 32 random bytes a passkey is registered under; not your email and not the Firebase uid, so the authenticator learns nothing about the account.

<a id="term-webauthn"></a>
**[WebAuthn](/learn/passkeys/index.md#webauthn)**
: The browser API (navigator.credentials) that creates a passkey and later asks your authenticator to prove it still has it; the only API this site uses to talk to the authenticator.

<a id="term-wif"></a>
**[Workload Identity Federation](/learn/gcp/index.md#wif) also: WIF**
: How GitHub Actions gets a GCP identity without a stored key: the pipeline presents its own token and GCP trusts it for this one repository and branch.

<a id="term-wrapping-key"></a>
**[wrapping key](/learn/keys/index.md#wrapping-key) also: WK, WK_passkey, WK_recovery**
: An AES key derived from one unlock method (a passkey's PRF output, or the recovery code) whose only job is to encrypt the KEK; a different one per passkey.

## How these pages are made

The diagrams are drawn by the build from `data/diagrams/` into the page as inline SVG that uses the theme's colours, with the same diagram as text underneath for copying and for the markdown twin; no library, no script. The lab is a web component in the house shape, `components/passkey-lab/`, and it talks to nothing but your authenticator: no Google, no bucket, no network. What it keeps in this browser is listed on its page, and the gate checks that list on every release.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/learn/)*
