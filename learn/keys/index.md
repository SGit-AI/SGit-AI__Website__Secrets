# Keys: from the PRF bytes to the plaintext

> Is there a passphrase (no). The PRF salt, HKDF, the wrapping keys, the KEK, AES-256-GCM and the recovery code: every key in the keyring, where it comes from, where it goes, and what is in memory when, drawn and then run live in the lab.

*Source: <https://secrets.sgit.ai/learn/keys/> · site v0.1.13 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [proposed](/review/ui/#node=claim.app.keyring-v1) Keyring v1 format: wraps per unlock method, AES-256-GCM body, known-answer tests · [proposed](/review/ui/#node=claim.app.recovery-code) Recovery code: 26 characters base32, 128 bits, shown once · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [shipped v0.1.12](/review/ui/#node=claim.site.passkey-lab) The passkey lab on /learn/passkeys/: create lab passkeys in this browser under this host's RP ID, ask for PRF bytes, derive the wrapping key, wrap a lab KEK, encrypt a lab body, unlock again with the same or a second passkey, and watch what is stored where; headless in the build against Chromium's virtual authenticator with PRF

There are five kinds of bytes in the design, and only one of them is random on its own: the KEK. Everything else is either derived from a [passkey](/learn/passkeys/index.md#passkey) or the recovery code, or is a public input. This page walks the chain once, names each link, and says which bytes are secret, which are stored, and which exist only in memory for the length of an unlock. The format of the file they open is the [keyring page](/keyring/index.md); the design is *proposed*; the lab on the [passkeys page](/learn/passkeys/index.md#lab) runs this chain for real on your browser's WebCrypto.

<a id="passphrase"></a>

## Is there a passphrase?

No. Nothing you type unlocks the [keyring](/keyring/index.md). The two unlock methods are a passkey's [PRF](/learn/passkeys/index.md#prf) bytes, which only your [authenticator](/learn/passkeys/index.md#authenticator) can produce, and the recovery code, which the page makes and shows you once. There is no master password to choose, forget, reuse or phish, and no password-stretching function to tune, because there is no human-chosen secret to stretch. The nearest thing to a passphrase is the recovery code, and it is long precisely so that it does not need to be treated like one.

## The chain

<a id="diagram-key-hierarchy"></a>
The same diagram as text

```
┌─ prfSalt, 32 bytes ─ (public) ─┐
│  in keyring.json, in the clear; the input, not a secret
└───────────────────────────────┘
┌─ PRF output, 32 bytes ─ (secret) ─┐
│  from the authenticator, per passkey, never stored
└──────────────────────────────────┘
     │  HKDF-SHA256(ikm = prf, salt = prfSalt, info = sgit-secrets/v1/wrap/<credentialId>)
     ▼  → wkp
┌─ Recovery code, 128 bits ─ (secret) ─┐
│  26 base32 characters, shown once, kept by you
└─────────────────────────────────────┘
     │  HKDF-SHA256(ikm = code bytes, salt = prfSalt, info = sgit-secrets/v1/wrap/recovery)
     ▼  → wkr

┌─ WK_passkey (AES-256-GCM) ─ (derived) ─┐
│  one per passkey; in memory for the unlock
└───────────────────────────────────────┘
     │  AES-256-GCM unwrap of wraps[pk-<id>].ct, aad = keyringId|wrap.id
     ▼  → kek
┌─ WK_recovery (AES-256-GCM) ─ (derived) ─┐
│  in memory, only during a recovery
└────────────────────────────────────────┘
     │  AES-256-GCM unwrap of wraps[recovery-1].ct
     ▼  → kek

┌─ KEK, 32 random bytes ─ (secret) ─┐
│  stored only as wraps[].ct, once per unlock method
└──────────────────────────────────┘
     │  AES-256-GCM decrypt of body.ct, aad = keyringId|rev
     ▼  → body

┌─ The body: entries and the key pair ─ (secret) ─┐
│  stored only as body.ct; plaintext in memory, briefly
└────────────────────────────────────────────────┘
```

Section 8.2 of the brief as a picture. Two roots, one KEK: each unlock method derives its own wrapping key and the keyring holds one wrapped copy of the KEK per method, so adding a passkey adds a wrap and never re-encrypts the body. Red is secret and never stored; blue is public and stored in the clear; grey is derived in memory and thrown away.

<a id="prf-salt"></a>
**The PRF salt**
: `keyring.prfSalt`: 32 random bytes, made once at first run, fixed for the keyring's life, stored in `keyring.json` in the clear. It is the input every passkey is given as `prf.eval.first`. One salt serves every passkey, because the authenticator's PRF is already different per passkey; the per-credential label in the next step keeps the wrapping keys apart as well, belt and braces. It is public: holding the salt gives nobody anything without the authenticator.

<a id="hkdf"></a>
**HKDF-SHA256**
: The browser's standard key-derivation function, `crypto.subtle.deriveKey` with `HKDF`. Input keying material: the 32 PRF bytes (or the recovery code's bytes). Salt: the PRF salt. Info, the label: `sgit-secrets/v1/wrap/<credentialId>` for a passkey and `sgit-secrets/v1/wrap/recovery` for the code, so the same bytes could never produce the same key for two different purposes. Output: one AES-256-GCM key. Deterministic: same inputs, same key, every time, which is what makes an unlock repeatable without storing anything.

<a id="wrapping-key"></a>
**The wrapping keys**
: `WK_passkey` for each passkey and `WK_recovery` for the code. Each one has exactly one job: to encrypt (wrap) and decrypt (unwrap) the KEK. A wrapping key is never stored and never used on the body. It exists in memory for the moment of an unlock and is dropped.

<a id="kek"></a>
**The KEK**
: The keyring's one real key: 32 random bytes from `crypto.getRandomValues`, made at first run. It encrypts the body. It is stored only wrapped, once per unlock method, in `keyring.wraps[]`; adding a passkey adds a wrap, removing one removes a wrap, and the KEK itself never changes, so the body is never re-encrypted for a change of devices. During a session the KEK stays in memory so that a conflicting write can be merged and retried without a new [gesture](/learn/passkeys/index.md#gesture).

<a id="aes-gcm"></a>
**AES-256-GCM**
: The authenticated cipher the browser provides. Every wrap and the body use it with a fresh 12-byte IV per encryption and additional authenticated data that binds the ciphertext to its place: `keyringId|wrap.id` for a wrap, `keyringId|rev` for the body. Authenticated means a wrong key or a changed byte fails to decrypt, loudly, rather than producing garbage; and the AAD means a wrap or a body cannot be transplanted into another keyring or an older revision and silently win.

<a id="recovery-code"></a>
**The recovery code**
: 26 characters of base32, 128 random bits, machine-made at first run and shown once behind "I have written it down". It is the one unlock method that lives outside any authenticator: on paper, in another manager, in your head if you are that kind of person. HKDF alone is fast, so an attacker who holds the keyring could try codes quickly; 128 bits of entropy makes that irrelevant, which is why the code is long and never chosen by you. The design deliberately adds no PBKDF2 or Argon2 "for safety": it would only slow a legitimate recovery, and it cannot help a short code.

<a id="many"></a>

## Many passkeys, one KEK

Two passkeys given the same salt return different PRF bytes, so they derive different wrapping keys, so the keyring holds two wraps of the same KEK. Either unlocks. The recovery code is a third wrap. Nothing in the body knows or cares how many wraps exist. This is also why a passkey can be removed without a gesture from any other device: deleting a wrap is an edit to the keyring, written with the KEK already in memory.

<a id="memory"></a>

## What is in memory, when

| Moment | In this page's memory | Written anywhere |
|---|---|---|
| After sign-in, before the gesture | The ID token; the fetched `keyring.json` and `meta.json` (ciphertext and public values) | Nothing new |
| After the gesture | The 32 PRF bytes, briefly; the wrapping key, briefly; the KEK; the plaintext body | Nothing |
| While you work | The KEK and the body; the recovery code only in the seconds it is shown at first run | Ciphertext, on each save, with a generation precondition |
| On sign-out, an environment change, five hidden minutes, or unload | Nothing: the page overwrites what it can and drops the rest | Nothing |

The gate reads every storage key the code may write (`app/config/storage-keys.js`, check 8) and the leak tripwire reads every file on every release (check 4). Neither can see memory; the `leak-check` probe page (proposed) will scan this origin's storage from inside the browser for anything shaped like key material and expect none.

<a id="worked"></a>

## A worked example, live

The [passkey lab](/learn/passkeys/index.md#lab) runs exactly this chain with a lab salt: it asks a lab passkey for its bytes, derives the wrapping key with the [credential id](/learn/passkeys/index.md#credential) in the label, makes a lab KEK, wraps it, encrypts a one-entry body, and then unlocks it again, with the same passkey or a second one, showing the fingerprint of every intermediate value and the JSON of the lab keyring as it grows. The values are real WebCrypto outputs; the salt is the lab's own, so they open nothing but the lab.

## Read next

[The keyring format](/keyring/index.md): the file, field by field. [Passkeys](/learn/passkeys/index.md): where the PRF bytes come from. [GCP](/learn/gcp/index.md): where the ciphertext lives.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/learn/keys/)*
