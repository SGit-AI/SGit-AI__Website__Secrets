# Mockup 4: The vault: the list

> A design mockup of the the vault: the list screen at secrets.sgit.ai/app/vault.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/vault.html> · site v0.1.7 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: ten screens as static pictures in a mini browser frame and as ASCII art, each linked to the intent it realises · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/vault.html` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). A static picture: nothing on it works, the values are invented, and the screen itself is proposed.

The list: search, a filter by kind, add, open. Kinds are a closed list and each has its own colour, so a vault key never looks like a password. The lock state and the environment are in the header. Entries are small; the keyring soft limit is shown as a figure, not a bar that lies.

https://**secrets.sgit.ai/app/vault.html**
secrets.sgit.aiprodunlocked
VaultDevicesEnvironmentAccount
dinis@example.com
Search
git

Kinds

password 11 · api-key 6
sgit-vault-key 2 · sgit-read-key 3
pki-private-key 1 · note 0

23 entries · 41 KB of 1 MB

+ Add entry

## Vault

- passwordgithub.com (dinis)updated 2 days ago
- sgit-vault-keysgit.ai board vaultupdated 2026-10-01
- sgit-read-keycode review graphs (published)2026-09-30
- api-keyOpenRouter, infographic-gen2026-09-21
- pki-private-keysgit pki: dinis@example.com2026-09-18

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
