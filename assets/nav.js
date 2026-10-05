// ── nav.js — the family nav interaction, as sgit.ai, nfrs.sgit.ai and pki.sgit.ai run it ──
//
// Two jobs, and only one of them needs JavaScript on a desktop: hover and
// :focus-within open a dropdown in CSS alone. This handles the rest: the phone
// menu button, and the fact that a finger has no hover. If this file never
// loads the nav still works, because every group label is a link to that
// section's own page. Served from this origin only (CSP script-src 'self').
// No storage, no network, no state beyond the open class.

(function () {
    'use strict'
    const nav = document.querySelector('nav.site')
    if (!nav) return
    const toggle = nav.querySelector('.nav-toggle')
    if (toggle) {
        toggle.addEventListener('click', () => {
            const open = nav.classList.toggle('open')
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
        })
    }
    // On a touch screen the dropdown has no hover to open it: the first tap on a
    // group label opens the menu, a second follows the link. Only where a dropdown
    // is actually drawn; in the collapsed phone menu the children are already visible.
    document.addEventListener('click', (event) => {
        const link = event.target.closest && event.target.closest('nav.site .ni-has > .nl')
        const open = nav.querySelector('.ni-has.open')
        if (open && (!link || link.parentNode !== open)) open.classList.remove('open')
        if (!link || !window.matchMedia || !window.matchMedia('(hover: none)').matches) return
        const item = link.parentNode
        const sub  = item.querySelector('.sub')
        if (sub && window.getComputedStyle(sub).position === 'absolute' && !item.classList.contains('open')) {
            event.preventDefault()
            item.classList.add('open')
        }
    })
    // Escape closes whatever is open, so keyboard users get out the same way everywhere.
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return
        const open = nav.querySelector('.ni-has.open')
        if (open) open.classList.remove('open')
        if (nav.classList.contains('open')) {
            nav.classList.remove('open')
            if (toggle) toggle.setAttribute('aria-expanded', 'false')
        }
    })
}())
