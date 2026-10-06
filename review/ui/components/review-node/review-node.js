/**
 * review-node — one node: name, layer, the section of the brief it came from
 * (linked into the rendered brief), its text and properties, its parent and
 * children, and its edges in and out read as sentences. Every link selects
 * another node, which is how walking up and down works from the right panel.
 *
 * @module review-node
 * @version 0.1.0
 */
import { ReviewBase, REVIEW_EVENTS, LAYERS } from '../review-base/review-base.js'

const PROPERTY_KEYS = Object.freeze({
    story       : ['as_a', 'i_want', 'so_that'],
    rule        : ['text'],
    example     : ['text', 'surface'],
    flow        : ['actor'],
    step        : ['text', 'surface', 'actor'],
    component   : ['kind', 'runs_in', 'trust', 'honest_depth', 'provides'],
    environment : ['project_id', 'purpose', 'status'],
    resource    : ['kind', 'environment'],
    pipeline    : ['file'],
    job         : ['when', 'does', 'on_failure'],
})

export class ReviewNode extends ReviewBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'review-node' }

    onReady() {
        this.shadowRoot.addEventListener('click', (event) => {
            const link = event.target.closest('[data-node]')
            if (link) { event.preventDefault(); ReviewBase.store.select(link.dataset.node) }
        })
        this.on(REVIEW_EVENTS.select, (event) => this.render(event.detail.node))
        this.on(REVIEW_EVENTS.route,  () => this.render(null))
        const current = ReviewBase.store.route.node
        this.render(current ? ReviewBase.store.get(current) : null)
    }

    render(node) {
        const panel = this.$('[data-panel]')
        panel.replaceChildren()
        if (!node) {
            panel.appendChild(this.el('p', { class : 'empty' }, 'Pick a node in the tree. This panel shows what it is, where in the brief it came from, and what it is connected to.'))
            return
        }
        const store = ReviewBase.store
        const head  = this.el('header', { class : `head layer-${node.layer}` })
        head.appendChild(this.el('span', { class : 'layer' }, LAYERS[node.layer].label))
        head.appendChild(this.el('h2', { class : 'name' }, node.name))
        if (node.record && node.record.proposed) head.appendChild(this.el('span', { class : 'proposed' }, `proposed by ${node.record.proposed.model}, ${node.record.proposed.date}; not yet accepted`))
        panel.appendChild(head)

        const source = store.sectionLink(node.source)
        if (source) {
            const p = this.el('p', { class : 'source' }, 'From the brief, ')
            p.appendChild(this.el('a', { href : source.href, target : '_top' }, source.title))
            if (node.source.quote) p.appendChild(this.el('q', {}, node.source.quote))
            panel.appendChild(p)
        } else if (node.source && node.source.path) {
            panel.appendChild(this.el('p', { class : 'source' }, `${node.source.path}:${node.source.line}-${node.source.end}`))
        }

        const dl = this.el('dl', { class : 'properties' })
        for (const key of PROPERTY_KEYS[node.layer] || []) {
            const value = node.record[key]
            if (value === undefined || value === null || value === '') continue
            dl.appendChild(this.el('dt', {}, key.replace(/_/g, ' ')))
            dl.appendChild(this.el('dd', {}, Array.isArray(value) ? value.join(', ') : String(value)))
        }
        dl.appendChild(this.el('dt', {}, 'id'))
        dl.appendChild(this.el('dd', { class : 'mono' }, node.id))
        panel.appendChild(dl)

        if (node.parent) {
            const parent = store.get(node.parent)
            const p = this.el('p', { class : 'parent' }, 'Up: ')
            p.appendChild(this.el('a', { href : '#', 'data-node' : parent.id }, `${LAYERS[parent.layer].label} ${parent.name}`))
            panel.appendChild(p)
        }
        if (node.children.length) {
            panel.appendChild(this.el('h3', {}, `Down (${node.children.length})`))
            const ul = this.el('ul', { class : 'links' })
            for (const id of node.children) {
                const child = store.get(id)
                const li = this.el('li')
                li.appendChild(this.el('a', { href : '#', 'data-node' : id, class : `layer-${child.layer}` }, `${LAYERS[child.layer].label}: ${child.name}`))
                ul.appendChild(li)
            }
            panel.appendChild(ul)
        }
        const edges = store.edgesOf(node.id)
        if (edges.length) {
            panel.appendChild(this.el('h3', {}, `Edges (${edges.length})`))
            const ul = this.el('ul', { class : 'links' })
            for (const edge of edges) {
                const otherId = edge.direction === 'out' ? edge.to : edge.from
                const other   = store.get(otherId)
                const li      = this.el('li', { title : store.sentence(edge.verb) })
                li.appendChild(this.el('span', { class : 'verb' }, edge.verb.replace(/_/g, ' ')))
                li.appendChild(document.createTextNode(' '))
                li.appendChild(other ? this.el('a', { href : '#', 'data-node' : otherId, class : `layer-${other.layer}` }, other.name) : this.el('span', {}, otherId))
                ul.appendChild(li)
            }
            panel.appendChild(ul)
        }
    }
}

customElements.define('review-node', ReviewNode)
