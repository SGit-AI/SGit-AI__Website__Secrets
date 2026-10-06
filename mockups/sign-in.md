# Mockup 1: Sign in

> A design mockup of the sign in screen at secrets.sgit.ai/app/, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/sign-in.html> · site v0.1.9 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.5](/review/ui/#node=claim.site.mockups) Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · [shipped v0.1.8](/review/ui/#node=claim.site.mockups-variants) Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). An interactive prototype: click through it on invented data this browser keeps, in one of three UX variants (A Desk, B Focus, C Command) from the frame's bar; the column beside it says what the screen is, the paths to it and from it, and what you have done. The screen itself is proposed.

The first screen of the app. The environment badge is always visible; prod is neutral, anything else is coloured so nobody enters a real secret into dev by mistake. Popup sign-in is the default; redirect is a switch on the Environment page. After sign-in the page routes to setup when there is no keyring and to unlock when there is.

## The same screen as ASCII

```
┌─ secrets.sgit.ai/app/ ───────────────────────────────────────────┐
│ secrets.sgit.ai  [dev]                     Vault Devices Env Acc │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│          ┌──────────────────────────────────────────┐            │
│          │ Sign in                                  │            │
│          │ Environment: [dev] sgit-secrets-dev      │            │
│          │                                          │            │
│          │ [ Sign in with Google ]                  │            │
│          │ or with an email address                 │            │
│          │ Email     ┌──────────────────────────┐   │            │
│          │           │ dinis@example.com        │   │            │
│          │ Password  ┌──────────────────────────┐   │            │
│          │           │ ••••••••••••             │   │            │
│          │ [ Sign in ]   Create account             │            │
│          │ ! The login decides which paths you may  │            │
│          │   touch; your passkey opens them.        │            │
│          └──────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [sign-in](/review/ui/#node=sign-in) · [flow.first-run](/review/ui/#node=flow.first-run) · [flow.returning](/review/ui/#node=flow.returning).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/sign-in.html)*
