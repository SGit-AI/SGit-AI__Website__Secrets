# Risk Mandate — Google Workspace as Identity, Storage and Deployment Substrate

**Technical briefing** · Draft v0.1 · 4 October 2026
**Scope:** Using Google Workspace accounts as the identity provider, per-customer storage home and deployment substrate for Risk Mandate (riskmandate.ai), with SGit (sgit.ai) as the encrypted data layer.

---

## 1. Summary

Risk Mandate will provision each customer a Google Workspace account (≈ £7/user/month, cost passed through to the customer). That account does three jobs at once:

1. **Identity provider** — OIDC/SAML login for Risk Mandate and SGit.
2. **Data home** — the customer's policies, mandates and evidence live under an account that is recognisably *theirs*.
3. **Cloud substrate** — every Workspace tenant is also a Google Cloud organisation, so per-customer Cloud projects (storage, KMS, compute) fall out for free.

All customer data is stored **encrypted by SGit before it touches Google**. Google, and any Workspace admin, only ever hold ciphertext. The decryption key is derived from the user's own authenticator (passkey + PRF) and rides on the user's *personal* recovery chain, never on Risk Mandate infrastructure.

The result is a **three-tier ladder** — Shared → Delegated → Private — where the customer moves up as their governance requirements grow, and the move is a Google domain transfer rather than a data migration. This mirrors Risk Mandate's own thesis: a named business owner and a time-bound mandate, applied to our own access.

---

## 2. Design goals and constraints

| Goal | Implication |
|---|---|
| Minimise Risk Mandate's contact with user data | Never hold plaintext; avoid holding standing OAuth credentials where possible |
| Pass infrastructure cost to the customer | Resell Workspace seats; Cloud billing attached per customer |
| Scale security from "simple" to "enterprise-ready" | Tiered model, same code, different tenancy and key custody |
| Prove the model before automating | Hand-provision early customers; reseller APIs later |
| Business model = helping customers deploy at their end | Private tier is the upsell, shared tier is the on-ramp |

**Hard constraint discovered:** standard Workspace storage has *no admin-proof zone*. A super admin can reach any user's Drive via Vault, data transfer, Takeout or domain-wide delegation. Google's Client-Side Encryption (CSE) solves this but is Enterprise Plus / Education only and not available on the £7 tier. Therefore encryption must happen **in SGit, before Google**, not inside Google.

---

## 3. Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│  User's PERSONAL identity (own Google / Apple account)         │
│  └─ Passkey for riskmandate.ai, stored in Google Password      │
│     Manager or iCloud Keychain → synced, recoverable by user   │
│     └─ PRF extension → deterministic secret → unwraps data key │
└───────────────┬──────────────────────────────────────────────┘
                │ login (WebAuthn + OIDC)
┌───────────────▼──────────────────────────────────────────────┐
│  Risk Mandate app (browser / agent)                            │
│  - Verifies Workspace ID token, discards it                    │
│  - Holds data key IN MEMORY ONLY for the session               │
│  - SGit client encrypts/decrypts locally                       │
└───────────────┬──────────────────────────────────────────────┘
                │ ciphertext only
┌───────────────▼──────────────────────────────────────────────┐
│  Customer's Workspace tenant  +  Google Cloud org node         │
│  - Workspace user(s): identity, Groups, Drive (light use)      │
│  - Cloud project(s): Cloud Storage (SGit object store), KMS,   │
│    Cloud Run (SGit services), audit logs                       │
└──────────────────────────────────────────────────────────────┘
```

Key separation: **identity + ciphertext** live in the tenant (which Risk Mandate may administer on the shared tier); **key material** lives on the user's personal recovery chain (which Risk Mandate never touches).

---

## 4. Identity

### 4.1 Workspace as IdP

- Google Workspace supports OIDC and SAML out of the box. Risk Mandate registers once as an OAuth client in Google Cloud.
- Use **pure OpenID Connect** for login: request only `openid email profile`, verify the ID token, and discard it. No `offline_access`, no refresh token, nothing for Risk Mandate to custody.
- Groups API drives roles (e.g. `risk-owners@`, `auditors@`), so authorisation can be delegated to the customer's own admins on higher tiers.

### 4.2 Passkeys + PRF for key derivation

- On first login the user registers a **passkey** at `riskmandate.ai`. The passkey is bound to the site, but *stored* wherever the user chooses — Google Password Manager, iCloud Keychain, a hardware key.
- The **PRF extension** (WebAuthn) returns a deterministic 32-byte secret per credential per site on each assertion. Risk Mandate uses it to derive a wrapping key and unwrap the customer's SGit data key.
- Nothing key-related is stored server-side in plaintext. A stolen database yields wrapped keys only.
- **Recovery:** because the passkey syncs via the user's personal Google/Apple account, losing a device is survivable — recover the personal account, the passkey returns, the PRF secret returns. Losing *all* authenticators and the personal account = data gone. This is accepted and should be stated plainly in the terms.
- Browser support: Chrome and Safari both ship PRF; iCloud Keychain supports it from iOS 18. Test older Android builds before relying on it there.

### 4.3 Why not the alternatives

| Option | Verdict |
|---|---|
| Drive appDataFolder | Admin-reachable; stores the key next to the lock. No. |
| Google CSE | Correct model, but Enterprise Plus only and operationally heavy. Revisit for Private tier if a customer already has it. |
| Password managers (1Password, LastPass) | 1Password has a usable SDK; LastPass does not. Either way adds a third party. Optional, not default. |
| Customer KMS (GCP KMS / Azure Key Vault / AWS KMS) | Right answer for Private tier where the customer already audits a KMS. Supported as an alternative wrapping backend. |

---

## 5. Storage

### 5.1 SGit as the encrypted data layer

- SGit encrypts every object client-side before upload. Google only ever sees ciphertext.
- Google Drive is **not** the primary store — SGit is too chatty for the Drive API. Drive may hold human-readable exports (e.g. a published policy PDF) but the SGit object store is **Google Cloud Storage** in a per-customer project.
- Each Workspace user can create Cloud projects immediately (Workspace tenant = Cloud Identity org), so no separate account system is needed.

### 5.2 Per-customer Cloud layout

```
Organisation: <customer-or-riskmandate>.com
└── Folder: riskmandate-customers (shared tier) / root (private tier)
    └── Project: rm-<customer>
        ├── Cloud Storage bucket   – SGit object store (ciphertext)
        ├── Cloud KMS (optional)   – alternative key wrapping backend
        ├── Cloud Run              – SGit services, if hosted
        └── Cloud Audit Logs       – retained, exportable to customer
```

- Billing: Workspace and Cloud are billed separately. Each project needs a billing account — Risk Mandate's with labels for chargeback (Shared), or the customer's own (Private).
- IAM: Cloud org admin is a **different role** from Workspace super admin. Split identity administration from infrastructure administration deliberately from day one.

---

## 6. Deployment tiers

| | **Tier 1 — Shared** | **Tier 2 — Delegated** | **Tier 3 — Private** |
|---|---|---|---|
| Tenant owner | Risk Mandate | Customer | Customer |
| Domain | `<customer>.riskmandate.ai` or similar | Customer's own | Customer's own |
| Workspace admin | Risk Mandate | Customer; Risk Mandate holds a scoped, revocable delegated-admin role | Customer only |
| Cloud org / billing | Risk Mandate (chargeback) | Customer | Customer |
| Who could read plaintext | Nobody — ciphertext + user-held keys | Same | Same |
| Who could *see ciphertext / metadata* | Risk Mandate admins (audit-logged) | Customer + Risk Mandate (scoped) | Customer |
| Provisioning | Hand-provisioned initially → reseller API | Guided setup, sold as a service | Full setup + managed ops, sold as a service |
| Target | Startups, pilots, proving the model | Mid-market wanting ownership without ops burden | Regulated / enterprise |

**Trust story on Tier 1:** "We technically can access the tenant, here is the Admin audit log proving we didn't, and all we could see is ciphertext anyway." Back it with a DPA. This is stronger than most SaaS trust claims and should be stated rather than hidden.

**Migration path:** Tier 1 → 2/3 is a Google **domain transfer** of the tenant plus a Cloud project move under the customer's org node. No data export, no re-encryption — keys never belonged to Risk Mandate in the first place.

---

## 7. Federated login (customer brings their own Google)

Both tiers can optionally accept logins from a customer's *existing* Workspace instead of a provisioned account.

| Depth | What's needed on the customer side |
|---|---|
| OIDC sign-in only | Nothing, unless the admin has locked third-party apps — then a one-line allow-list of Risk Mandate's OAuth client |
| Per-user Drive access | User consent at OAuth time; no admin involvement |
| Domain-wide delegation | Super admin configures it in Admin console; triggers security review. **Avoid unless essential.** |
| SAML into Risk Mandate's tenant | One-time admin setup on their side; routine for any IT team |

**Credential-custody rule:** Risk Mandate holds no refresh tokens by default. If Drive access is ever needed, keep the token in the browser and call Drive client-side so the grant dies with the session. Anything that must run server-side without the user present is a Tier 2/3 feature, with tokens encrypted under a key the user's PRF secret unwraps and scopes requested incrementally.

---

## 8. Session and unlock flow (end-to-end)

1. User visits `riskmandate.ai`, chooses "Sign in with Google" → OIDC against their Workspace tenant.
2. ID token verified; session established; token discarded.
3. App triggers WebAuthn assertion with PRF for the registered passkey.
4. PRF output → HKDF → wrapping key.
5. App fetches the user's **wrapped** SGit data key from the Cloud project; unwraps in memory.
6. SGit client decrypts/encrypts objects locally against the per-customer Cloud Storage bucket.
7. On logout or tab close the data key is dropped; nothing persists in plaintext.

First-run differs only in step 3–5: generate the data key locally, wrap it with the PRF-derived key, store the wrapped blob. Optionally register a second passkey (hardware key) and a KMS-wrapped copy for Tier 3 customers as recovery.

---

## 9. Open questions and risks

- **PRF on older Android / enterprise-managed Chrome** — needs a compatibility matrix before launch.
- **Reseller status** — joining Google's partner programme unlocks provisioning/billing APIs; needed before Tier 1 can be self-serve. Not needed for hand-provisioned pilots.
- **Legal access obligations** — on Tier 1, Risk Mandate is data controller for the tenant and may receive lawful-access requests. Ciphertext-only storage limits what can be produced; document this position with counsel.
- **Multi-user customers** — sharing a data key across a customer's users needs a key-sharing scheme (per-user wrapped copies of the customer key, rotated on offboarding). Design before Tier 1 onboards its second seat.
- **Drive quota and API rate limits** — not a concern once Cloud Storage is the store, but confirm Drive isn't accidentally on any hot path.
- **Cost model** — £7/seat Workspace + Cloud consumption per project; validate margin on the shared tier with real pilot usage.

---

## 10. Next steps

1. Hand-provision a Workspace tenant + Cloud project for one pilot customer (Tier 1).
2. Implement OIDC login (no refresh tokens) and passkey + PRF key wrapping in the Risk Mandate app.
3. Point SGit at a per-customer Cloud Storage bucket; confirm Drive is out of the data path.
4. Write the Tier 1 trust statement (admin audit log + ciphertext + DPA).
5. Design the multi-user key-sharing scheme.
6. Prototype a Tier 1 → Tier 3 domain transfer on a throwaway tenant to prove the migration story.
7. Evaluate Google partner/reseller onboarding once pilot volume justifies automation.


---

## 11. Client-side data access — Marketplace domain install

**Goal:** a user signed into their Workspace account opens `riskmandate.ai` (or `sgit.ai`) and the page can read their Drive and Gmail **in the browser**, limited to what they can already access, with no OAuth consent prompts and no tokens ever touching Risk Mandate's servers.

### 11.1 Mechanism

- Risk Mandate is published as a **Google Workspace Marketplace app**, listed privately to the tenant.
- The tenant admin performs a **domain install**. This pre-grants the app's scopes for every user in the domain — the admin's consent replaces per-user consent.
- The web page uses **Google Identity Services** (token client) to request an access token silently against the user's existing Google session. Because the grant is already on file, no consent screen appears.
- The token lives only in the tab. Drive and Gmail enforce the user's own ACLs, so the page can only reach what the user could already open.
- Tokens expire hourly; a silent re-request renews them without a prompt while the Google session is alive.

This is **not** a browser extension. Nothing is installed in Chrome. The grant is recorded against the tenant.

### 11.2 Scopes

| Need | Scope | Notes |
|---|---|---|
| Open specific Drive files | `drive.file` + Google Picker | User picks a file; app sees only that file. Also enables "Open with Risk Mandate" in Drive. |
| Browse Drive broadly | `drive.readonly` | Only if Picker is insufficient. Broader; prefer `drive.file`. |
| Read Gmail | `gmail.readonly` | No picker equivalent; filter client-side. |

Keep every scope read-only unless a write path is explicitly designed.

### 11.3 Allow-listing which sites may invoke the app

Two controls, both required:

1. **Google Cloud Console → OAuth client → Authorised JavaScript origins.** List `https://riskmandate.ai`, `https://sgit.ai` and any other Risk Mandate-owned origin. Google issues tokens only to pages served from these origins. Either one client with multiple origins, or one client per site under the same Cloud project.
2. **Admin console → Security → API controls → App access control.** Mark the Risk Mandate app as *Trusted*; set unconfigured third-party apps to *Restricted* (or *Limited*). No other app can then request Workspace data from users in the tenant, even with user consent.

Together these mean: only Risk Mandate-owned origins can mint tokens, and only Risk Mandate's app is permitted to hold Workspace scopes in the tenant.

### 11.4 Clean-browser login walkthrough

1. User opens a clean Chrome and signs into `accounts.google.com` with their Workspace username, password and 2FA.
2. Google session established. The domain install is already on file; the app appears in the waffle launcher and in Drive's "Open with" menu.
3. User navigates to `riskmandate.ai`. The page performs OIDC sign-in — passes silently against the existing Google session.
4. The page requests a Drive/Gmail access token via Google Identity Services — passes silently because the admin grant covers these scopes. Token held in the tab only.
5. The page performs one **passkey assertion with PRF** (the only user-visible step on a clean device) to derive the wrapping key and unwrap the SGit data key in memory.
6. User works. Drive/Gmail reads happen client-side with the user's own permissions; SGit encrypt/decrypt happens client-side; ciphertext goes to the per-customer Cloud Storage bucket.
7. On tab close, the access token and the data key are gone. Nothing persists in plaintext anywhere.

### 11.5 Why not domain-wide delegation for this

Domain-wide delegation (service account impersonating users) also removes consent prompts, but it moves data access **server-side** and creates the most powerful credential in the design. It is reserved for Tier 2/3 features that must run without the user present, scoped narrowly, run on Cloud Run with Workload Identity (no key file), and with every impersonation logged. For the client-side experience above it is unnecessary.
