# Risk Mandate — User Onboarding & Account Experience

Oct 4, 2026 · @Dinis Cruz

## Summary

Risk Mandate provisions each user a Google Workspace account and runs the whole product on top of it, while the user sees Google only once: on the sign-in screen. First login is a password the browser generates; the user then enrols a passkey and never types that password again. From then on one biometric gesture both signs them into Google and unlocks their SGit data.

This is the companion to the architecture briefing (tiers, encryption, Cloud substrate). It covers only the user-facing account lifecycle: provisioning, first run, return visits, and how Gmail and Drive are used without ever showing their UI.

**Update after terms research:** Google's terms do not allow one Workspace tenant to hold several customers' staff without Google's written agreement. The shared tier therefore defaults to Google Identity Platform with Cloud Storage, and the Workspace flows in this document apply to tenants the customer owns, or to the shared tier once Google signs off. See *Tier model and options*.

## Decision: password once, then passkey

Google will not let an admin enrol a passkey on a user's behalf, so a Workspace account's first sign-in always needs a password typed once. We accept that and make it painless: the browser's password manager generates and stores it, and the very next screen enrols a passkey.

What this buys:

- No identity provider to run. Google remains the only IdP.
- 2FA from day one: the passkey is phishing-resistant and bound to the device.
- One gesture for everything: the same passkey carries the PRF secret that unwraps the SGit data key.
- Recovery rides on the user's personal Google or Apple keychain, not on Risk Mandate.

| Option | Password ever typed? | Who runs an IdP? | Verdict |
| --- | --- | --- | --- |
| Password once, then passkey (chosen) | Once | Google | Simple; accepted |
| Third-party SSO with passkey-only IdP | Never | Risk Mandate (Keycloak, Authentik, Descope, Auth0) | Rejected: operating an IdP |
| Personal Google as IdP for the tenant | Never | Nobody | Not possible: Google cannot be a SAML IdP for another Google tenant |
| Domain-wide delegation | Once | Google | Rejected for the client-side experience: server-side credential |

## Account provisioning

Risk Mandate creates the account; the user never sees the initial password. Two variants, both using the Admin SDK Directory API (`users.insert`).

**Variant A: random password, delivered out of band**

1. Create the user with a random password and `changePasswordAtNextLogin: true`. Discard the random value after delivery.
2. Send a pre-filled sign-in link carrying `login_hint=<new address>` so Google skips the account picker. Optionally as a QR code for phone onboarding.
3. Deliver the password separately (SMS, voice, in person).

Google will not accept a one-time code minted by Risk Mandate; the random password is the one-time credential.

**Variant B: Google-sent invite**

1. Create the user with a recovery email set to an address the person already reads.
2. Trigger Google's password-reset/invite email. Google delivers the link; Risk Mandate never holds a credential.

Variant B needs a reachable external email; Variant A does not. Hand-provision both while proving the model; move to the reseller provisioning APIs once volume justifies it.

No initial password can be avoided entirely with Google as the IdP. See the Rejected alternatives section for what it would take.

## First-run flow

Target: under two minutes, one password screen, one biometric prompt.

1. User opens the onboarding link (or scans the QR) on their phone or laptop. Google shows the password screen for the pre-filled address.
2. User enters the one-time password (Variant A) or the invite link's set-password screen appears (Variant B).
3. Google forces a new password. The browser's password manager offers a generated one; the user accepts it and never needs to remember it.
4. Google's "Protect your account" step offers a passkey. Risk Mandate's onboarding copy tells the user to accept: Face ID, fingerprint or hardware key. This is the 2FA.
5. Redirect lands on `riskmandate.ai`. OIDC sign-in passes silently against the fresh Google session.
6. The page requests Drive and Gmail tokens via Google Identity Services; the Marketplace domain install means no consent screen.
7. The page runs one WebAuthn assertion with PRF on the passkey just enrolled, derives the wrapping key, generates the SGit data key locally, wraps it and stores the wrapped blob in the customer's Cloud project.
8. Onboarding prompts a second passkey (hardware key or second device) as backup. This is the moment to pitch it; later prompts are ignored.

If Google's own passkey prompt is skipped in step 4, step 7 registers the passkey at `riskmandate.ai` instead and the user is asked to add it to their Google account from the Risk Mandate settings page. Both passkeys can live in the same Google Password Manager or iCloud Keychain.

## Returning-user experience

After first run the user never types a password again.

| Situation | What the user does | Mechanism |
| --- | --- | --- |
| Same browser, Google session alive | Opens riskmandate.ai; one biometric tap | OIDC silent sign-in; passkey + PRF assertion unlocks the data key |
| Same browser, Google session expired | One tap on the One Tap bubble, then one biometric | Sign in with Google One Tap; Workspace passkey-as-primary login skips the password |
| Clean device, new browser | Picks the account, one biometric, one biometric again | Workspace passkey login (synced via personal keychain); then PRF assertion |
| Lost device | Recovers personal Google or Apple account on a new device; passkeys sync back | Keychain recovery; no Risk Mandate involvement |
| All authenticators and personal account lost | Data unrecoverable | Accepted and stated in terms |

Access tokens expire hourly. Google Identity Services re-requests them silently while the Google session lives, so the user is never interrupted mid-session.

For the clean-device case to be passwordless, the tenant must have passkeys enabled as a primary sign-in method (Admin console, Security, Passkeys, "Skip passwords when possible").

## Risk Mandate as the only UI

Once the Marketplace domain install is in place, Gmail, Drive and Calendar are APIs the Risk Mandate page calls in the browser with the user's own permissions. The user can run on the full power of Workspace without opening a single Google page after sign-in.

What the user sees from Google, and only from Google:

- Sign-in, 2FA and passkey prompts
- Password reset and account recovery
- Security notifications (new device, suspicious sign-in)

What Risk Mandate renders instead:

- Inbox: `gmail.readonly` to read; a real mailbox exists, so Risk Mandate can receive mail on the user's behalf (evidence, notifications, approvals)
- Files: `drive.file` plus the Google Picker, or `drive.readonly` if browsing is needed; "Open with Risk Mandate" appears in Drive
- Calendar: `calendar.readonly` for deadlines and review dates

To keep users inside Risk Mandate, hide the Google apps from the launcher and, if wanted, turn the Gmail and Drive web UIs off for the organisational unit. The services keep working through the API; only the Google front ends disappear. If a user types mail.google.com with the UI still on, they will land in Gmail, so decide this per tier.

All Drive and Gmail reads happen client-side. Tokens stay in the tab; Risk Mandate's servers never see them.

## Admin configuration checklist

One-time setup per tenant. Same list applies on the Private tier, done by the customer's admin.

- [ ] Google Cloud Console: create the OAuth client; set Authorised JavaScript origins to `https://riskmandate.ai`, `https://sgit.ai` and any other Risk Mandate-owned origin. One client with several origins, or one client per site under the same project so each can be revoked alone.
- [ ] Google Cloud Console: configure the OAuth consent screen with the scopes `openid email profile`, `drive.file`, `gmail.readonly`, `calendar.readonly`. Add `drive.readonly` only if the Picker proves insufficient.
- [ ] Workspace Marketplace SDK: publish Risk Mandate as a private app for the tenant.
- [ ] Admin console, Apps, Marketplace apps: domain-install Risk Mandate for the organisational unit. This pre-grants the scopes for every user.
- [ ] Admin console, Security, API controls, App access control: mark Risk Mandate as Trusted; set unconfigured third-party apps to Restricted.
- [ ] Admin console, Security, Passkeys: allow users to skip passwords when possible.
- [ ] Admin console, Security, 2-Step Verification: enforce, with passkeys and security keys permitted; enrolment grace period of 1 day.
- [ ] Admin console, Apps, Google Workspace: hide Gmail, Drive, Calendar from the app launcher for the OU; decide per tier whether to turn their web UIs off.
- [ ] Admin console, Account, Recovery: set the recovery email policy (required for Variant B invites).
- [ ] Admin console, Reporting, Audit: confirm Admin audit log and OAuth token audit log retention; export to the customer's Cloud project on Tier 2 and 3.

## Rejected alternatives

Recorded so the reasoning survives.

**Third-party SSO with a passkey-only IdP.** Point the tenant at an external SAML IdP (Keycloak, Authentik self-hosted; Descope, Auth0 hosted). Google then never shows a password screen; the IdP enrols a passkey on first visit via QR or push. The Google password still exists, random and unknown, but is never used. Rejected because Risk Mandate does not want to operate an identity provider. Revisit if a Tier 3 customer already runs one and wants Risk Mandate behind it.

**Keycloak brokering a personal Google account.** Keycloak accepts the user's personal Google sign-in via OIDC and re-issues it as a SAML assertion the tenant trusts. Elegant, but still an IdP to run. Same verdict.

**Personal Google account as the tenant's IdP.** Not possible: Workspace federates outward only to non-Google SAML providers. The personal account's real role is the recovery chain for the passkey, which already works.

**Domain-wide delegation for data access.** A service account impersonating users removes consent prompts but moves Drive and Gmail access server-side and creates the most powerful credential in the design. Reserved for Tier 2 and 3 features that must run without the user present; never for the client-side experience.

**Google Client-Side Encryption.** The right model, but Enterprise Plus only, not available on the seven-pound tier. SGit's own encryption gives the same guarantee at any tier.

## Tier model and options (updated after terms research)

Two rules now drive the design:

- **The terms decide who owns a Workspace tenant.** A Workspace tenant may only hold one organisation's people, unless Google agrees otherwise in writing. Data sensitivity does not change this.
- **Sensitivity decides who holds the keys and the infrastructure.** Non-sensitive work can share Risk Mandate infrastructure; sensitive work moves to infrastructure the customer owns.

What stays constant on every tier: SGit encrypts client-side, the data key is wrapped by a passkey PRF secret derived in the browser, and no Risk Mandate server ever holds plaintext or long-lived user tokens. The identity provider and the bucket rules decide *who can touch which path*; SGit decides *whether the bytes mean anything*.

### Tiers

| Tier | Identity | Storage | Who owns what | Terms status | For |
| --- | --- | --- | --- | --- | --- |
| **Shared (default)** | Google Identity Platform, one IdP tenant per customer | Cloud Storage for Firebase on Risk Mandate's bucket, Security Rules scoped to user and tenant | Risk Mandate owns the Cloud project; no Workspace involved | Within terms: Identity Platform is Google's customer-identity product, built for an app's own users | Pilots, non-sensitive work |
| **Shared on Workspace (pending)** | Workspace accounts in Risk Mandate's tenant | Cloud Storage; Gmail and Drive client-side | Risk Mandate owns tenant holding several customers' staff | **Needs Google's written agreement** (ToS §2.6, AUP). Do not launch before it is signed | Same as Shared, plus mailbox and Drive |
| **Customer Workspace** | Customer's own Workspace tenant; Risk Mandate is a domain-installed Marketplace app | Per-customer Cloud project; Gmail and Drive client-side | Customer owns tenant; buys direct or through Risk Mandate as reseller/distributor; Risk Mandate optionally delegated admin | Within terms. Restricted-scope app verification applies; no CASA while data stays client-side | Sensitive work, customers wanting Gmail/Drive in the product |
| **Private** | Customer's Workspace or own IdP | Customer's Cloud org and buckets; optional customer KMS or Google CSE | Customer owns everything; Risk Mandate sells setup and managed ops | Within terms | Regulated and enterprise |
| **Federated (add-on to any tier)** | Customer's existing Workspace, Entra or other SAML/OIDC IdP federated into Identity Platform | As the tier it attaches to | Customer keeps its own accounts | Within terms | Customers who already have an IdP |

Migration path: Shared to Customer Workspace or Private moves the customer's SGit bucket into their own Cloud project. Nothing is re-encrypted, because the keys were never Risk Mandate's.

### Shared tier: zero servers Risk Mandate runs

1. Browser signs in with the Identity Platform (Firebase Auth) JS SDK into the customer's IdP tenant.
2. Browser runs its own WebAuthn assertion with PRF to unwrap the SGit data key. This works whatever the IdP, so Identity Platform's limited native passkey support does not block the design.
3. Browser reads and writes Cloud Storage for Firebase directly; Security Rules restrict each user to `tenants/{tenantId}/users/{uid}/` and shared customer paths.
4. No Risk Mandate backend sits in the data path.

**Cost:** basic sign-in free up to 50,000 MAU, then about $0.0055 per MAU; SAML/OIDC federation free only to 50 MAU. Far below £7 per seat. **Gives up:** mailbox, Drive, Calendar and Google-run account recovery. If the product needs inbound email, add a mail service separately.

### AWS variant

Same architecture for an AWS-hosted private tier: Cognito user pool for sign-in, Cognito identity pool to swap the token for temporary AWS credentials in the browser, S3 with an IAM policy limiting each user to their own identity-ID prefix. Cognito has native passkey support. Multi-tenancy is a pool per customer or tenant attributes. SGit encryption and passkey PRF are unchanged.

### Request to Google for the Shared-on-Workspace tier

The Terms allow the restrictions to be waived if Google specifically agrees in writing. Ask for:

- Permission to provision End User Accounts in Risk Mandate's tenant for staff of multiple customer organisations, embedded in the Risk Mandate product, with Google's UI hidden.
- Permission for customers to offer the same onward to their own clients, if wanted.
- Clarity that a risk-workflow interface over Gmail and Drive is not a "substitute or similar service" (ToS §2.6(c)).
- The commercial vehicle: amendment to Risk Mandate's Workspace agreement, or reseller/ISV partner agreement.

Get it signed by someone with contracting authority, not an email from a contact. Until then the Shared tier runs on Identity Platform, and switches to Workspace only once the agreement lands.

### Decision summary

| Question | Decision |
| --- | --- |
| Default substrate for shared, non-sensitive use | Identity Platform + Cloud Storage for Firebase |
| When Workspace is used | Customer owns the tenant, or Google has signed off on the shared Workspace tier |
| How Risk Mandate earns on Workspace | Reseller/distributor margin plus setup and managed services |
| What never changes | Client-side SGit encryption, passkey PRF key wrapping, no server-side plaintext or long-lived tokens |
| AWS | Cognito + identity pool + S3 as a drop-in private-tier option |

## Research A: Google commercial and terms restrictions

The Shared tier as designed breaks Google's terms. Risk Mandate holding one tenant and handing accounts in it to other companies' staff is exactly what the Acceptable Use Policy forbids. The Delegated and Private tiers are fine, and the compliant way to keep the "we pass on the £7 seat" model is to resell a separate tenant per customer, through Google's reseller programme or a distributor.

| Restriction | Source | Impact on Risk Mandate |
| --- | --- | --- |
| Customer may not sell, resell or lease the Services to a third party unless the agreement authorises it | Workspace Terms of Service §2.6(a) | Tier 1 (one Risk Mandate tenant, many customers) is resale without authorisation. Blocking. |
| May not resell End User Accounts, or parts of them, as part of a commercial product offered to third parties | Workspace / Cloud Acceptable Use Policy | Bundling seats inside the Risk Mandate product from our own tenant is named explicitly. Blocking for Tier 1. |
| May not "attempt to create a substitute or similar service" using the Services | Workspace ToS §2.6(c) | Building a Gmail-like inbox UI is a grey zone. Keep the UI risk-workflow-shaped, not a general mail client. Ask counsel. |
| One human per account; no shared accounts outside delegation; no function accounts used to share files | Acceptable Use Policy | Each seat is a real person; agent and service identities must be service accounts, not users. |
| Admins may access End User data; customer must obtain consents for that | Workspace ToS | Already planned (audit log + DPA). In a per-customer tenant the customer, not Risk Mandate, is the controller. |
| Reseller must have each customer accept Google's ToS itself; cannot accept on their behalf | Reseller agreements | Onboarding includes a Google ToS click-through per customer tenant. |
| Reseller cannot resell to someone who will resell onward | Reseller agreements | Customers cannot sub-resell their Risk Mandate seats. |
| Direct Google partner status: \~100 provisioned seats, business plan, credit check | Google partner programme (as reported by distributors Vendasta, Sherweb) | Not reachable at pilot scale. Use a distributor (Sherweb, Vendasta: no minimums) until volume justifies direct. |
| Max 2 reseller transfers per calendar year per subscription; licence count cannot drop below commitment on transfer | Workspace transfer rules | Plan the Tier 1-to-Tier 3 move once; prefer Flexible plans. |
| Gmail read scopes and `drive` / `drive.readonly` are restricted scopes | Google OAuth policy | Internal app in the same org: exempt. Third-party app into customer tenants: needs Google app verification even when domain-installed; annual CASA security assessment if restricted data passes through our servers. Keep reads client-side and prefer `drive.file`. |

**SLA.** Workspace guarantees 99.9% monthly uptime, with credits capped at 15 days of service per month, as extra days or, for monthly billing, an invoice credit. Bought through a reseller, the credit flows through that reseller. There is no money-back remedy, so Risk Mandate should not promise customers an SLA stronger than Google's on Workspace-dependent functions; Cloud Storage has its own SLA.

**What this changes in the design:**

- The shared tier no longer uses a Risk Mandate Workspace tenant; it runs on Identity Platform and Cloud Storage until Google agrees otherwise in writing. See *Tier model and options*.
- Workspace is used where the customer owns the tenant, bought direct or through Risk Mandate as reseller.
- The only users in Risk Mandate's own Workspace tenant are Risk Mandate staff.
- The client-side architecture already minimises the verification burden: no server-side Gmail or Drive data means verification without CASA.

Sources: [Workspace Terms of Service](https://workspace.google.com/terms/standard_terms/) · [Acceptable Use Policy](https://cloud.google.com/cloud/terms/aup) · [Workspace SLA](https://workspace.google.com/terms/sla/?hl=es) · [EDU reseller terms](https://workspace.google.com/terms/reseller/amendment_edu_reselling) · [Transfer to resellers](https://knowledge.workspace.google.com/admin/billing/transfer-subscriptions-between-google-and-resellers) · [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) · [Gmail API scopes](https://developers.google.com/gmail/api/auth/scopes?authuser=2) · [Vendasta on partner requirements](https://www.vendasta.com/blog/google-workspace-reseller/) · [Sherweb reseller](https://www.sherweb.com/productivity/google-workspace/resell/)

Not legal advice; confirm the Tier 1 restructuring and the "substitute service" question with counsel before launch.

## Research B: who else has done this

Each half of the design has well-known precedents; the full combination does not show up in public sources. Website builders and payment companies resell a per-customer Workspace tenant bundled with their product, and email startups put their own UI over Gmail. No company surfaced that resells Workspace as the identity, storage and mail substrate for a non-email product with client-side encryption on top. That gap is either Risk Mandate's opening or a sign the economics or terms bite; the absence of results is not proof nobody has.

| Who | What they do | Which half of the pattern | Lesson for Risk Mandate |
| --- | --- | --- | --- |
| [Squarespace](https://leadsmonky.com/google-workspace-vs-squarespace/) | Authorised reseller; sells real Workspace inside its accounts, billed by Squarespace, often a free first year of Business Starter | Reseller bundle, per-customer tenant | Proves the bundle model at scale. Only works for new tenants; an existing Workspace cannot be linked. |
| [Square](https://community.squareup.com/t5/Troubleshooting/Where-do-I-pay-for-Google-Workspace/m-p/754859) | Resells Workspace to merchants; Google tells users to "contact reseller" for billing | Reseller bundle | Support burden lands on the reseller; users get confused about who to pay. Budget for first-line support. |
| [Google Domains to Squarespace](https://www.searchenginejournal.com/google-domains-agrees-to-be-acquired-by-squarespace/) | Google moved its own domain-plus-Workspace customers to Squarespace billing | Reseller at scale | Google itself relies on resellers for the bundled small-business segment. |
| [Sherweb](https://www.sherweb.com/productivity/google-workspace/resell/), [Vendasta](https://www.vendasta.com/blog/google-workspace-reseller/), [AppXite](https://www.appxite.com/google) | Distributors and platforms letting smaller firms resell Workspace without Google's direct-partner minimums; provisioning and billing automation | Reseller plumbing | The practical route for Risk Mandate at pilot scale. |
| [WHMCS Workspace module](https://www.modulesgarden.com/products/whmcs/google-workspace) | Hosting companies provision Workspace seats from their billing system | Automated provisioning | Reseller API provisioning is a solved, off-the-shelf problem. |
| [Superhuman](https://sacra.com/chat/h/4c327cd9-4a73-4c8e-bdc3-8527575402c0/) | Workflow and UI layer on a user's existing Gmail or Outlook via OAuth; Google keeps storage, spam and deliverability | Own UI over Gmail | Owning the interface but not the rails; exposed to Google's API quotas and policy. |
| [Shortwave](https://sacra.com/chat/h/5e7868c3-fa5f-4145-a8d9-a8b9f7f15384/) | Gmail-only client that indexes mail server-side for AI search | Own UI over Gmail, server-side | The server-side path means restricted-scope verification and CASA. Risk Mandate's client-side design avoids the heaviest part. |
| [MailMate](https://lists.freron.com/mailmate/2025-April/018273.html) | Small desktop mail client that had to pass CASA Tier 2 to keep Gmail OAuth | Restricted scope cost | Even small vendors face the audit when acting as a third-party app; plan for it on Tier 2/3. |

**Where Risk Mandate differs from all of them:** the customer does not bring an account or buy email; the account is provisioned as the product's identity and data home, the product's data is encrypted before Google sees it, and the Google UI is hidden. Closest analogy: Squarespace's bundle plus Superhuman's interface plus end-to-end encryption.

One honest risk the precedents show: platform dependence. Superhuman and Shortwave live inside Google's quotas and policy; a reseller relationship adds Google's terms on top. Keep SGit's data portable (it already is, in Cloud Storage) so a Google policy change costs a migration, not the company.

## Open questions and next steps

Open questions:

- Does Google's post-password "add a passkey" prompt appear reliably on Business Starter, or does it need an admin nudge? Test on a fresh tenant.
- Can the Google-account passkey and the riskmandate.ai passkey be the same credential for PRF purposes, or do users hold two? Two is fine, but the onboarding copy depends on the answer.
- PRF support on older Android and on managed Chrome with enterprise policies: build the compatibility matrix.
- Which tiers turn the Gmail and Drive web UIs off entirely versus only hiding them from the launcher?
- Multi-user customers: how is the customer data key shared across seats and rotated on offboarding? Not yet designed.

Next steps:

- [ ] Stand up a throwaway tenant and run the full first-run flow on a clean phone and a clean laptop; time it.
- [ ] Implement OIDC sign-in with no refresh tokens and the GIS token client for Drive, Gmail, Calendar.
- [ ] Implement passkey registration with PRF and data-key wrapping; test recovery by wiping a device.
- [ ] Write the onboarding copy for the passkey and backup-passkey prompts.
- [ ] Draft the terms language on unrecoverable data.
- [ ] Design the multi-user key-sharing scheme before the second seat on any customer.
