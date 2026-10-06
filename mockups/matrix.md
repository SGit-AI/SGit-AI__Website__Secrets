# Mockup 10: Tests: the compatibility matrix

> A design mockup of the tests: the compatibility matrix screen at secrets.sgit.ai/tests/matrix.html, as a static picture in a mini browser and as ASCII art, with the intent nodes it realises. The screen does not exist yet.

*Source: <https://secrets.sgit.ai/mockups/matrix.html> · site v0.1.7 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): shipped v0.1.5 Design mockups: ten screens as static pictures in a mini browser frame and as ASCII art, each linked to the intent it realises · proposed Sign in and out with Google and email/password against the chosen environment · proposed Passkey with WebAuthn PRF derives the keyring wrapping key; RP ID secrets.sgit.ai · proposed Entries: six kinds kept apart, vault list, entry page, copy and reveal, lock timers

What `secrets.sgit.ai/tests/matrix.html` is meant to look like, from section 6.4 of [the brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md). A static picture: nothing on it works, the values are invented, and the screen itself is proposed.

The probe pages run in sequence and the result is a shareable summary: browser, OS, authenticator, and one row per probe with PASS, FAIL or SKIP and the raw value behind it. A visitor pastes it into an issue; the dated rows become the support table on the keyring page.

https://**secrets.sgit.ai/tests/matrix.html**
secrets.sgit.aiprod
webauthn-prfcryptoconfigauthstoragematrix

## Compatibility matrix

Chrome 131 · macOS 15 · authenticator: Google Password Manager · 2026-10-06 · Copy as markdown

| Probe | Result | Raw |
|---|---|---|
| WebCrypto: HKDF, AES-GCM, RSA-OAEP, ECDSA | PASS | 4 of 4 known answers |
| Passkey create with prf | PASS | prf.enabled = true |
| PRF eval returns 32 bytes | PASS | 32 bytes; same salt twice equal; other salt differs |
| Config: active environment, fields, key restricted | PASS | prod from file default |
| Auth: sign in, claims, sign out | SKIP | not signed in |
| Storage: owner write, precondition, foreign 403 | SKIP | not signed in |
| Leak check: nothing key-like in storage | PASS | 0 suspicious keys |

## The same screen as ASCII

```
┌─ secrets.sgit.ai/tests/matrix.html ──────────────────────────────┐
│ secrets.sgit.ai [prod]  webauthn-prf crypto config auth matrix*  │
├──────────────────────────────────────────────────────────────────┤
│ Compatibility matrix     Chrome 131 · macOS 15 · GPM · 2026-10-06│
│ WebCrypto: HKDF, AES-GCM, RSA-OAEP, ECDSA   PASS   4 of 4 KATs   │
│ Passkey create with prf                     PASS   prf.enabled   │
│ PRF eval returns 32 bytes                   PASS   same/differs  │
│ Config: environment, fields, key restricted PASS   prod, file    │
│ Auth: sign in, claims, sign out             SKIP   not signed in │
│ Storage: owner write, foreign 403           SKIP   not signed in │
│ Leak check                                  PASS   0 suspicious  │
│ [ Copy as markdown ]                                             │
└──────────────────────────────────────────────────────────────────┘
```

## Intent it realises

Open each in the review navigator: [probes](/review/ui/#node=probes) · [probes.pages](/review/ui/#node=probes.pages).

[All mockups](/mockups/index.md)

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/mockups/matrix.html)*
