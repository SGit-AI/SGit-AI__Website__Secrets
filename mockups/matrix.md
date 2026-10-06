# Mockup 10: Tests: the compatibility matrix

> A design mockup of the tests: the compatibility matrix screen at secrets.sgit.ai/tests/matrix.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/matrix.html> · site v0.1.13 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.5](/review/ui/#node=claim.site.mockups) Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · [shipped v0.1.8](/review/ui/#node=claim.site.mockups-variants) Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/tests/matrix.html` is meant to look like, from section 6.4 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). An interactive prototype: click through it on invented data this browser keeps, in one of three UX variants (A Desk, B Focus, C Command) from the frame's bar; the column beside it says what the screen is, the paths to it and from it, and what you have done. The screen itself is proposed.

The probe pages run in sequence and the result is a shareable summary: browser, OS, authenticator, and one row per probe with PASS, FAIL or SKIP and the raw value behind it. A visitor pastes it into an issue; the dated rows become the support table on the keyring page.

## The same screen as ASCII

```
┌─ secrets.sgit.ai/tests/matrix.html ──────────────────────────────┐
│ secrets.sgit.ai [prod]  webauthn-prf crypto config auth matrix*  │
├──────────────────────────────────────────────────────────────────┤
│ Compatibility matrix     Chrome 131 · macOS 15 · GPM · 2026-10-06│
│ WebCrypto: HKDF, AES-GCM, RSA-OAEP, ECDSA   PASS   4 of 4 KATs   │
│ Passkey create with prf                     PASS   prf.enabled   │
│ PRF eval returns 32 bytes                   PASS   same/differs  │
│ Config: environment, fields, key restricted PASS   prod, file    │
│ Auth: sign in, claims, sign out             SKIP   not signed in │
│ Storage: owner write, foreign 403           SKIP   not signed in │
│ Leak check                                  PASS   0 suspicious  │
│ [ Copy as markdown ]                                             │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [probes](/review/ui/#node=probes) · [probes.pages](/review/ui/#node=probes.pages).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/matrix.html)*
