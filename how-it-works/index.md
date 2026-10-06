# How it works

> The four flows of the design, drawn: first run, returning, new device, admin. What each party can and cannot see at every step. All of it is proposed; nothing on this page is built yet.

*Source: <https://secrets.sgit.ai/how-it-works/> · site v0.1.13 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.keyring-v1) Keyring v1 format: wraps per unlock method, AES-256-GCM body, known-answer tests · [proposed](/review/ui/#node=claim.app.devices) Devices page: add and remove passkeys, regenerate the recovery code

Two things decide what you can do. The **login** decides which paths in the [bucket](/learn/gcp/index.md#bucket) you may touch. The **[passkey](/learn/passkeys/index.md#passkey)** decides whether the bytes there mean anything. They are deliberately separate: an administrator of the login can fake the first and can never fake the second.

This page describes the design in section 3 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). Every flow on it is *proposed*. The status line above is generated from `data/features.json` and changes when the code ships.

## The parts

| Layer | Component | Where it runs | What it is trusted with |
|---|---|---|---|
| Site and app | Static HTML, JS and CSS from this repository, on GitHub Pages at `secrets.sgit.ai` | Your browser | **The boundary.** Whoever controls this repository or the DNS controls the app |
| Login | [Identity Platform](/learn/gcp/index.md#identity-platform), through the vendored Firebase Auth SDK | Google | Can impersonate; cannot decrypt |
| Storage | A Cloud Storage for Firebase bucket with [Security Rules](/learn/gcp/index.md#rules) | Google | Holds ciphertext; can delete |
| Unlock | A [WebAuthn](/learn/passkeys/index.md#webauthn) passkey with the [PRF extension](/learn/passkeys/index.md#prf), [RP ID](/learn/passkeys/index.md#rp-id) `secrets.sgit.ai` | Your [authenticator](/learn/passkeys/index.md#authenticator): Google Password Manager, iCloud Keychain or a hardware key | The only thing that can decrypt |
| Admin | The same static pages, calling [GCP](/learn/gcp/index.md#gcp)'s own REST APIs with your Google account's token | Your browser | Works only if your Google account has IAM on the project |
| Infrastructure | [Terraform](/learn/gcp/index.md#terraform) in this repository, applied by GitHub Actions through [Workload Identity Federation](/learn/gcp/index.md#wif) | GitHub Actions | Can reconfigure or delete; cannot read |

## First run

```

sign in ──▶ no keyring at users/{uid}/keyring.json
        ──▶ create a passkey with the PRF extension       (your authenticator asks for a gesture)
        ──▶ generate: KEK (32 random bytes), a key pair, a recovery code
        ──▶ wrap the KEK under the passkey's PRF output and under the recovery code
        ──▶ encrypt the body under the KEK; write keyring.json and meta.json to the bucket
        ──▶ show the recovery code once, behind "I have written it down"

```

What leaves the browser: ciphertext, two wrapped copies of the [KEK](/learn/keys/index.md#kek), a 32-byte [PRF salt](/learn/keys/index.md#prf-salt), and `meta.json` with the passkey's [credential id](/learn/passkeys/index.md#credential) and public key. What never leaves: the PRF output, the KEK, the [recovery code](/learn/keys/index.md#recovery-code), the private keys, any entry.

## Returning

```

sign in ──▶ fetch keyring.json (and remember its generation number)
        ──▶ navigator.credentials.get with prf.eval.first = prfSalt   (one gesture)
        ──▶ HKDF-SHA256(prf output, salt, "sgit-secrets/v1/wrap/<credentialId>") → wrapping key
        ──▶ unwrap the KEK; decrypt the body into memory
        ──▶ the vault list

```

Nothing decrypted is written anywhere: not to localStorage, sessionStorage, IndexedDB, the URL or a log. The gate checks the code for that on every release (check 8 on [the admin page](/admin/index.md)). Keys are cleared from memory on sign-out, on an environment change, when the tab has been hidden for five minutes, and on `beforeunload`.

## New device

```

sign in ──▶ fetch keyring.json
        ──▶ unlock with a synced passkey, a cross-device passkey (QR), or the recovery code
        ──▶ register a new passkey on this device
        ──▶ add a wrapped-KEK entry for it; bump rev; write with an if-generation-match precondition

```

Lose every passkey and the recovery code, and the data is gone. There is no reset, because nothing that could reset it exists anywhere but your authenticator and your note of the code. The site will say this on the setup page in the same words.

## Admin

```

open /admin/ ──▶ choose an environment
             ──▶ "Sign in with Google for admin" (OAuth, scope cloud-platform, token held in memory only)
             ──▶ each check calls a GCP API: exists / enabled / configured / Fix

```

There is no admin role in the app. The GCP project's IAM is the role; the pages are a client for GCP's APIs. An admin page can list users, deploy rules and change CORS. It cannot open a [keyring](/keyring/index.md), because a keyring is ciphertext and the admin's token unlocks nothing.

## What each party can see

| Step | Google (Identity Platform, bucket) | GitHub (the site) | Your authenticator | Your browser |
|---|---|---|---|---|
| Sign in | Your email, the sign-in event, your uid | Nothing (static files) | Nothing | An ID token |
| Fetch keyring | That uid read that object | Nothing | Nothing | Ciphertext |
| Passkey [gesture](/learn/passkeys/index.md#gesture) | Nothing | Nothing | The PRF secret for this credential and this origin | 32 bytes of PRF output, briefly |
| Unlock | Nothing | Nothing | Nothing | The KEK and the plaintext body, in memory |
| Write | New ciphertext, the object's size and time | Nothing | Nothing | Everything it already had |

The one party absent from that table is whoever serves the JavaScript. The code your browser runs is the boundary of the whole design, which is why the [security page](/security/index.md) is mostly about this repository.

## Read next

- [The keyring format](/keyring/index.md): what is in the file, what is encrypted under what, and why the recovery code is long.
- [Security](/security/index.md): the threat model and the RP ID decision.
- [Environments](/environments/index.md): one site, one GCP project per environment, and how a customer runs their own.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/how-it-works/)*
