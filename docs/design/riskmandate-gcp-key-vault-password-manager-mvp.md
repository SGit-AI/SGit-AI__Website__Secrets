# Risk Mandate — GCP Key Vault Architecture & Password Manager MVP

2026-10-05 · Dinis Cruz

## Summary

Risk Mandate needs two things from a cloud: an **identity** and a **place to store encrypted keys**. Everything else (SGit vault encryption, key unlock, sharing) happens in the browser.

Decision: build it **all in GCP**, one project per client deployment, so a deployment can be created and destroyed as one unit. The stack is Identity Platform for login, Cloud Storage for Firebase for the encrypted keyring and SGit vaults, Storage Security Rules as the per-user guardrail, and a passkey with the WebAuthn PRF extension as the only thing that can decrypt.

The first build is a **password manager**. It contains every risky piece of the vault-management design: login, browser-direct storage, passkey unlock, keyring format, device enrolment, recovery and multi-user sharing. Once it works, vault key management and user preferences are a layer on top: the same keyring holds vault keys instead of passwords.

The server side never holds plaintext. A full compromise of the GCP project, Identity Platform or the admin account yields ciphertext only. This matches SGit's existing principle, and SGit's existing public/private key support and encrypted-data-on-top-of-encrypted-data design already cover most of what's needed.

## Why all-GCP rather than Cognito

The Cognito + S3 design works (see the Cognito architecture doc) and Cognito is familiar. GCP wins on deployment shape:

- **One cloud per deployment.** Google sign-in needs a Google OAuth client, which lives in a GCP project. With Cognito, a client wanting Google sign-in would run AWS *and* a GCP project. All-GCP keeps it to one.
- **Clean create/destroy.** A GCP project is a complete boundary: identity config, bucket, IAM, billing. Deleting the project wipes the deployment.
- **Familiarity is no longer a deciding factor.** GCP is well known to the team.

What GCP does not give in this design: mailboxes, Drive or Calendar. Those are Workspace, which carries the resale terms issue documented in the onboarding doc. This design needs none of them.

## Client-owned deployments

In a client deployment the client controls everything. The GCP project sits in the client's own Google Cloud organisation and billing account; Risk Mandate deploys the architecture into it. The client creates (or authorises Risk Mandate to create) the Google OAuth client for Google sign-in, so that credential is theirs too. Risk Mandate holds no standing access it doesn't need.

## The GCP stack

| Layer | GCP component | Role | Cognito equivalent |
|---|---|---|---|
| Web app | Static site (GitHub Pages or Firebase Hosting) | All crypto and UI run in the browser | Same |
| Login | Identity Platform: Google sign-in, email/password, OIDC/SAML federation for a client's own IdP | Proves who the user is | Cognito user pool |
| Browser-direct storage | Firebase SDK talking to Cloud Storage for Firebase | No server in the data path | Identity pool + temporary AWS credentials |
| Access guardrail | Storage Security Rules keyed on the user's UID (and tenant if used) | Each user touches only their own paths | IAM policy variables on S3 prefixes |
| Encrypted data | Keyring files, public-key directory, inboxes, SGit vault objects in the bucket | Ciphertext only | S3 |
| Unlock | Passkey + WebAuthn PRF, held in the user's Google Password Manager or iCloud Keychain | Derives the key that opens the keyring | Same |

Pricing reference: Identity Platform basic sign-in is free to 50,000 monthly active users, then roughly $0.0055 per MAU; SAML/OIDC federation is free only to 50 MAU.

## Deployment units: project, tenant, region

- **Project per client (recommended).** Own Identity Platform config, own bucket, own IAM, own billing. Destroying the project removes everything. Best fit for create/destroy and client ownership.
- **Tenants within one project (option).** Identity Platform has built-in multi-tenancy: separate user pools under one project. Useful for a shared Risk Mandate environment hosting several small or pilot clients. Security Rules then key on both UID and tenant.
- **Region.** Set per client by the bucket location, for data residency. Identity Platform itself is global; check where its user records are held if a client has strict residency needs.
- **Automation.** Script project creation end to end (Terraform or gcloud): create project, enable Identity Platform, add Firebase, create bucket in the chosen region, deploy Security Rules, configure providers. Watch per-organisation and per-billing-account project quotas if spinning many up.

## Where the passkey lives

The passkey is not stored in Identity Platform, the bucket or anything Risk Mandate administers.

- It lives in the user's **authenticator**: in plain Chrome that is Google Password Manager, on Apple devices iCloud Keychain, or a hardware security key.
- It syncs through the user's own **personal** account (their personal Google or Apple account), which no Risk Mandate or client admin can reach.
- It is a WebAuthn credential registered by Risk Mandate's own page against the riskmandate.ai origin. It needs no Google app, no OAuth client and no Identity Platform setting.

The user meets Google in two unrelated roles: once as a **login provider** (Google sign-in through Identity Platform, which needs an OAuth client) and once as the **home of the passkey** (Google Password Manager, which needs no configuration). Neither role creates a lock-in: login can be any provider, and the passkey would sit in the same place under any cloud.

## First-run and returning-user flow

You, in Chrome, at riskmandate.ai:

1. **Sign in.** Click "Sign in with Google" (or email/password). Identity Platform returns an ID token; the Firebase SDK can now reach your paths in the bucket. Everything there is ciphertext, and you have no keyring yet.
2. **Create a passkey.** The page sees no keyring and calls `navigator.credentials.create` with the PRF extension. Chrome shows its own dialog and offers to save the passkey in Google Password Manager. You approve with fingerprint, PIN or face.
3. **Create the keyring.** The browser takes the PRF output, derives a wrapping key, generates your key pair and a keyring key, encrypts the keyring and writes it to the bucket. A recovery code is shown once.
4. **Returning visit** (same Chrome, or any Chrome signed into the same Google account so the passkey has synced): sign in, the page fetches the keyring, calls `navigator.credentials.get` with PRF, you confirm, the keyring unlocks in memory.
5. **New device without the passkey** (e.g. Safari on an iPhone using iCloud Keychain): sign in, unlock with the passkey from another device via cross-device sign-in, or with the recovery code, then register a new passkey on this device; a new wrapped-key entry is added to the keyring.

## Keyring design

The keyring is an encrypted file in Cloud Storage. Google stores it but cannot read it.

- **Wrapped keyring-key entries**, one per unlock method: each registered passkey (keyring key wrapped with that passkey's PRF output via HKDF + AES-GCM) and one recovery code.
- **Encrypted body**, holding the user's private key, and the entries they can open: passwords in the MVP; SGit vault keys and preferences later.

One unlock opens everything: passkey unlocks the keyring; the keyring holds the private key and all the keys/secrets. Plaintext exists only in the browser, briefly.

Losing every passkey and the recovery code means the data is unrecoverable. This must be stated in the terms and in onboarding copy.

## Multi-user sharing scheme

**The problem.** Single-user wrapping works until a secret must be readable by a second person. You can't wrap it with their passkey (their PRF secret never leaves their device), and you can't send it through the server in plaintext.

**The solution: a key pair per user.** At setup each user's browser generates a public/private key pair.

- The **private key** goes into the user's keyring, protected by their passkey like everything else.
- The **public key** is published in a readable directory: "this user, this public key".

**Sharing flow.**

1. Your browser fetches the colleague's public key.
2. It encrypts the vault key (or password entry key) to that public key.
3. It drops the result in the colleague's inbox in the bucket.
4. On their next unlock, their browser decrypts it with their private key and adds it to their own keyring.

The public key shares *keys*, not data. The data stays where it is, encrypted under its vault key; sharing hands over the ability to open it. The server carries the package but can never read it.

**What it drags in (design up front, not later):**

| Concern | Why it matters | Approach |
|---|---|---|
| Revocation | A removed member already holds the key | Rotate the vault key, re-encrypt, re-share to remaining members |
| Directory trust | A compromised admin could swap a public key and intercept the next share | Key fingerprints users can compare, or signed directory entries |
| Group membership | Who can open what is real metadata | Store membership per vault; update on add/remove |

If the MVP stores only single-user wrapped keys and sharing is added later, the core data model gets rewritten. Build the key pair and inbox in from the start, even if version one only shares with one person.

**Fit with SGit.** SGit already supports public/private keys and is designed to store encrypted data on top of its own encrypted data. The keyring, the per-user key pairs and the inbox are applications of existing SGit capability, not new machinery. Reuse SGit's key formats and primitives rather than introducing a parallel scheme.

## Storage layout

| Path | Contents | Who can read/write (Security Rules) |
|---|---|---|
| `users/{uid}/keyring` | Encrypted keyring | Owner only |
| `directory/{uid}.pub` | Public key (signed) | Owner writes; signed-in users read |
| `inbox/{uid}/{shareId}` | Keys encrypted to that user | Any signed-in user writes; owner reads and deletes |
| `vaults/{vaultId}/...` | SGit vault objects | Members, per membership record |

With tenants, prefix every path with `tenants/{tenantId}/` and add the tenant check to every rule.

## Password manager MVP

Why it's the right first build: if an admin with full GCP access cannot read a stored password, the security model holds for vault keys too. It is easy to test, easy to demo, and has every hard piece.

Scope:

- Sign in (Google and email/password via Identity Platform)
- First-run passkey creation, keyring creation, recovery code
- Add, view, edit, delete password entries
- Add a second device; recover with the recovery code
- Share an entry with another user (key pair + inbox)
- Revoke a share (rotation)
- Fingerprint display for verifying another user's public key

Then vault management is the same keyring holding SGit vault keys, and user preferences become more encrypted fields.

## Threat summary

| Attacker | Gets | Cannot get |
|---|---|---|
| GCP project or Identity Platform admin | Ciphertext, user emails and login metadata, ability to impersonate a login, delete data | Plaintext; the PRF secret is bound to the riskmandate.ai origin and the user's device |
| Bucket read access | Ciphertext | Plaintext |
| Directory tampering | Future shares, unless fingerprints or signatures are checked | Existing keys |
| Whoever controls the served JavaScript | Everything for users who load it | — |

The served code is the real boundary. Host the site separately from the GCP project and protect that host independently. Use bucket versioning and retention to defend availability against deletion.

## Open questions and next steps

- Confirm Storage Security Rules can check the Identity Platform tenant claim, if tenants are used.
- Confirm where Identity Platform stores user records, for clients with residency requirements.
- Map SGit's existing key pair and layered-encryption support onto the keyring, directory and inbox; list any gaps.
- Choose directory trust: fingerprints, signed entries, or both.
- Define the keyring format, versioning and conflict handling for two devices writing at once.
- Build the PRF compatibility matrix (older Android, managed Chrome, Firefox, Safari).
- Write the project-creation script and test create/destroy end to end.
- Build the password manager MVP; test by giving someone full GCP admin and asking them to read a password.
