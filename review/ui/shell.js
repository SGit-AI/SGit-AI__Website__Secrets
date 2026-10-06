// ── shell.js — what the shell does and nothing else: show the version, name the set ──
//
// The shell holds the layout; the components do the work. This script fills
// the version badge from admin/build/version.txt and the set label from the
// store, so the top bar says what the vault guidance asks of every app.

import { ReviewBase, REVIEW_EVENTS, CODE_LAYERS } from './components/review-base/review-base.js'
import { LOCAL_STORAGE_KEYS }          from '../../app/config/storage-keys.js'

const SET_LABELS = Object.freeze({ project : 'the project', self : 'the tool (review/self/)' })

async function showVersion() {
    const badge = document.querySelector('[data-version]')
    if (!badge) return
    try {
        const response = await fetch('/admin/build/version.txt', { cache : 'no-cache' })
        const version  = (await response.text()).trim()
        badge.textContent = `v${version}`
        badge.dataset.version = version
    } catch (error) {
        badge.textContent = 'v?'
    }
}

function showSet(name) {
    const label = document.querySelector('[data-set-label]')
    if (label) label.textContent = SET_LABELS[name] || name
}

function readPrefs() {
    try { return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.review) || '{}') } catch (error) { return {} }
}

function writePrefs(prefs) {
    try { localStorage.setItem(LOCAL_STORAGE_KEYS.review, JSON.stringify(prefs)) } catch (error) { /* not kept */ }
}

function fold(name, folded) {                                                   // a column folds away to give the rest the room; remembered in this browser
    const main = document.querySelector('.layout')
    main.classList.toggle(`fold-${name}`, folded)
    const button = document.querySelector(`[data-fold="${name}"]`)
    if (button) button.setAttribute('aria-pressed', folded ? 'true' : 'false')
    const prefs = readPrefs()
    prefs[`fold-${name}`] = folded
    writePrefs(prefs)
}

let shown = 'node'                                                              // the region of the right column in view

function showMode(mode) {                                                       // intent: ladder, tree, node; code: tree (code), source in the middle, the code panel on the right
    const main = document.querySelector('.layout')
    main.dataset.mode = mode
    for (const button of document.querySelectorAll('[data-mode]')) if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', button.dataset.mode === mode ? 'true' : 'false')
    showRegion(shown)
}

function showRegion(name) {                                                    // one of node, brief, file, code in the right column; the navigator is never left
    const code = ReviewBase.store.mode === 'code'
    if (code && name === 'file') name = 'code'                                   // in code mode the source always has the middle; the right side reads it
    shown = name
    for (const region of document.querySelectorAll('[data-region]')) region.hidden = code && region.dataset.region === 'file' ? false : region.dataset.region !== name
}

document.addEventListener(REVIEW_EVENTS.set,     (event) => showSet(event.detail.set))
document.addEventListener(REVIEW_EVENTS.select,  (event) => showRegion(CODE_LAYERS.includes(event.detail.node.layer) ? 'code' : 'node'))
document.addEventListener(REVIEW_EVENTS.route,   (event) => showRegion(event.detail.view === 'brief' ? 'brief' : event.detail.view === 'code' ? 'code' : 'node'))
document.addEventListener(REVIEW_EVENTS.section, () => showRegion('brief'))
document.addEventListener(REVIEW_EVENTS.file,    () => showRegion('file'))
document.addEventListener(REVIEW_EVENTS.mode,    (event) => showMode(event.detail.mode))
document.querySelector('[data-modes]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]')
    if (!button) return
    if (button.dataset.mode === 'code') ReviewBase.store.show('code')
    else ReviewBase.store.show('stories')
})
document.querySelector('[data-fold="left"]').addEventListener('click', (event) => fold('left', event.currentTarget.getAttribute('aria-pressed') !== 'true'))
if (readPrefs()['fold-left']) fold('left', true)
showMode(ReviewBase.store.mode)
showVersion()
showSet(ReviewBase.store.set)
