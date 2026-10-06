# Design mockups

> What the app, admin and test screens are meant to look like, before they exist: ten mockups, each as a static picture in a mini browser frame and as ASCII art, with the intent nodes it realises. Every screen is proposed.

*Source: <https://secrets.sgit.ai/mockups/> · site v0.1.5 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: ten screens as static pictures in a mini browser frame and as ASCII art, each linked to the intent it realises · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers · proposed Devices page: add and remove passkeys, regenerate the recovery code · proposed Setup checklist: every per-project resource as a row, with Fix where fixable client-side · proposed Browser probe pages: webauthn-prf, crypto, config, auth, storage, keyring-roundtrip, offline, leak-check, matrix

The screens the brief describes, drawn before they are built, the way a Figma board would be: a static picture of each in a mini browser frame, the same picture as ASCII art so an agent can read it, and the intent nodes in [the review graph](/review/ui/) that each screen realises. Nothing here works; every value is invented; every screen is proposed.

The order is the order a user meets them: sign in, first run, unlock, the vault, an entry, devices, environment, account; then the operator's checklist and the compatibility matrix. A mockup changes when the brief or a correction changes it, and is replaced by the real page's screenshot when the page ships.

- [**1. Sign in**](/mockups/sign-in.md)
secrets.sgit.ai/app/
section 6.2
- [**2. First run: create a passkey**](/mockups/setup.md)
secrets.sgit.ai/app/setup.html
section 6.2
- [**3. Unlock**](/mockups/unlock.md)
secrets.sgit.ai/app/unlock.html
section 6.2
- [**4. The vault: the list**](/mockups/vault.md)
secrets.sgit.ai/app/vault.html
section 6.2
- [**5. One entry: an sgit vault key**](/mockups/entry.md)
secrets.sgit.ai/app/entry.html
section 6.2
- [**6. Devices: passkeys and the recovery code**](/mockups/devices.md)
secrets.sgit.ai/app/devices.html
section 6.2
- [**7. Environment**](/mockups/environment.md)
secrets.sgit.ai/app/environment.html
section 5
- [**8. Account**](/mockups/account.md)
secrets.sgit.ai/app/account.html
section 6.2
- [**9. Admin: the setup checklist**](/mockups/admin-checklist.md)
secrets.sgit.ai/admin/setup-checklist.html
section 6.3
- [**10. Tests: the compatibility matrix**](/mockups/matrix.md)
secrets.sgit.ai/tests/matrix.html
section 6.4

## What a mockup is here

- **Static.** HTML and CSS only, under the site's Content-Security-Policy: no script, no form that submits, no inline style.
- **Honest.** The header on every screen carries the environment badge and the lock state the brief requires; the values are obviously invented and no real identifier appears.
- **Traceable.** Each screen names the brief section it draws and links the stories, rules and flows it realises in the review navigator, so a reader can check the picture against the intent.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/)*
