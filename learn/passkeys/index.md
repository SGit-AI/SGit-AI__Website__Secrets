# Passkeys, WebAuthn and PRF, in this site's context

> What a passkey is when it is the thing that unlocks your keyring: the two WebAuthn calls, the PRF extension, the RP ID, what your authenticator, your browser, this site and Google each store, what two passkeys mean, and a lab to try all of it in your own browser.

*Source: <https://secrets.sgit.ai/learn/passkeys/> · site v0.1.13 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.devices) Devices page: add and remove passkeys, regenerate the recovery code · [shipped v0.1.12](/review/ui/#node=claim.site.passkey-lab) The passkey lab on /learn/passkeys/: create lab passkeys in this browser under this host's RP ID, ask for PRF bytes, derive the wrapping key, wrap a lab KEK, encrypt a lab body, unlock again with the same or a second passkey, and watch what is stored where; headless in the build against Chromium's virtual authenticator with PRF · [proposed](/review/ui/#node=claim.tests.probe-pages) Browser probe pages: webauthn-prf, crypto, config, auth, storage, keyring-roundtrip, offline, leak-check, matrix

On most sites a passkey is a login. Here it is not. The login is a separate thing, through Google, and decides which files you may fetch. The passkey decides whether those files mean anything, because it is the only thing in the world that can produce the 32 bytes the [keyring](/keyring/index.md) is locked with. This page explains that one idea from four sides: the authenticator, the browser API, this site's files, and Google. The unlock itself is *proposed*; the lab at the end is shipped and runs in your browser now.

<a id="passkey"></a>

## What a passkey is, here

A passkey is a key pair that your authenticator made and keeps for one site. You never see the private key; the authenticator only ever uses it to answer a challenge, after you give a gesture. Passkeys sync through the account the authenticator belongs to (Google Password Manager through your Google account, iCloud Keychain through your Apple ID), or they do not sync at all (a hardware key), and no administrator of this site is on that path.

This site uses one extra thing a passkey can do: with the PRF extension the authenticator will also return 32 bytes computed from a secret it made alongside the key pair, given an input of our choosing. Same passkey, same site, same input, same bytes, every time. Those bytes are the root of every key in the keyring ([Keys](/learn/keys/index.md)). So the passkey is used as a **key**, not as a proof of identity: the page never checks the signature a passkey returns, because there is no server to check it for, and because the proof that matters is simpler: a wrong authenticator produces bytes that unwrap nothing.

<a id="authenticator"></a>

## The four parties, and what each one holds

<a id="storage"></a>

| Party | Holds | Never holds |
|---|---|---|
| **Your authenticator**: Google Password Manager, iCloud Keychain, Windows Hello, or a hardware key | The private key and the PRF secret for this site, under the user handle; synced through your own account, or not at all | Your email, the [Firebase uid](/learn/gcp/index.md#uid), anything about the keyring; it does not know what the bytes are for |
| **Your browser**, running this page | During an unlock, in memory: the 32 PRF bytes, the [wrapping key](/learn/keys/index.md#wrapping-key), the [KEK](/learn/keys/index.md#kek), the plaintext body. Nothing of that after sign-out, five hidden minutes, or unload | Any of it in localStorage, sessionStorage, IndexedDB, the URL or a log; the gate's check 8 reads every storage key the code may write |
| **This site's files in the [bucket](/learn/gcp/index.md#bucket)** | `meta.json`: the user handle, each passkey's credential id, public key and name; `keyring.json`: the [PRF salt](/learn/keys/index.md#prf-salt) (public) and the KEK wrapped once per passkey | The PRF bytes, the KEK, the [recovery code](/learn/keys/index.md#recovery-code), a plaintext entry |
| **Google**: [Identity Platform](/learn/gcp/index.md#identity-platform) and the bucket | Who signed in, when; the ciphertext and its sizes and times; the power to delete or roll back | Anything that opens the ciphertext: the PRF secret is bound to the origin and to your authenticator, so signing in as you fetches what you fetch and opens none of it |

<a id="webauthn"></a>

## The two WebAuthn calls

WebAuthn is the browser API, `navigator.credentials`, with two calls. `create` registers a new passkey for a site; `get` asks the authenticator to use one it already has. Everything on this page is those two calls with the PRF extension turned on. The exact parameters are listed on the [keyring page](/keyring/index.md#passkey-parameters); what follows is what they mean.

<a id="create"></a>

### First run: `create`

<a id="diagram-passkey-create"></a>
The same diagram as text

```
You                     This page, in your bro  Your authenticator      The bucket (GCP)
 │ sign in; the page finds no keyring at users/{uid}/                    │
 │──────────────────────▶│                       │                       │
 │                       │                       │                       │
 │                       │ ┆ makes 32 random bytes as the user handle, and 32 more as the PRF
 │                       │ ┆ salt                │                       │
 │                       │                       │                       │
 │                       │ navigator.credentials.create: rp.id = secrets.sgit.ai, the user
 │                       │ handle, residentKey required, userVerification required,
 │                       │ extensions.prf = {}   │                       │
 │                       │──────────────────────▶│                       │
 │                       │                       │                       │
 │ asks for a gesture: touch, face, PIN or tap   │                       │
 │◀──────────────────────────────────────────────│                       │
 │                       │                       │                       │
 │ the gesture           │                       │                       │
 │──────────────────────────────────────────────▶│                       │
 │                       │                       │                       │
 │                       │                       │ ┆ makes a key pair and a PRF secret, both
 │                       │                       │ ┆ bound to secrets.sgit.ai; keeps them;
 │                       │                       │ ┆ syncs them through your own account
 │                       │                       │ ┆ (Google, Apple) or not at all (a hardware
 │                       │                       │ ┆ key)                │
 │                       │                       │                       │
 │                       │ credential id, public key, prf.enabled = true │
 │                       │◀──────────────────────│                       │
 │                       │                       │                       │
 │                       │ meta.json: the user handle, the credential id, the public key, a
 │                       │ device name           │                       │
 │                       │──────────────────────────────────────────────▶│
 │                       │                       │                       │
 │                       │ ┆ then the keys page: KEK, key pair, recovery code, the first
 │                       │ ┆ keyring.json; see Keys                      │
 │                       │                       │                       │
```

First run, as the design has it (section 3.2 and 8.7 of the brief). Nothing secret crosses between the parties: the authenticator keeps the private key and the PRF secret, and the page keeps only public identifiers. The PRF bytes are not asked for until unlock.

<a id="rp-id"></a>
**The RP ID**
: The relying-party identifier is the host the passkey is scoped to, and it is exactly `secrets.sgit.ai` (`localhost` when a developer runs the site locally). A passkey scoped to a host can be asserted only by pages on that host. It is never the apex `sgit.ai`, because a passkey scoped to the apex could be asserted by every sibling site under it, and a compromise of any one of the twenty-seven would then be able to ask for the gesture that unlocks every user's secrets here. The [security page](/security/index.md#rp-id) calls this the single most important decision in the design; the lab below refuses to run on any other host.

<a id="user-handle"></a>
**The user handle**
: `user.id` is 32 random bytes made by the page at first run and stored in `meta.json`. It is not your email and not the Firebase uid: the authenticator and whatever syncs it learn nothing about the account. A resident key (`residentKey: 'required'`) means the authenticator stores the passkey under that handle and can list it, which is what lets a new device offer "use a passkey" with no help from us.

<a id="gesture"></a>
**The gesture**
: `userVerification: 'required'` means the authenticator must verify you (touch, face, PIN, or the tap of a hardware key with a PIN) before it does anything. One gesture per unlock. Without it, nothing is computed and nothing is returned.

<a id="credential"></a>
**The credential id and the public key**
: What `create` returns and what the page stores in `meta.json`: the credential id, so the page can name this passkey in `allowCredentials` later and list it on the devices page; the public key, kept for display and for nothing else, because no signature is ever verified. Both are public values.

<a id="prf"></a>
**The PRF extension**
: `extensions: { prf: {} }` at `create` asks the authenticator whether it can do PRF (on hardware keys the underlying CTAP extension is called `hmac-secret`). The answer comes back as `prf.enabled`. If it is false, this authenticator cannot be used to unlock, and the page will say so and offer the recovery code or another authenticator. The bytes themselves are not asked for at `create`: a passkey can be registered without a gesture-bound secret ever leaving the authenticator.

<a id="unlock"></a>

### Returning: `get`

<a id="diagram-passkey-unlock"></a>
The same diagram as text

```
You                     This page, in your bro  Your authenticator      The bucket (GCP)
 │ sign in               │                       │                       │
 │──────────────────────▶│                       │                       │
 │                       │                       │                       │
 │                       │ GET users/{uid}/keyring.json and meta.json    │
 │                       │──────────────────────────────────────────────▶│
 │                       │                       │                       │
 │                       │ ciphertext, the wraps, prfSalt, the generation number; the
 │                       │ credential ids        │                       │
 │                       │◀──────────────────────────────────────────────│
 │                       │                       │                       │
 │                       │ navigator.credentials.get: rpId, allowCredentials from meta.json,
 │                       │ prf.eval.first = prfSalt                      │
 │                       │──────────────────────▶│                       │
 │                       │                       │                       │
 │ asks for a gesture    │                       │                       │
 │◀──────────────────────────────────────────────│                       │
 │                       │                       │                       │
 │ the gesture           │                       │                       │
 │──────────────────────────────────────────────▶│                       │
 │                       │                       │                       │
 │                       │ 🔒 32 PRF bytes, in memory only                │
 │                       │◀──────────────────────│                       │
 │                       │                       │                       │
 │                       │ ┆ HKDF-SHA256(prf bytes, prfSalt, "sgit-      │
 │                       │ ┆ secrets/v1/wrap/<credentialId>") = the wrapping key for this
 │                       │ ┆ passkey             │                       │
 │                       │                       │                       │
 │                       │ ┆ AES-256-GCM: unwrap the KEK, decrypt the body; the vault list is
 │                       │ ┆ in memory           │                       │
 │                       │                       │                       │
 │                       │ ┆ nothing is written anywhere; keys are cleared on sign-out, on an
 │                       │ ┆ environment change, after five hidden minutes, on unload
 │                       │                       │                       │
```

The returning flow (section 3.2 and 8.2 of the brief). The dashed red arrow is the only secret that crosses a boundary, and it crosses once, into this page's memory. Google serves ciphertext and a public salt, and the PRF bytes mean nothing to anyone who holds only those.

The one secret that moves is the dashed arrow: 32 PRF bytes, from the authenticator into this page's memory, after your gesture. The input that produced them, `prf.eval.first`, is the keyring's PRF salt, stored in the clear, because an input is not a secret: anyone can hold the salt, and only your authenticator can turn it into those bytes. From the bytes to the plaintext is three WebCrypto operations, drawn on the [keys page](/learn/keys/index.md).

<a id="many"></a>

## Two passkeys, and twenty

Every passkey has its own PRF secret, so two passkeys given the same salt return different bytes. The keyring therefore holds one wrapped copy of the KEK per passkey (and one per recovery code), each under a wrapping key derived from that passkey's bytes with the credential id in the derivation label. Adding a passkey on a new device means: unlock with any method you already have, register the new passkey, wrap the same KEK once more, write the keyring. Removing one means deleting its wrap. The body is never re-encrypted for either; the entries do not know how many keys open them. The lab below lets you do this with two or more lab passkeys in the same browser and watch the keyring grow one wrap at a time.

<a id="not"></a>

## What the passkey is not used for

- It is not the login. Identity Platform signs you in; the passkey unlocks. An administrator of the login can fake the first and never the second.
- It is not verified. The assertion's signature is returned and ignored; there is no server to check it for, and the PRF bytes are the proof that matters.
- It is not Identity Platform's passkey feature. The passkey is registered by this page, under this host's RP ID, and Google is not told it exists.
- It is not a backup. Lose every passkey and the recovery code, and the data is gone; nothing that could reset it exists anywhere else, by design.

<a id="test"></a>

## How to test it

Two ways. The probe page `/tests/webauthn-prf.html` (proposed, step 4 of the build) will register a throwaway passkey, check `prf.enabled`, ask for bytes twice with the same salt and once with another, and print a result table a visitor can paste into an issue; it is the compatibility matrix. The lab below is here now and does the same things one step at a time, showing every input and every output, and goes on to the keys: it derives the wrapping key, wraps a lab KEK, encrypts a lab body, and unlocks it again with a second gesture or a second passkey. It talks to nothing but your authenticator.

In the build, the lab is driven headlessly by Playwright against Chromium's virtual authenticator with its `hasPrf` option, which answered an open question of the brief: the virtual authenticator does PRF (Chromium 141: `prf.enabled` true, 32 bytes, the same salt gives the same bytes, another salt gives others). That is how the unlock will be tested end to end without a person's finger.

<a id="lab"></a>

## The passkey lab

**What this lab does and does not do.** It runs entirely in this page. It creates real passkeys in your authenticator, scoped to this host, named `lab`, which you can delete afterwards from your password manager (it tells you where). It keeps in this browser's localStorage exactly one record, shown live below: its own random PRF salt and the public facts of each lab passkey (credential id, algorithm, transports, when). It never stores PRF bytes, a key, or anything derived from one; those live in this page's memory and are gone when you leave. It never contacts Google, the bucket, or any network. The salt is a lab salt, so the bytes it shows unlock nothing real.

## Read next

[Keys: from PRF to plaintext](/learn/keys/index.md), the chain the lab's later steps run. [The keyring format](/keyring/index.md), the file those keys open. [Security](/security/index.md), what each compromised party gets.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/learn/passkeys/)*
