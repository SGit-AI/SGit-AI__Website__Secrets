# Mockup 5: One entry: an sgit vault key

> A design mockup of the one entry: an sgit vault key screen at secrets.sgit.ai/app/entry.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/entry.html> · site v0.1.8 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · shipped v0.1.8 Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/entry.html` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). An interactive prototype: click through it on invented data this browser keeps, in one of three UX variants (A Desk, B Focus, C Command) from the frame's bar; the column beside it says what the screen is, the paths to it and from it, and what you have done. The screen itself is proposed.

One entry, kind-specific fields, reveal on request, copy with a clipboard that clears after 30 seconds. An sgit-vault-key entry shows its prefix and carries the warning that it is write access to a vault; it will refuse to enter a shareable set (phase 2) without a confirmation. Edit and delete are here; delete asks twice.

## The same screen as ASCII

```
┌─ secrets.sgit.ai/app/entry.html ─────────────────────────────────┐
│ secrets.sgit.ai [prod] [unlocked]  Vault* Devices Env Account    │
├──────────────────────────────────────────────────────────────────┤
│ Vault / sgit.ai board vault                                      │
│ (sgit-vault-key) sgit.ai board vault                             │
│ Vault key  ┌────────────────────────────────────────────────┐    │
│            │ sgit_private_vault_••••••••••••••••••••••••••• │    │
│ [ Reveal ] [ Copy (clears in 30 s) ]                             │
│ ! This is a vault key: write access, no partly-public form.      │
│   It will not be shared without a confirmation.                  │
│ Vault id   a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d                  │
│ Notes      The site's own task board.                            │
│ Tags       sgit, site                                            │
│ Created 2026-09-12 · updated 2026-10-01 · 412 B of 16 KB         │
│ [ Edit ] [ Delete ]  Back to the vault                           │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [entries](/review/ui/#node=entries) · [entries.vault-key-guard](/review/ui/#node=entries.vault-key-guard) · [entries.limits](/review/ui/#node=entries.limits).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/entry.html)*
