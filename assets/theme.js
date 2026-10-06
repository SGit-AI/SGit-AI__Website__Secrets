// ── theme.js — four themes, one attribute, one storage key ───────────────────
//
// Sets html[data-theme] before the first paint, so there is no flash: this
// script is loaded in <head> without defer, before the stylesheets, and does
// nothing slow. The value comes from localStorage under the one key the app
// may use for it (LOCAL_STORAGE_KEYS.theme in app/config/storage-keys.js; a
// classic script cannot import that module, so the literal is repeated here
// and the gate's check 8 confirms it is the allowed one), or, when nothing is
// stored, from the reader's prefers-color-scheme. Then it wires every element
// with data-theme-pick, in the nav and in the review navigator. The colours
// themselves are in assets/themes.css; this file never names one. Nothing
// here is secret and nothing here is derived from a key.

(function () {
    'use strict'
    const KEY      = 'sgit.secrets.ui.theme'
    const DEFAULTS = Object.freeze({ dark : 'night', light : 'day' })                      // data/themes.json: default and whenPreferringLight
    const VALID    = /^[a-z]+$/                                                              // an unknown name falls through to the :root block, which is Night
    const root     = document.documentElement

    function stored() {
        try { return window.localStorage.getItem(KEY) } catch (error) { return null }       // storage blocked or absent: the theme still applies for this page
    }
    function preferred() {
        const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        return light ? DEFAULTS.light : DEFAULTS.dark
    }
    function mark(name) {
        for (const button of document.querySelectorAll('[data-theme-pick]')) {
            button.setAttribute('aria-pressed', button.dataset.themePick === name ? 'true' : 'false')
        }
    }
    function apply(name) {
        if (!VALID.test(name)) name = DEFAULTS.dark
        root.dataset.theme = name
        mark(name)
    }
    function choose(name) {
        apply(name)
        try { window.localStorage.setItem('sgit.secrets.ui.theme', name) } catch (error) { /* not stored; see stored() */ }   // the literal, so check 8 can read it
    }

    apply(stored() || preferred())

    document.addEventListener('click', (event) => {
        const button = event.target.closest && event.target.closest('[data-theme-pick]')
        if (!button) return
        choose(button.dataset.themePick)
        const menu = button.closest('.ni-has.open')                                         // the phone menu stays; a touch-opened dropdown closes
        if (menu) menu.classList.remove('open')
        button.blur()
    })
    window.addEventListener('storage', (event) => {                                         // another tab chose: follow it
        if (event.key === KEY && event.newValue) apply(event.newValue)
    })
    document.addEventListener('DOMContentLoaded', () => mark(root.dataset.theme))
}())
