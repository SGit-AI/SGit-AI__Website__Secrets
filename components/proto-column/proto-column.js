/**
 * proto-column — the column beside the prototype: what the current screen is
 * (its path, its purpose, the section of the brief, the intent nodes it
 * realises, how often you have been here), the paths to it and from it as a
 * small graph you can click, the data the prototype kept in this browser as
 * charts (entries by kind, screens visited, actions over the last hour) and
 * as the log, the A/B/C vote on the UX variants, and the state as JSON with
 * Seed, Reset and Copy. Charts are plain SVG: thin bars, direct labels in
 * text tokens, a title on every mark, the categorical colours of the theme.
 *
 * @module proto-column
 * @version 0.1.0
 */
import { ProtoBase, PROTO_EVENTS, KINDS } from '../proto-base/proto-base.js'

const W        = 360
const BAR      = 14
const GAP      = 4
const LABEL_W  = 112
const BUCKETS  = 12                                                               // five-minute buckets over the last hour

export class ProtoColumn extends ProtoBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'proto-column' }

    async onReady() {
        const store = ProtoBase.store
        await store.ready
        this.$('[data-paths]').addEventListener('click', (event) => { const g = event.target.closest('[data-screen]'); if (g) store.go(g.dataset.screen, 'column') })
        this.$('[data-votes]').addEventListener('click', (event) => { const b = event.target.closest('[data-vote]'); if (b) store.vote(b.dataset.variant, b.dataset.vote === 'up') })
        this.$('[data-seed]').addEventListener('click',  () => store.seed())
        this.$('[data-reset]').addEventListener('click', () => { store.reset(); store.go(store.screen || 'sign-in', 'reset') })
        this.$('[data-copy]').addEventListener('click',  () => this.copyJson())
        this.on(PROTO_EVENTS.screen,  () => this.render())
        this.on(PROTO_EVENTS.state,   () => this.render())
        this.on(PROTO_EVENTS.variant, () => this.render())
        this.render()
    }

    render() {
        const store  = ProtoBase.store
        const screen = store.byId(store.screen)
        if (!screen) return
        this.details(screen)
        this.paths(screen)
        this.kinds()
        this.visits()
        this.actions()
        this.log()
        this.votes()
        this.$('[data-json]').textContent = JSON.stringify(store.state, null, 1)
    }

    details(screen) {
        const s = ProtoBase.store.state
        this.$('[data-title]').textContent   = `${screen.n}. ${screen.title}`
        this.$('[data-path]').textContent    = `secrets.sgit.ai${screen.path}`
        this.$('[data-purpose]').textContent = screen.purpose
        this.$('[data-meta]').textContent    = `Section ${screen.section} of the brief · visited ${s.visits[screen.id] || 0} time${(s.visits[screen.id] || 0) === 1 ? '' : 's'} · the app would go to ${ProtoBase.store.next()} from this state`
        const intent = this.$('[data-intent]')
        intent.replaceChildren(document.createTextNode('Intent: '))
        screen.intent.forEach((id, i) => {
            if (i) intent.appendChild(document.createTextNode(' · '))
            intent.appendChild(this.el('a', { href : `/review/ui/#node=${encodeURIComponent(id)}` }, id))
        })
        const page = this.$('[data-page]')
        page.replaceChildren(this.el('a', { href : screen.page }, 'this screen\'s page'), document.createTextNode(' · '), this.el('a', { href : '/mockups/prototype.html' }, 'the whole prototype'))
    }

    paths(screen) {                                                               // three columns: where you come from, here, where you go
        const store = ProtoBase.store
        const into  = store.pathsTo(screen.id).filter(e => e.from !== screen.id)
        const outOf = store.pathsFrom(screen.id).filter(e => e.to !== screen.id)
        const rows  = Math.max(into.length, outOf.length, 1)
        const h     = 24 + rows * 34
        const svg   = this.$('[data-paths]')
        svg.setAttribute('viewBox', `0 0 ${W} ${h}`)
        svg.replaceChildren()
        const defs  = this.svg('defs')
        const mark  = this.svg('marker', { id : 'arrow', viewBox : '0 0 10 10', refX : '9', refY : '5', markerWidth : '6', markerHeight : '6', orient : 'auto-start-reverse' })
        mark.appendChild(this.svg('path', { d : 'M 0 0 L 10 5 L 0 10 z', class : 'arrow' }))
        defs.appendChild(mark)
        svg.appendChild(defs)
        const node = (id, x, y, current = false) => {
            const target = store.byId(id)
            const g = this.svg('g', { class : `pnode${current ? ' current' : ''}`, transform : `translate(${x} ${y})`, tabindex : current ? '-1' : '0', role : current ? 'img' : 'button' })
            g.dataset.screen = id
            g.appendChild(this.svg('title', {}, target ? `${target.n}. ${target.title}` : id))
            g.appendChild(this.svg('rect', { x : -52, y : -12, width : 104, height : 24, rx : 6 }))
            g.appendChild(this.svg('text', { x : 0, y : 4, 'text-anchor' : 'middle', class : 'plabel' }, (target ? target.title : id).replace(/:.*$/, '').slice(0, 18)))
            return g
        }
        const cy = 12 + (rows * 34) / 2
        into.forEach((edge, i) => {
            const y = 12 + 17 + i * 34
            const line = this.svg('line', { x1 : 112, y1 : y, x2 : 126, y2 : cy, class : 'pedge', 'marker-end' : 'url(#arrow)' })
            line.appendChild(this.svg('title', {}, edge.label))
            svg.appendChild(line)
            svg.appendChild(node(edge.from, 60, y))
        })
        outOf.forEach((edge, i) => {
            const y = 12 + 17 + i * 34
            const line = this.svg('line', { x1 : 234, y1 : cy, x2 : 246, y2 : y, class : 'pedge', 'marker-end' : 'url(#arrow)' })
            line.appendChild(this.svg('title', {}, edge.label))
            svg.appendChild(line)
            svg.appendChild(node(edge.to, 300, y))
        })
        svg.appendChild(node(screen.id, 180, cy, true))
        const caption = this.$('[data-paths-caption]')
        caption.textContent = `${into.length} way${into.length === 1 ? '' : 's'} in, ${outOf.length} way${outOf.length === 1 ? '' : 's'} out. Hover an arrow for the reason; click a screen to go there.`
    }

    bars(svg, rows, cls = 'bar', unit = '') {                                     // horizontal bars with a direct label in text tokens and a title on every mark
        svg.replaceChildren()
        const max = Math.max(1, ...rows.map(r => r.value))
        const h   = rows.length * (BAR + GAP) + GAP
        svg.setAttribute('viewBox', `0 0 ${W} ${h}`)
        rows.forEach((row, i) => {
            const y = GAP + i * (BAR + GAP)
            const w = Math.max(2, Math.round((W - LABEL_W - 36) * row.value / max))
            svg.appendChild(this.svg('text', { x : LABEL_W - 6, y : y + BAR - 3, 'text-anchor' : 'end', class : 'blabel' }, row.label))
            const bar = this.svg('rect', { x : LABEL_W, y, width : row.value ? w : 2, height : BAR, rx : 3, class : `${cls} ${row.cls || ''}` })
            bar.appendChild(this.svg('title', {}, `${row.label}: ${row.value}${unit}`))
            svg.appendChild(bar)
            svg.appendChild(this.svg('text', { x : LABEL_W + (row.value ? w : 2) + 5, y : y + BAR - 3, class : 'bvalue' }, String(row.value)))
        })
    }

    kinds() {
        const counts = ProtoBase.store.byKind()
        this.bars(this.$('[data-kinds]'), KINDS.map(k => ({ label : k, value : counts[k], cls : `kind-${k}` })), 'bar')
    }

    visits() {
        const store = ProtoBase.store
        this.bars(this.$('[data-visits]'), store.screens.map(s => ({ label : s.title.replace(/:.*$/, '').slice(0, 16), value : store.state.visits[s.id] || 0 })), 'bar accent')
    }

    actions() {                                                                   // one bar per five minutes, the last hour, actions that are not navigation
        const store   = ProtoBase.store
        const svg     = this.$('[data-actions]')
        const nowMs   = Date.now()
        const buckets = Array.from({ length : BUCKETS }, () => 0)
        let total     = 0
        for (const event of store.state.log) {
            if (event.action === 'go') continue
            const age = nowMs - new Date(event.t).getTime()
            if (age < 0 || age > 3600000) continue
            buckets[BUCKETS - 1 - Math.min(BUCKETS - 1, Math.floor(age / 300000))]++
            total++
        }
        svg.replaceChildren()
        const h = 56, max = Math.max(1, ...buckets), bw = Math.floor((W - 10) / BUCKETS)
        svg.setAttribute('viewBox', `0 0 ${W} ${h}`)
        svg.appendChild(this.svg('line', { x1 : 4, y1 : h - 14, x2 : W - 4, y2 : h - 14, class : 'axis' }))
        buckets.forEach((count, i) => {
            const bh  = count ? Math.max(3, Math.round((h - 24) * count / max)) : 0
            const bar = this.svg('rect', { x : 5 + i * bw, y : h - 14 - bh, width : bw - 2, height : bh, rx : 2, class : 'bar accent' })
            bar.appendChild(this.svg('title', {}, `${count} action${count === 1 ? '' : 's'}, ${60 - i * 5} to ${55 - i * 5} minutes ago`))
            svg.appendChild(bar)
        })
        svg.appendChild(this.svg('text', { x : 5, y : h - 2, class : 'blabel' }, '60 min ago'))
        svg.appendChild(this.svg('text', { x : W - 5, y : h - 2, 'text-anchor' : 'end', class : 'blabel' }, 'now'))
        this.$('[data-actions-caption]').textContent = `${total} action${total === 1 ? '' : 's'} in the last hour, ${store.state.log.length} kept in all.`
    }

    log() {
        const ol = this.$('[data-log]')
        ol.replaceChildren()
        const events = ProtoBase.store.state.log.slice(-10).reverse()
        if (!events.length) { ol.appendChild(this.el('li', { class : 'empty' }, 'nothing yet: click something in the frame')); return }
        for (const event of events) {
            const li = this.el('li', {})
            li.appendChild(this.el('time', { datetime : event.t }, event.t.slice(11, 19)))
            li.appendChild(this.el('span', { class : 'action' }, event.action))
            const detail = Object.entries(event.detail || {}).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('+') : v}`).join(' ')
            if (detail) li.appendChild(this.el('span', { class : 'detail' }, detail.slice(0, 60)))
            ol.appendChild(li)
        }
    }

    votes() {
        const store = ProtoBase.store
        const box   = this.$('[data-votes]')
        box.replaceChildren()
        for (const variant of store.variants) {
            const tally = store.state.votes[variant.id] || { up : 0, down : 0 }
            const total = tally.up + tally.down
            const row   = this.el('div', { class : `vote-row${variant.id === store.variant ? ' here' : ''}` })
            row.appendChild(this.el('span', { class : 'vname' }, `${variant.tag} ${variant.name}`))
            const meter = this.el('span', { class : 'meter', title : `${tally.up} up, ${tally.down} down` })
            meter.appendChild(this.el('span', { class : `up share-${total ? Math.round(10 * tally.up / total) : 0}` }, total ? `${tally.up}` : ''))   // deciles, so the width is a class and never an inline style
            meter.appendChild(this.el('span', { class : 'down' }, total ? `${tally.down}` : ''))
            row.appendChild(meter)
            row.appendChild(this.el('button', { type : 'button', class : 'vbtn', 'data-vote' : 'up', 'data-variant' : variant.id, title : `${variant.name} works for me` }, '▲'))
            row.appendChild(this.el('button', { type : 'button', class : 'vbtn', 'data-vote' : 'down', 'data-variant' : variant.id, title : `${variant.name} does not work for me` }, '▼'))
            box.appendChild(row)
        }
        box.appendChild(this.el('p', { class : 'hint' }, 'A vote is also a note in your reader\'s log, so Send to the agent or Copy for Claude carries it.'))
    }

    async copyJson() {
        try { await navigator.clipboard.writeText(JSON.stringify(ProtoBase.store.state, null, 1)); this.$('[data-copied]').textContent = 'copied' } catch (error) { this.$('[data-copied]').textContent = 'the clipboard is not available here' }
    }
}

customElements.define('proto-column', ProtoColumn)
