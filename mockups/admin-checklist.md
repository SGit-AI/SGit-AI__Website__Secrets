# Mockup 9: Admin: the setup checklist

> A design mockup of the admin: the setup checklist screen at secrets.sgit.ai/admin/setup-checklist.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/admin-checklist.html> · site v0.1.10 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.5](/review/ui/#node=claim.site.mockups) Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · [shipped v0.1.8](/review/ui/#node=claim.site.mockups-variants) Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/admin/setup-checklist.html` is meant to look like, from section 6.3 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). An interactive prototype: click through it on invented data this browser keeps, in one of three UX variants (A Desk, B Focus, C Command) from the frame's bar; the column beside it says what the screen is, the paths to it and from it, and what you have done. The screen itself is proposed.

Every section-4.2 resource as a row: exists, enabled, configured, with Fix where the page can do it client-side with the operator's own token. The token lives in memory only; every write shows the exact request before it is sent and logs the response on the page.

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
