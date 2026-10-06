// ── storage-keys.js — the only keys the app may write to browser storage ──────
//
// The gate (admin/build/validate.js, check 8) reads this file and fails the
// build when any localStorage.setItem or sessionStorage.setItem call under
// app/, components/, admin/ or tests/ uses a key that is not listed here, or
// uses a key that is not a literal. Nothing derived from a key, a PRF output,
// a KEK, a token or a decrypted body is ever stored: these keys hold UI
// conveniences and the chosen environment configuration, all public values.
// Update here only; do not duplicate locally.

export const LOCAL_STORAGE_KEYS = Object.freeze({
    config  : 'sgit.secrets.config.v1',                                           // the active environment configuration (section 5 of the brief)
    theme   : 'sgit.secrets.ui.theme',                                            // the picked theme, one id from data/themes.json (assets/theme.js)
    lastEnv : 'sgit.secrets.ui.lastEnv',                                          // the last built-in environment picked, for the badge
})

export const SESSION_STORAGE_KEYS = Object.freeze({
    adminOauthState : 'sgit.secrets.admin.oauthState',                            // the random OAuth state for the admin redirect; never the token
})
