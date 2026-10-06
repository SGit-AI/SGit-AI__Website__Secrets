# Mockup 4: The vault: the list

> A design mockup of the the vault: the list screen at secrets.sgit.ai/app/vault.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/vault.html> · site v0.1.12 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.5](/review/ui/#node=claim.site.mockups) Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · [shipped v0.1.8](/review/ui/#node=claim.site.mockups-variants) Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/vault.html` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). An interactive prototype: click through it on invented data this browser keeps, in one of three UX variants (A Desk, B Focus, C Command) from the frame's bar; the column beside it says what the screen is, the paths to it and from it, and what you have done. The screen itself is proposed.

The list: search, a filter by kind, add, open. Kinds are a closed list and each has its own colour, so a vault key never looks like a password. The lock state and the environment are in the header. Entries are small; the keyring soft limit is shown as a figure, not a bar that lies.

## The same screen as ASCII

```
┌─ secrets.sgit.ai/app/vault.html ─────────────────────────────────┐
│ secrets.sgit.ai [prod] [unlocked]  Vault* Devices Env Account    │
├──────────────┬───────────────────────────────────────────────────┤
│ Search       │ Vault                                             │
│ [git       ] │ (password)       github.com (dinis)    2 days ago │
│ Kinds        │ (sgit-vault-key) sgit.ai board vault   2026-10-01 │
│ password  11 │ (sgit-read-key)  code review graphs    2026-09-30 │
│ api-key    6 │ (api-key)        OpenRouter            2026-09-21 │
│ vault-key  2 │ (pki-private)    sgit pki: dinis       2026-09-18 │
│ read-key   3 │                                                   │
│ pki        1 │                                                   │
│ 23 entries   │                                                   │
│ 41 KB / 1 MB │                                                   │
│ [+ Add entry]│                                                   │
└──────────────┴───────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [entries](/review/ui/#node=entries) · [returning](/review/ui/#node=returning).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/vault.html)*
