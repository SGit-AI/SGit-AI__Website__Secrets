# Mockup 8: Account

> A design mockup of the account screen at secrets.sgit.ai/app/account.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/account.html> · site v0.1.7 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: ten screens as static pictures in a mini browser frame and as ASCII art, each linked to the intent it realises · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/account.html` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). A static picture: nothing on it works, the values are invented, and the screen itself is proposed.

Who you are and where: email, uid, environment. Sign out and wipe memory. Export the encrypted keyring as a file (it is ciphertext; a copy is yours to keep) and import one to replace what is in the bucket, with the generation precondition shown.

https://**secrets.sgit.ai/app/account.html**
secrets.sgit.aiprodunlocked
VaultDevicesEnvironmentAccount
dinis@example.com

## Account

| Email | dinis@example.com |
|---|---|
| uid | Qk3…fake…uid…9z |
| Environment | prod sgit-secrets-prod |
| Keyring | rev 7 · generation 1696500000000000 · 23 entries · 3 passkeys + recovery |

Sign outWipe memory now

## Your ciphertext

The keyring is ciphertext. A copy is yours to keep; nobody, including us, can open it without your passkey or code.

Export encrypted keyring (keyring.json)Import and replace…

## The same screen as ASCII

```
┌─ secrets.sgit.ai/app/account.html ───────────────────────────────┐
│ secrets.sgit.ai [prod] [unlocked]  Vault Devices Env Account*    │
├──────────────────────────────────────────────────────────────────┤
│ Account                                                          │
│ Email        dinis@example.com                                   │
│ uid          Qk3…fake…uid…9z                                     │
│ Environment  [prod] sgit-secrets-prod                            │
│ Keyring      rev 7 · 23 entries · 3 passkeys + recovery          │
│ [ Sign out ] [ Wipe memory now ]                                 │
│ Your ciphertext                                                  │
│ [ Export encrypted keyring ] [ Import and replace… ]             │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [account](/review/ui/#node=account).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/account.html)*
