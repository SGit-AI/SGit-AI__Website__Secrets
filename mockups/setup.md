# Mockup 2: First run: create a passkey

> A design mockup of the first run: create a passkey screen at secrets.sgit.ai/app/setup.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/setup.html> · site v0.1.7 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: ten screens as static pictures in a mini browser frame and as ASCII art, each linked to the intent it realises · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/setup.html` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). A static picture: nothing on it works, the values are invented, and the screen itself is proposed.

Three steps on one page: create the passkey (the authenticator asks for a gesture), the browser generates the keyring, and the recovery code is shown once behind an "I have written it down" gate. If the authenticator cannot do PRF the page says so and offers the recovery code only, or another authenticator. The page says in plain words that losing every passkey and the code means the data is gone.

https://**secrets.sgit.ai/app/setup.html**
secrets.sgit.aidevlocked
VaultDevicesEnvironmentAccount
dinis@example.com

## Set up your keyring

1 · **Create a passkey** ✓ created on this device, PRF supported

2 · **Generate the keyring** ✓ written to users/…/keyring.json

3 · **Write down your recovery code**

K7QM-2HXD-9PAW-LT4R-CE6N-VB3S-JY
This code is shown once. It is the only other way to open your keyring. Lose every passkey and this code, and the data is gone; nobody can reset it.
☐ I have written it down somewhere safe Continue to the vault

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
