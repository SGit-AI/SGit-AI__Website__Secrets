# Sharing

> The sharing scheme: a key pair per user, a public-key directory, an inbox of keys encrypted to the recipient. Phase 2 for the user interface; the data model ships in phase 1 so it is never rewritten. Proposed.

*Source: <https://secrets.sgit.ai/sharing/> · site v0.1.3 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): proposed Key pair per user generated at first run; public bundle written to directory/ · absent Sharing an entry with another user through their inbox

Single-user wrapping works until a secret must be readable by a second person. You cannot wrap it with their passkey, because their PRF secret never leaves their device, and you cannot send it through the server in plaintext. The answer is a key pair per user. The user interface for sharing is **phase 2 and absent from the MVP**; the data model is phase 1, because adding it later would mean rewriting every keyring.

## The scheme

1. At first run each user's browser generates a key pair (RSA-OAEP 4096 for encryption, ECDSA P-256 for signing). The private keys go into the keyring body, protected by the passkey like everything else.
2. The public keys are published as a signed bundle at `directory/{uid}.pub.json`, readable by any signed-in user of the same environment.
3. To share, your browser fetches the colleague's bundle, encrypts the entry's key to their public key, and drops the result in `inbox/{uid}/{shareId}.json`. Any signed-in user may create an inbox object; only the owner may read or delete one.
4. On their next unlock, their browser decrypts the inbox item with their private key and adds it to their own keyring.

The public key shares *keys*, not data. The server carries the package and can never read it.

## What it drags in, designed up front

| Concern | Why it matters | Approach |
|---|---|---|
| Revocation | A removed member already holds the key | Rotate the key, re-encrypt, re-share to the remaining members |
| Directory trust | A compromised admin could swap a public key and intercept the next share | Signed bundles, and fingerprints users can compare out of band before a sensitive share |
| Group membership | Who can open what is real metadata, visible to the bucket | Membership stored per shared set; updated on add and remove; accepted as metadata exposure |
| Kinds kept apart | A vault key shared by mistake opens a whole vault | An `sgit-vault-key` entry refuses to enter a shareable set without a confirmation |

## Fit with sgit

sgit already supports public and private keys (`sgit pki`) and is designed to store encrypted data on top of its own encrypted data. The keyring, the per-user key pairs and the inbox are applications of that capability, not new machinery. The public bundle will use sgit's JSON bundle shape so that `sgit pki import` can read what a browser published and `sgit pki decrypt` can open what a browser sealed. Both are marked "verify first" and recorded as open in [brief-corrections.md](/docs/design/brief-corrections.md).

## What ships when

- **Step 4**: the key pair is generated and stored in the first keyring.
- **Step 9**: the public bundle is written to `directory/` and the inbox rules go live, with the sharing interface still proposed.
- **Phase 2**: the interface, revocation and fingerprints. A later version, not the MVP.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/sharing/)*
