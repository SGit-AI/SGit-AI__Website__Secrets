# Mockup 9: Admin: the setup checklist

> A design mockup of the admin: the setup checklist screen at secrets.sgit.ai/admin/setup-checklist.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/admin-checklist.html> · site v0.1.6 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: ten screens as static pictures in a mini browser frame and as ASCII art, each linked to the intent it realises · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/admin/setup-checklist.html` is meant to look like, from section 6.3 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). A static picture: nothing on it works, the values are invented, and the screen itself is proposed.

Every section-4.2 resource as a row: exists, enabled, configured, with Fix where the page can do it client-side with the operator's own token. The token lives in memory only; every write shows the exact request before it is sent and logs the response on the page.

https://**secrets.sgit.ai/admin/setup-checklist.html**
secrets.sgit.aidev · sgit-secrets-dev
IndexChecklistAuth configStorageRulesUsersExport
admin as dinis@example.com (token in memory, 52 min left)

## Setup checklist: dev

| Resource | State |  |
|---|---|---|
| Services: identitytoolkit, firebase, firebasestorage, storage, firebaserules… | ✓ 8 of 8 enabled |  |
| Firebase project link and web app | ✓ appId 1:…:web:… |  |
| Identity Platform: email sign-in, authorised domains | ✗ localhost missing | Fix: add localhost |
| Google provider (client id set, secret held by Google) | ✓ configured |  |
| Bucket: uniform access, versioning, soft delete 30 d, CORS | ✗ CORS missing secrets.sgit.ai | Fix: apply canonical CORS |
| Security Rules release matches infra/rules/storage.rules | ✓ sha256 6caa0c52… |  |
| IAM: tf-secrets@ Editor; secrets-admins owner; no SA keys | ✓ |  |
| Workload Identity Federation pool and provider | · not readable with this scope |  |

Request preview for "add localhost": PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/sgit-secrets-dev/config?updateMask=authorizedDomains · body {"authorizedDomains":["secrets.sgit.ai","localhost"]}

## The same screen as ASCII

```
┌─ secrets.sgit.ai/admin/setup-checklist.html ─────────────────────┐
│ secrets.sgit.ai [dev]  Index Checklist* Auth Storage Rules Users │
│                                admin as dinis@… (token: 52 min)  │
├──────────────────────────────────────────────────────────────────┤
│ Setup checklist: dev                                             │
│ Services (8)                         ✓ 8 of 8 enabled            │
│ Firebase project + web app           ✓ appId 1:…:web:…           │
│ Identity Platform: domains           ✗ localhost missing  [Fix]  │
│ Google provider                      ✓ configured                │
│ Bucket: access, versioning, CORS     ✗ CORS missing       [Fix]  │
│ Rules release == repo rules          ✓ sha256 6caa0c52…          │
│ IAM                                  ✓                           │
│ Workload Identity Federation         · not readable              │
│ Request preview: PATCH …/config?updateMask=authorizedDomains     │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [admin](/review/ui/#node=admin) · [admin.checklist](/review/ui/#node=admin.checklist) · [flow.admin](/review/ui/#node=flow.admin).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/admin-checklist.html)*
