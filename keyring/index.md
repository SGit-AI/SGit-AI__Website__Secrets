# Keyring format, version 1

> The specification of the encrypted keyring: objects in the bucket, the key hierarchy, keyring.json, the decrypted body, entry kinds and limits, concurrency, and the passkey parameters. Version 1, proposed, with known-answer fixtures to come.

*Source: <https://secrets.sgit.ai/keyring/> · site v0.1.10 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [proposed](/review/ui/#node=claim.app.keyring-v1) Keyring v1 format: wraps per unlock method, AES-256-GCM body, known-answer tests · [proposed](/review/ui/#node=claim.app.recovery-code) Recovery code: 26 characters base32, 128 bits, shown once · [proposed](/review/ui/#node=claim.app.concurrency) Optimistic concurrency on keyring writes with a three-way merge · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

The keyring is one encrypted file in the user's own prefix of a Cloud Storage bucket. Google stores it and cannot read it. This page is the file format, published as a specification so that a reader can check the code against it and so that another implementation could open the same file. It is version 1 and it is proposed: the known-answer fixtures in `tests/fixtures/keyring-v1/` and the crypto probe page will make it checkable when step 4 ships.

## Objects in the bucket

```

users/{uid}/keyring.json          the encrypted keyring (one object, versioned by GCS)
users/{uid}/meta.json             { "v":1, "createdAt", "keyringRev", "devices":[{"id","name","createdAt","lastUsedAt"}] }   not secret
directory/{uid}.pub.json          the user's public-key bundle, signed (phase 1 writes it; phase 2 reads it)
inbox/{uid}/{shareId}.json        keys encrypted to this user (phase 2)

```

## Key hierarchy

```

passkey PRF output (32 bytes, from the authenticator, never stored)
  └─ HKDF-SHA256(ikm = prf, salt = keyring.prfSalt, info = "sgit-secrets/v1/wrap/<credentialId>")  →  WK_passkey   (AES-256-GCM key)

recovery code (26 characters of base32, 128 bits, shown once)
  └─ HKDF-SHA256(ikm = code bytes, salt = keyring.prfSalt, info = "sgit-secrets/v1/wrap/recovery")      →  WK_recovery

KEK (32 random bytes)             wrapped once per unlock method, under a WK_*
  └─ decrypts the body

body (AES-256-GCM under the KEK)  { keys, entries[] }

```

**The PRF salt.** `keyring.prfSalt` is 32 random bytes, fixed for the keyring's life, passed to every passkey as `prf.eval.first`. One salt serves all passkeys; the per-credential HKDF `info` keeps the wrapping keys apart. The authenticator's PRF is already per-credential, so the info string is belt and braces.

**The recovery code and why it is long.** HKDF alone is fast, so an attacker who holds the keyring could brute-force a weak code. A code of 128 bits of entropy makes that irrelevant, which is why it is long and machine-generated and never chosen by the user. The design deliberately does not add PBKDF2 "for safety": it would only slow a legitimate recovery.

## keyring.json

```

{
  "v": 1,
  "keyringId": "uuid",
  "rev": 7,
  "prfSalt": "base64(32 bytes)",
  "wraps": [
    { "id": "pk-<credentialId base64url>", "kind": "passkey",  "name": "MacBook Chrome", "createdAt": "…", "iv": "b64", "ct": "b64" },
    { "id": "recovery-1",                    "kind": "recovery", "createdAt": "…",                            "iv": "b64", "ct": "b64" }
  ],
  "body": { "iv": "b64", "ct": "b64", "aad": "keyringId|rev" }
}

```

- `wraps[].ct` is AES-256-GCM of the 32-byte KEK under the wrap's WK, with additional authenticated data `keyringId|wrap.id`.
- `body.ct` is AES-256-GCM of the UTF-8 JSON body under the KEK, with additional authenticated data `keyringId|rev`, so a body cannot be transplanted between keyrings or revisions: a stale body fails to decrypt rather than silently winning.
- Every `iv` is 12 random bytes, fresh per encryption.

## The decrypted body

```

{
  "v": 1,
  "keys": {
    "encrypt": { "alg": "RSA-OAEP-4096", "jwk": { "…private…" } },
    "sign":    { "alg": "ECDSA-P256",    "jwk": { "…private…" } }
  },
  "entries": [
    { "id": "uuid", "kind": "password", "title": "…", "createdAt": "…", "updatedAt": "…",
      "fields": { "username": "…", "password": "…", "url": "…", "notes": "…" }, "tags": [] }
  ]
}

```

The key pair is generated at first run and lives in the body from the first keyring, even though nothing uses it until phase 2. Its algorithms match `sgit pki` (RSA-OAEP 4096 for encryption, ECDSA P-256 for signing) so that a phase-2 share envelope can be the sgit hybrid envelope and `sgit pki decrypt` can open what a browser sealed. Whether `sgit pki import` accepts a browser-generated bundle is an open question recorded in [brief-corrections.md](/docs/design/brief-corrections.md).

## Entry kinds

Six kinds, a closed list, kept apart so that a vault key is never mistaken for a password: `password`, `api-key`, `sgit-vault-key`, `sgit-read-key`, `pki-private-key`, `note`. Each has its own fields and its own reveal behaviour. An `sgit-vault-key` entry shows its prefix (`sgit_private_vault_…`) and will refuse to enter a shareable set without a confirmation.

Entries are small: a soft limit of 16 KB each and 1 MB for the keyring. A `document` kind is **absent**: documents will be a pointer to an sgit vault plus that vault's key, never bytes in the keyring.

## Concurrency

Writes carry a GCS precondition, `x-goog-if-generation-match`, against the generation read at unlock. On a mismatch the page re-fetches, re-unlocks with the KEK already in memory (no new gesture), merges entries three ways by `id` and `updatedAt`, bumps `rev`, and retries once; after that it shows a conflict page rather than guessing.

## Passkey parameters

| Call | Parameters |
|---|---|
| `create` | `rp: { id: 'secrets.sgit.ai', name: 'secrets.sgit.ai' }`; `user.id` is 32 random bytes stored in `meta.json`, not the Firebase uid; `pubKeyCredParams` ES256 then RS256; `authenticatorSelection: { residentKey: 'required', userVerification: 'required' }`; `extensions: { prf: {} }`. If `prf.enabled` comes back false, the page says this authenticator cannot unlock and offers the recovery code or another authenticator. |
| `get` | `rpId`; `allowCredentials` from `meta.json`; `userVerification: 'required'`; `extensions: { prf: { eval: { first: prfSalt } } }`; read `getClientExtensionResults().prf.results.first`. |

Known support, dated 2026-10-05 and to be re-checked on the probe page: Chrome and Edge on macOS, Windows and Android with Google Password Manager; Safari 18 and later with iCloud Keychain; hardware keys with hmac-secret. The matrix page will be built before anything more is promised.

## Versioning this specification

The format carries `"v": 1` at the top and in the body. A later version will be a new section on this page, and a keyring will say which version it is before any key is derived. Nothing in version 1 is frozen until the known-answer fixtures exist and the crypto probe page checks them; until then this is the brief's section 8, restated.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/keyring/)*
