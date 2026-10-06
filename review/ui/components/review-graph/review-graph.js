/**
 * review-graph — the native graph view: the node in focus and its neighbours
 * (parent, children, edges in and out) drawn as an SVG graph, laid out by a
 * small force simulation written here, no library. Two ways to use it: with no
 * `nodes` attribute it follows the selection in the navigator; with
 * `nodes="id,id"` it draws those nodes and their neighbourhood, which is how a
 * page's reader's column shows the intent the page realises. `depth` (default
 * 1) is how many hops out. A click on a node selects it, so the graph is a way
 * to walk, not a picture. Colours are the layer tokens from tokens.css.
 *
 * @module review-graph
 * @version 0.1.0
 */
import { ReviewBase, REVIEW_EVENTS, LAYERS } from '../review-base/review-base.js'

const SVG_NS    = 'http://www.w3.org/2000/svg'
const WIDTH     = 640
const HEIGHT    = 420
const MAX_NODES = 60
const TICKS     = 220
const LABEL_MAX = 30

export class ReviewGraph extends ReviewBase {
    static jsUrl = import.meta.url

    static get observedAttributes() { return ['nodes', 'depth'] }

    get resourceName() { return 'review-graph' }

    attributeChangedCallback() { if (this._ready) this.render() }

    onReady() {
        this.$('[data-svg]').addEventListener('click', (event) => {
            const group = event.target.closest('[data-node]')
            if (group) ReviewBase.store.select(group.dataset.node)
        })
        this.on(REVIEW_EVENTS.loaded, () => this.render())
        this.on(REVIEW_EVENTS.select, () => this.render())
        this.on(REVIEW_EVENTS.route,  () => this.render())
        if (ReviewBase.store.loaded) this.render()
    }

    focus() {                                                                     // the ids in focus: the attribute, else the selection, else the stories
        const store = ReviewBase.store
        const given = (this.getAttribute('nodes') || '').split(',').map(s => s.trim()).filter(id => id && store.get(id))
        if (given.length) return given
        if (store.route.node && store.get(store.route.node)) return [store.route.node]
        return store.roots('stories').slice(0, 8).map(n => n.id)
    }

    neighbourhood(ids, depth) {                                                    // breadth first over parent, children and edges, capped
        const store  = ReviewBase.store
        const seen   = new Map(ids.map(id => [id, 0]))
        const queue  = [...ids]
        const links  = []
        const addLink = (from, to, verb, kind) => links.push({ from, to, verb, kind })
        while (queue.length && seen.size < MAX_NODES) {
            const id   = queue.shift()
            const hops = seen.get(id)
            const node = store.get(id)
            if (!node) continue
            const next = []
            if (node.parent && store.get(node.parent)) { next.push(node.parent); addLink(node.parent, id, 'contains', 'tree') }
            for (const child of node.children) { next.push(child); addLink(id, child, 'contains', 'tree') }
            for (const edge of store.edgesOf(id)) {
                const other = edge.direction === 'out' ? edge.to : edge.from
                if (!store.get(other)) continue
                next.push(other)
                if (edge.direction === 'out') addLink(id, other, edge.verb, 'edge')
                else addLink(other, id, store.inverse(edge.verb), 'edge')
            }
            if (hops >= depth) continue
            for (const other of next) if (!seen.has(other) && seen.size < MAX_NODES) { seen.set(other, hops + 1); queue.push(other) }
        }
        const unique = new Map()
        for (const link of links) {
            if (!seen.has(link.from) || !seen.has(link.to)) continue
            unique.set(`${link.from}>${link.to}>${link.verb}`, link)
        }
        return { ids : [...seen.keys()], hops : seen, links : [...unique.values()] }
    }

    layout(ids, links) {                                                          // a small force layout: repulsion, springs on links, a pull to the centre
        const index = new Map(ids.map((id, i) => [id, i]))
        const n     = ids.length
        const pos   = ids.map((id, i) => {
            const angle = (i / Math.max(n, 1)) * Math.PI * 2
            const rank  = LAYERS[ReviewBase.store.get(id).layer].rank
            const r     = 60 + rank * 12
            return { x : WIDTH / 2 + Math.cos(angle) * r, y : HEIGHT / 2 + Math.sin(angle) * r, vx : 0, vy : 0 }
        })
        const springs = links.map(l => [index.get(l.from), index.get(l.to)])
        const rest    = n > 30 ? 70 : 95
        for (let tick = 0; tick < TICKS; tick++) {
            const cool = 1 - tick / TICKS
            for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
                const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y
                const d2 = Math.max(dx * dx + dy * dy, 25)
                const f  = 2600 / d2
                const fx = f * dx / Math.sqrt(d2), fy = f * dy / Math.sqrt(d2)
                pos[i].vx -= fx; pos[i].vy -= fy; pos[j].vx += fx; pos[j].vy += fy
            }
            for (const [a, b] of springs) {
                const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y
                const d  = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
                const f  = (d - rest) * 0.04
                const fx = f * dx / d, fy = f * dy / d
                pos[a].vx += fx; pos[a].vy += fy; pos[b].vx -= fx; pos[b].vy -= fy
            }
            for (const p of pos) {
                p.vx += (WIDTH / 2 - p.x) * 0.01
                p.vy += (HEIGHT / 2 - p.y) * 0.01
                p.x  += p.vx * 0.12 * cool
                p.y  += p.vy * 0.12 * cool
                p.vx *= 0.6; p.vy *= 0.6
            }
        }
        const xs = pos.map(p => p.x), ys = pos.map(p => p.y)
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
        const pad  = 40
        const sx   = (WIDTH - 2 * pad) / Math.max(maxX - minX, 1), sy = (HEIGHT - 2 * pad) / Math.max(maxY - minY, 1)
        const s    = Math.min(sx, sy, 1.6)
        const ox   = (WIDTH - (maxX - minX) * s) / 2, oy = (HEIGHT - (maxY - minY) * s) / 2
        return new Map(ids.map((id, i) => [id, { x : ox + (pos[i].x - minX) * s, y : oy + (pos[i].y - minY) * s }]))
    }

    svg(tag, attrs = {}, text = null) {
        const node = document.createElementNS(SVG_NS, tag)
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
        if (text !== null) node.textContent = text
        return node
    }

    render() {
        const store = ReviewBase.store
        const svg   = this.$('[data-svg]')
        const cap   = this.$('[data-caption]')
        svg.replaceChildren()
        if (!store.loaded) { cap.textContent = 'Loading the graph…'; return }
        const focus = this.focus()
        if (!focus.length) { cap.textContent = 'Nothing to draw yet.'; return }
        const depth   = Math.max(1, parseInt(this.getAttribute('depth') || '1', 10) || 1)
        const { ids, hops, links } = this.neighbourhood(focus, depth)
        const place   = this.layout(ids, links)
        const edges   = this.svg('g', { class : 'edges' })
        for (const link of links) {
            const a = place.get(link.from), b = place.get(link.to)
            const line = this.svg('line', { x1 : a.x, y1 : a.y, x2 : b.x, y2 : b.y, class : `link link-${link.kind}` })
            line.appendChild(this.svg('title', {}, `${store.get(link.from).name} ${link.verb} ${store.get(link.to).name}`))
            edges.appendChild(line)
        }
        svg.appendChild(edges)
        const nodes = this.svg('g', { class : 'nodes' })
        for (const id of ids) {
            const node  = store.get(id)
            const p     = place.get(id)
            const inFocus = focus.includes(id)
            const group = this.svg('g', { class : `node layer-${node.layer}${inFocus ? ' focus' : ''}${node.record && node.record.proposed ? ' proposed' : ''}`, transform : `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`, tabindex : '0', role : 'button' })
            group.dataset.node = id
            group.appendChild(this.svg('title', {}, `${LAYERS[node.layer].label}: ${node.name}`))
            group.appendChild(this.svg('circle', { r : inFocus ? 11 : 7 - Math.min(hops.get(id), 2) }))
            const label = node.name.length > LABEL_MAX ? node.name.slice(0, LABEL_MAX - 1) + '…' : node.name
            group.appendChild(this.svg('text', { x : inFocus ? 15 : 11, y : 4, class : 'label' }, label))
            nodes.appendChild(group)
        }
        svg.appendChild(nodes)
        const layers = [...new Set(ids.map(id => LAYERS[store.get(id).layer].group))]
        cap.replaceChildren()
        cap.appendChild(document.createTextNode(`${ids.length} node${ids.length === 1 ? '' : 's'}, ${links.length} link${links.length === 1 ? '' : 's'}, ${depth} hop${depth === 1 ? '' : 's'} from ${focus.length === 1 ? store.get(focus[0]).name : focus.length + ' nodes'}. `))
        for (const group of layers) cap.appendChild(this.el('span', { class : `key key-${group}` }, group))
    }
}

customElements.define('review-graph', ReviewGraph)
