# Risk Mandate — AWS Cognito Client-Side Architecture

2026-10-05 · Dinis Cruz

## Summary

Cognito handles login (Google, other social or OIDC/SAML providers, and Cognito-managed username/password or passkeys). A Cognito identity pool swaps the login token for short-lived AWS credentials in the browser, and the browser talks to S3 directly, limited to its own prefix. SGit vaults are already encrypted client-side, so S3 only ever holds ciphertext.

The one new piece is a per-user **keyring**: an encrypted file in the user's S3 prefix listing the vault keys that user can open, like a password manager's vault. The keyring is unlocked by a key the browser derives from the user's passkey (WebAuthn PRF). That key never exists in Cognito, KMS or any AWS service.

**Answer to the core question:** nothing stored *inside* Cognito or KMS can be kept from someone holding the AWS admin account. But the design doesn't need that. If the key that opens the keyring is derived on the user's authenticator, a full compromise of the Cognito and AWS admin accounts yields ciphertext only. This keeps SGit's existing property: server compromise causes no data disclosure.

**Update:** the primary build will be all-GCP (Identity Platform + Cloud Storage for Firebase, one project per client) so each deployment lives in one cloud and can be created and destroyed as a unit. This Cognito design remains the AWS variant for AWS-native clients. See *Risk Mandate — GCP Key Vault Architecture & Password Manager MVP*.

## Why secrets cannot live in Cognito or KMS

- **Cognito user attributes** (including custom attributes) are readable by any principal with `cognito-idp:AdminGetUser` or `ListUsers`. Encrypting them first just moves the question to where that key lives.
- **Whoever controls authentication can impersonate.** A Cognito admin can reset a password (`AdminSetUserPassword`), sign in as the user, obtain identity-pool credentials and do anything the user can do. So any secret that is released *because a user logged in* is reachable by the admin.
- **KMS** decrypts server-side for whoever holds IAM permission. A key policy can try to exclude admins, but the account owner can usually regain control, and an impersonated user's credentials would pass anyway.
- **AWS Private CA and KMS asymmetric keys** keep private keys inside AWS, usable by IAM principals. Same problem. **CloudHSM** keeps keys behind HSM user credentials that AWS admins don't have, but it's server-side, priced per HSM-hour and not per-user, so it doesn't fit.

Conclusion: the authority to decrypt must come from something the AWS account cannot reach — the user's authenticator, or a passphrase only the user knows.

## Architecture

| Layer | Component | Role | What a compromised admin gets |
|---|---|---|---|
| Web app | Static site on GitHub Pages (outside AWS) | All crypto and UI run here | Nothing, if the code host is separate |
| Login | Cognito user pool: Google federation, other IdPs, native username/password, passkeys | Proves who the user is | Ability to impersonate users and alter config |
| AWS access | Cognito identity pool, authenticated role with policy variables | Short-lived credentials scoped to `vaults/${cognito-identity.amazonaws.com:sub}/*` | Access to any user's prefix |
| Storage | S3: user keyring + SGit vault objects | Holds ciphertext only | Ciphertext; ability to delete or roll back |
| Keys | Passkey PRF on the user's device, synced via iCloud Keychain or personal Google Password Manager | Derives the key that unwraps the keyring | Nothing |

## Login options

- **Google sign-in** through Cognito's federated identity providers. Cognito also supports Apple, Facebook, Amazon, any OIDC provider and SAML (for customer IdPs like Entra or Okta).
- **Cognito-managed accounts**: username/password with MFA, or passwordless with passkeys or email OTP (passwordless needs the Essentials feature plan).
- Use the Amplify Auth library or the Cognito API from the custom UI, rather than the Cognito-hosted login pages, so every page the user sees comes from the code host outside AWS.

Login and key unlock are deliberately separate. Login decides *which S3 prefix you may touch*; the passkey PRF decides *whether you can read what's there*. An admin can fake the first, never the second.

## Keyring design

Path: `vaults/{identityId}/keyring.json` (versioned).

Contents, conceptually:

- **Wrapped keyring key (KEK) entries**, one per unlock method: each registered passkey (KEK wrapped with that passkey's PRF output via HKDF + AES-GCM), and one recovery code generated at signup and shown once.
- **Encrypted body** (AES-GCM under the KEK): a list of vaults the user can open, each with vault id, S3 location, SGit vault key and label.

Unlock flow:

1. User signs in via Cognito; browser gets identity-pool credentials.
2. Browser downloads `keyring.json`.
3. Browser runs `navigator.credentials.get` with the PRF extension and the salt stored in the keyring; the authenticator returns a 32-byte secret.
4. HKDF turns it into a wrapping key; browser unwraps the KEK, decrypts the body, holds vault keys in memory only.
5. SGit reads and writes vault objects directly in S3.

Adding a device: sign in, unlock with an existing passkey or the recovery code, register the new passkey, add a new wrapped-KEK entry. Losing every passkey and the recovery code means the data is gone; say so in the terms.

## Sharing a vault between users

Each user has an X25519 key pair; the private key lives in their keyring, the public key in a readable directory (`directory/{identityId}.pub`). To share a vault, the owner encrypts the vault key to the recipient's public key and drops it in the recipient's inbox prefix; the recipient's browser moves it into their keyring on next unlock.

Risk: a compromised admin could replace a public key in the directory and receive the next share. Mitigate with key fingerprints users can compare, or signed directory entries, before any sensitive sharing. Revocation means rotating the vault key and re-sharing to remaining members.

## What a full admin compromise can and cannot do

| Attack | Result | Mitigation |
|---|---|---|
| Read S3 | Ciphertext only | — |
| Read Cognito users | Emails, names, login metadata | Keep the user pool minimal; accept metadata exposure |
| Impersonate a user | Gets their ciphertext, cannot pass the PRF step | Passkey bound to the riskmandate.ai origin |
| Point Cognito at a phishing site | PRF output is bound to the site's origin, so a phishing site cannot get it | Code host outside AWS |
| Delete or encrypt-for-ransom S3 data | Availability loss | S3 versioning + Object Lock, replication to a separate AWS account, SGit clones on devices |
| Roll back a vault to an older version | Stale data | SGit commit hashes; client remembers last-seen head |
| Swap a public key in the directory | Intercepts future shares | Fingerprint check or signed directory |
| **Serve malicious JavaScript** | **Full compromise of any user who loads it** | Code hosting outside the AWS account, protected separately; SRI on pinned libraries; reproducible builds |

The last row is the real boundary: client-side crypto is only as trustworthy as the code delivered to the browser. Keeping the site on GitHub Pages, outside the AWS account, means an AWS or Cognito compromise does not reach it.

## Compared with the Google designs

| | Cognito + S3 | Identity Platform + Cloud Storage | Workspace |
|---|---|---|---|
| Terms issue for multi-customer use | None | None | Needs Google's written agreement |
| Native passkeys | Yes | Limited | Yes (Google account) |
| Multi-tenancy | Pool per customer or tenant attributes | Built in | Tenant per customer |
| Browser-direct storage | Identity pool + S3 | Firebase Storage rules | Drive/GCS via OAuth |
| Mail, Drive, Calendar | No | No | Yes |
| Familiarity | High (already used) | Lower | Medium |

## Open questions and next steps

- Test whether Cognito's own passkey flow can also return a PRF result, so one passkey does login and unlock. If not, register a separate passkey with RP ID riskmandate.ai for unlock only.
- Decide multi-tenancy: one user pool per customer, or one pool with a tenant attribute and per-tenant S3 prefixes.
- Check Cognito feature-plan pricing for the passkey and passwordless features.
- Build a PRF compatibility matrix (older Android, managed Chrome, Firefox).
- Design the keyring file format and versioning, including concurrent writes from two devices.
- Decide on the public-key directory trust model before multi-user sharing ships.
- Set up S3 Object Lock and cross-account replication; test restore.
- Prototype: sign in with Google via Cognito, get identity-pool credentials, write an encrypted keyring to S3, unlock it on a second device.
