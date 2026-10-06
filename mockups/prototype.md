# The prototype

> The whole design prototype in one frame: every screen the brief describes, working on invented data this browser keeps, in three UX variants to compare. Beside it, what the screen is, the paths to it and from it, and what you have done.

*Source: <https://secrets.sgit.ai/mockups/prototype.html> · site v0.1.12 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.5](/review/ui/#node=claim.site.mockups) Design mockups: the ten screens as an interactive prototype on invented data kept in this browser, in a mini browser frame, with the ASCII twin and the intent each realises · [shipped v0.1.8](/review/ui/#node=claim.site.mockups-variants) Three UX variants of the prototype to compare (A Desk, B Focus, C Command), the column beside each frame (what the screen is, the paths to and from it as a graph, the data as charts), and an A/B/C vote filed into the reader's log · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.app.prf-unlock) Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · [proposed](/review/ui/#node=claim.app.entries) Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

Start where the app would start you and click through: sign in, create the keyring, write the recovery code down, add entries, open one, reveal it, lock, unlock, add a device, change the environment. Everything is invented and everything is kept in this browser only (`localStorage`, `sgit.secrets.proto.v1`); **Seed** fills it, **Reset** empties it. The three buttons in the frame's bar switch the UX: the same screens, three different shapes, so you can say which works (the column's A/B/C vote lands in your reader's log).

## The three UX variants

- **A · Desk.** The password manager's shape the brief draws: a header with the environment and the lock, a sidebar with search and the kinds, a list, forms in cards. Mouse first, every control visible.
- **B · Focus.** One thing per screen: a single card in the middle with a title and big targets, a bottom bar of four tabs, the step shown as "4 of 10". Phone first; the sidebar's filters fold into the card.
- **C · Command.** Keyboard first: a command bar at the top (`add password github`, `open 2`, `lock`, `env dev`, `?`), a dense numbered table, an inspector on the right with the state, a status line at the bottom. For people who live in terminals.

Each of [the ten mockups](/mockups/index.md) embeds the same prototype opened on its screen, with the ASCII twin and the intent beside it. What the prototype does on its own rules: no login, it routes to sign in; no keyring, to the first run; locked, to unlock; changing the environment signs out. The real app will do the same with real sign-in, a real passkey and a real bucket, and will store none of what this stores.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/prototype.html)*
