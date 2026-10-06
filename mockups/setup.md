# Mockup 2: First run: create a passkey

> A design mockup of the first run: create a passkey screen at secrets.sgit.ai/app/setup.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/setup.html> · site v0.1.12 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.5](/review/ui/#node=claim.site.mockups) Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · [shipped v0.1.8](/review/ui/#node=claim.site.mockups-variants) Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/setup.html` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). An interactive prototype: click through it on invented data this browser keeps, in one of three UX variants (A Desk, B Focus, C Command) from the frame's bar; the column beside it says what the screen is, the paths to it and from it, and what you have done. The screen itself is proposed.

Three steps on one page: create the passkey (the authenticator asks for a gesture), the browser generates the keyring, and the recovery code is shown once behind an "I have written it down" gate. If the authenticator cannot do PRF the page says so and offers the recovery code only, or another authenticator. The page says in plain words that losing every passkey and the code means the data is gone.

## The same screen as ASCII

```
┌─ secrets.sgit.ai/app/setup.html ─────────────────────────────────┐
│ secrets.sgit.ai  [dev] [locked]              dinis@example.com   │
├──────────────────────────────────────────────────────────────────┤
│          ┌──────────────────────────────────────────┐            │
│          │ Set up your keyring                      │            │
│          │ 1 Create a passkey      ✓ PRF supported  │            │
│          │ 2 Generate the keyring  ✓ written        │            │
│          │ 3 Write down your recovery code          │            │
│          │                                          │            │
│          │      K7QM-2HXD-9PAW-LT4R-CE6N-VB3S-JY    │            │
│          │                                          │            │
│          │ ! Shown once. Lose every passkey and     │            │
│          │   this code and the data is gone.        │            │
│          │ [ ] I have written it down               │            │
│          │ [ Continue to the vault ]                │            │
│          └──────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [first-run](/review/ui/#node=first-run) · [flow.first-run](/review/ui/#node=flow.first-run).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/setup.html)*
