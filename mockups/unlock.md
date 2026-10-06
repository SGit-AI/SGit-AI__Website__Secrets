# Mockup 3: Unlock

> A design mockup of the unlock screen at secrets.sgit.ai/app/unlock.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/unlock.html> · site v0.1.8 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · shipped v0.1.8 Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/unlock.html` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). An interactive prototype: click through it on invented data this browser keeps, in one of three UX variants (A Desk, B Focus, C Command) from the frame's bar; the column beside it says what the screen is, the paths to it and from it, and what you have done. The screen itself is proposed.

One gesture. The page calls navigator.credentials.get with the PRF evaluation; the authenticator returns 32 bytes bound to this origin; the browser derives the wrapping key, unwraps the KEK and decrypts the body into memory. The recovery code is the fallback. Nothing decrypted is written anywhere.

## The same screen as ASCII

```
┌─ secrets.sgit.ai/app/unlock.html ────────────────────────────────┐
│ secrets.sgit.ai  [prod] [locked]             dinis@example.com   │
├──────────────────────────────────────────────────────────────────┤
│          ┌──────────────────────────────────────────┐            │
│          │ Unlock your keyring                      │            │
│          │ Keyring found: rev 7, 23 entries         │            │
│          │                                          │            │
│          │ [ Unlock with passkey ]                  │            │
│          │ Touch your key, or Face ID / Touch ID    │            │
│          │                                          │            │
│          │ No passkey here? Use the recovery code   │            │
│          │ ┌──────────────────────────────────────┐ │            │
│          │ │ ____-____-____-____-____-____-__     │ │            │
│          │ [ Unlock with the code ]                 │            │
│          └──────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [returning](/review/ui/#node=returning) · [flow.returning](/review/ui/#node=flow.returning) · [flow.new-device](/review/ui/#node=flow.new-device).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/unlock.html)*
