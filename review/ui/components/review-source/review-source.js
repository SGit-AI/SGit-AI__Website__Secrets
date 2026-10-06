/**
 * review-source — a file of the repository shown in place: the path, its
 * size and line count, the lines with numbers, a range marked when the route
 * names one (#file=<path>&lines=L12-L30), the claims that live in it (each a
 * way back up), and a link to the same file on GitHub at the newest release
 * commit for anyone who wants to leave. The site serves every file it
 * deploys, so the fetch is same-origin; a file the deploy leaves out (the
 * workflows, infra, the unit tests) shows the GitHub link only. Step 5 of the
 * review brief, pulled forward so a chain of evidence can end on code.
 *
 * @module review-source
 * @version 0.1.0
 */
import { ReviewBase, REVIEW_EVENTS } from '../review-base/review-base.js'

const REPO      = 'https://github.com/SGit-AI/SGit-AI__Website__Secrets'
const MAX_LINES = 4000

export class ReviewSource extends ReviewBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'review-source' }

    onReady() {
        this.shadowRoot.addEventListener('click', (event) => {
            const node = event.target.closest('[data-node]')
            if (node) { event.preventDefault(); ReviewBase.store.select(node.dataset.node) }
        })
        this.on(REVIEW_EVENTS.file,   (event) => this.render(event.detail.path, event.detail.lines))
        this.on(REVIEW_EVENTS.loaded, () => { const r = ReviewBase.store.route; if (r.file) this.render(r.file, r.lines) })
        const route = ReviewBase.store.route
        if (route.file) this.render(route.file, route.lines)
    }

    range(lines) {                                                                // 'L12-L30' -> [12, 30]; 'L12' -> [12, 12]
        const match = (lines || '').match(/^L(\d+)(?:-L(\d+))?$/)
        return match ? [parseInt(match[1], 10), parseInt(match[2] || match[1], 10)] : null
    }

    async render(path, lines) {
        const store = ReviewBase.store
        const panel = this.$('[data-panel]')
        panel.replaceChildren()
        const newest = store.loaded && store.loaded.claims ? (store.loaded.claims.releases[0] || {}) : {}
        const github = `${REPO}/blob/${newest.commit || 'dev'}/${path}${lines ? '#' + lines : ''}`
        const head   = this.el('header', { class : 'head' })
        head.appendChild(this.el('span', { class : 'layer' }, 'file'))
        head.appendChild(this.el('h2', { class : 'name' }, path))
        panel.appendChild(head)
        const meta = this.el('p', { class : 'meta' })
        meta.appendChild(this.el('a', { href : github, target : '_top', class : 'leave' }, `on GitHub at ${newest.tag || 'dev'}`))
        panel.appendChild(meta)
        const mine    = (id) => id === `anchor.file.${path}` || id === `anchor.test.${path}` || id.startsWith(`anchor.file.${path}@`) || id.startsWith(`anchor.test.${path}@`)
        const holders = [...new Set(store.edges.filter(e => (e.verb === 'lives_in' || e.verb === 'proven_by') && mine(e.to)).map(e => e.from))].map(id => store.get(id)).filter(Boolean)
        if (holders.length) {
            panel.appendChild(this.el('h3', {}, `Claims that live here (${holders.length})`))
            const ul = this.el('ul', { class : 'links' })
            for (const claim of holders) {
                const li = this.el('li')
                li.appendChild(this.el('a', { href : `#node=${encodeURIComponent(claim.id)}`, 'data-node' : claim.id }, claim.name))
                ul.appendChild(li)
            }
            panel.appendChild(ul)
        }
        let text
        try {
            const response = await fetch(`/${path}`, { cache : 'no-cache' })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            text = await response.text()
        } catch (error) {
            panel.appendChild(this.el('p', { class : 'empty' }, `The site does not serve this file (${error.message}); read it on GitHub with the link above.`))
            return
        }
        const all   = text.split('\n')
        const shown = all.slice(0, MAX_LINES)
        const mark  = this.range(lines)
        meta.insertBefore(document.createTextNode(`${all.length} lines · ${text.length} bytes${mark ? ` · lines ${mark[0]} to ${mark[1]} marked` : ''} · `), meta.firstChild)
        const pre = this.el('pre', { class : 'code' })
        const ol  = this.el('ol', { class : 'lines', start : '1' })
        shown.forEach((line, i) => {
            const n  = i + 1
            const li = this.el('li', { class : mark && n >= mark[0] && n <= mark[1] ? 'marked' : '', id : `L${n}` }, line === '' ? ' ' : line)
            ol.appendChild(li)
        })
        pre.appendChild(ol)
        panel.appendChild(pre)
        if (all.length > MAX_LINES) panel.appendChild(this.el('p', { class : 'empty' }, `${all.length - MAX_LINES} more lines on GitHub.`))
        if (mark) {
            const target = this.shadowRoot.getElementById(`L${mark[0]}`)
            if (target) target.scrollIntoView({ block : 'center' })
        }
    }
}

customElements.define('review-source', ReviewSource)
