# Mockup 6: Devices: passkeys and the recovery code

> A design mockup of the devices: passkeys and the recovery code screen at secrets.sgit.ai/app/devices.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/devices.html> · site v0.1.5 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: ten screens as static pictures in a mini browser frame and as ASCII art, each linked to the intent it realises · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/app/devices.html` is meant to look like, from section 6.2 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). A static picture: nothing on it works, the values are invented, and the screen itself is proposed.

Every registered passkey with its name, when it was created and last used; add a passkey on this device; remove one, which is refused while it is the last unlock method; regenerate the recovery code, which invalidates the old one and shows the new one once. Each change is a new wrap in the keyring and a write with a precondition.

https://**secrets.sgit.ai/app/devices.html**
secrets.sgit.aiprodunlocked
VaultDevicesEnvironmentAccount
dinis@example.com

## Devices

Each passkey holds a wrapped copy of your keyring key. Removing the last one while no recovery code exists is refused.

- passkeyMacBook Chrome · this devicecreated 2026-09-12 · used todayRenameRemove
- passkeyiPhone (iCloud Keychain)created 2026-09-14 · used 2026-10-03RenameRemove
- passkeyYubiKey 5Ccreated 2026-09-20 · never usedRenameRemove
- recoveryRecovery codegenerated 2026-09-12Regenerate

+ Add a passkey on this device

## The same screen as ASCII

```
┌─ secrets.sgit.ai/app/devices.html ───────────────────────────────┐
│ secrets.sgit.ai [prod] [unlocked]  Vault Devices* Env Account    │
├──────────────────────────────────────────────────────────────────┤
│ Devices                                                          │
│ Each passkey holds a wrapped copy of your keyring key.           │
│ passkey  MacBook Chrome (this device)  2026-09-12  [Rename][Rem] │
│ passkey  iPhone (iCloud Keychain)      2026-09-14  [Rename][Rem] │
│ passkey  YubiKey 5C                    2026-09-20  [Rename][Rem] │
│ recovery Recovery code                 2026-09-12  [Regenerate]  │
│                                                                  │
│ [ + Add a passkey on this device ]                               │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [new-device](/review/ui/#node=new-device) · [new-device.devices-page](/review/ui/#node=new-device.devices-page).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/devices.html)*
