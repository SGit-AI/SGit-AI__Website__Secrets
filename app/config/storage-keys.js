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
    reader  : 'sgit.secrets.ui.reader',                                           // the reader's column: open or closed, which tab
    readerLog : 'sgit.secrets.reader.log.v1',                                     // the reader's log: append-only events (read, star, vote, note) keyed by page and content hash; opinions about public pages, never a secret
})

export const SESSION_STORAGE_KEYS = Object.freeze({
    adminOauthState : 'sgit.secrets.admin.oauthState',                            // the random OAuth state for the admin redirect; never the token
    openrouterKey   : 'sgit.secrets.ui.openrouterKey',                            // the reader's own OpenRouter key, only when they tick 'keep for this tab'; this tab, this session, never localStorage
})
