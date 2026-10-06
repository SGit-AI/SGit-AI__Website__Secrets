# Mockup 7: Environment

> A design mockup of the environment screen at secrets.sgit.ai/app/environment.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/environment.html> · site v0.1.9 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.5](/review/ui/#node=claim.site.mockups) Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · [shipped v0.1.8](/review/ui/#node=claim.site.mockups-variants) Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/environment.html` is meant to look like, from section 5 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). An interactive prototype: click through it on invented data this browser keeps, in one of three UX variants (A Desk, B Focus, C Command) from the frame's bar; the column beside it says what the screen is, the paths to it and from it, and what you have done. The screen itself is proposed.

Pick a built-in environment, or enter a custom one with every field of config/environments.json; export it as JSON, import one, reset. Every value here is a public identifier. Changing environment signs the user out and clears every key from memory, and the page says so before the switch.

## The same screen as ASCII

```
┌─ secrets.sgit.ai/app/environment.html ───────────────────────────┐
│ secrets.sgit.ai [dev] [locked]      Vault Devices Env* Account   │
├──────────────────────────────────────────────────────────────────┤
│ Environment                                                      │
│ Changing it signs you out and clears every key from memory.      │
│ [prod] [dev*] [main] [custom…]                                   │
│ projectId      sgit-secrets-dev           region   europe-west2  │
│ authDomain     sgit-secrets-dev.firebaseapp.com   signIn  popup  │
│ storageBucket  sgit-secrets-dev.firebasestorage.app              │
│ apiKey         AIza… (public, restricted by referrer)            │
│ adminOauthClientId  ….apps.googleusercontent.com                 │
│ [ Export JSON ] [ Import JSON ]  Reset to the site default       │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [environment](/review/ui/#node=environment) · [flow.customer-environment](/review/ui/#node=flow.customer-environment).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/environment.html)*
