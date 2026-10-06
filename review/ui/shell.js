// ── shell.js — what the shell does and nothing else: show the version, name the set ──
//
// The shell holds the layout; the components do the work. This script fills
// the version badge from admin/build/version.txt and the set label from the
// store, so the top bar says what the vault guidance asks of every app.

import { ReviewBase, REVIEW_EVENTS } from './components/review-base/review-base.js'

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

document.addEventListener(REVIEW_EVENTS.set, (event) => showSet(event.detail.set))
showVersion()
showSet(ReviewBase.store.set)
