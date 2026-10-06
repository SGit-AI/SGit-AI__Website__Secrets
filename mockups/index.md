# Design mockups

> What the app, admin and test screens are meant to look like, before they exist: ten mockups, each as a static picture in a mini browser frame and as ASCII art, with the intent nodes it realises. Every screen is proposed.

*Source: <https://secrets.sgit.ai/mockups/> · site v0.1.12 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.5](/review/ui/#node=claim.site.mockups) Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · [shipped v0.1.8](/review/ui/#node=claim.site.mockups-variants) Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers · [proposed](/review/ui/#node=claim.app.devices) Devices page: add and remove passkeys, regenerate the recovery code · [proposed](/review/ui/#node=claim.admin.setup-checklist) Setup checklist: every per-project resource as a row, with Fix where fixable client-side · [proposed](/review/ui/#node=claim.tests.probe-pages) Browser probe pages: webauthn-prf, crypto, config, auth, storage, keyring-roundtrip, offline, leak-check, matrix

The screens the brief describes, built as a prototype before the app exists: each one works on invented data this browser keeps, in a mini browser frame, in one of three UX variants to compare; the same screen as ASCII art so an agent can read it; and the intent nodes in [the review graph](/review/ui/) that each screen realises. Beside every frame a column says what the screen is, draws the paths to it and from it, and charts what you have done. Every value is invented; every screen is proposed. [**Open the whole prototype**](/mockups/prototype.md).

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

## The three UX variants, for A/B testing

- **A · Desk.** The password manager's shape the brief draws: header, sidebar, list, forms. Mouse first.
- **B · Focus.** One card per screen, big targets, a bottom bar of tabs. Phone first.
- **C · Command.** A command bar, a dense table, an inspector. Keyboard first.

Pick one in any frame's bar; it holds across every mockup. The column's vote (works, does not work) is kept with the prototype's data and filed into your reader's log, so it reaches the build agent with the rest of your feedback.

## What a mockup is here

- **Interactive, and honest about it.** Two web components (`proto-app`, `proto-column`) on a store in `localStorage`; no form submits anywhere, no inline style, no script from any other origin. The prototype routes by the app's own rules (no login, sign in; no keyring, first run; locked, unlock) and stores nothing the real app would.
- **Honest.** The header on every screen carries the environment badge and the lock state the brief requires; the values are obviously invented and no real identifier appears.
- **Traceable.** Each screen names the brief section it draws and links the stories, rules and flows it realises in the review navigator, so a reader can check the picture against the intent.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/)*
