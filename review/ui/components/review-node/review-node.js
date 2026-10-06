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
    claim       : ['status', 'since', 'area', 'where', 'notes'],
    release     : ['version', 'date', 'notes'],
    anchor      : ['kind', 'ref', 'opens'],
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
            if (link) { event.preventDefault(); ReviewBase.store.select(link.dataset.node); return }
            const section = event.target.closest('[data-section]')
            if (section) { event.preventDefault(); ReviewBase.store.showSection(section.dataset.section); return }
            const file = event.target.closest('[data-file]')
            if (file) { event.preventDefault(); ReviewBase.store.showFile(file.dataset.file, file.dataset.lines || null) }
        })
        this.on(REVIEW_EVENTS.select, (event) => this.render(event.detail.node))
        this.on(REVIEW_EVENTS.route,  () => this.render(null))
        const current = ReviewBase.store.route.node
        this.render(current ? ReviewBase.store.get(current) : null)
    }

    anchorPanel(panel, node) {                                                  // where a chain ends: open the thing itself
        const p = this.el('p', { class : 'anchor-note' }, 'An anchor: the chain of evidence ends here, on something a person can open. ')
        if (node.kind === 'file' || node.kind === 'test') {
            const [path, lines] = node.record.ref.split(':', 2)[1].split('#')
            p.appendChild(this.el('a', { href : node.href, 'data-file' : path, 'data-lines' : lines && lines.startsWith('L') ? lines : '' }, `Open ${path} here`))
        } else {
            p.appendChild(this.el('a', { href : node.href, target : node.kind === 'section' ? '_self' : '_top', 'data-section' : node.kind === 'section' ? node.record.ref.split(':')[1] : null }, `Open: ${node.opens}`))
        }
        panel.appendChild(p)
    }

    linkPaths(parent, text) {                                                     // the file paths a property names, as links into the source view; only paths the derivation saw
        const store = ReviewBase.store
        const parts = text.split(/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)/)
        for (const [i, part] of parts.entries()) {
            if (i % 2 && store.knownPath(part)) parent.appendChild(this.el('a', { href : `#file=${part}`, 'data-file' : part, class : 'path' }, part))
            else if (part) parent.appendChild(document.createTextNode(part))
        }
        return parent
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
        head.appendChild(this.linkPaths(this.el('h2', { class : 'name' }), node.name))
        if (node.record && node.record.proposed) head.appendChild(this.el('span', { class : 'proposed' }, `proposed by ${node.record.proposed.model}, ${node.record.proposed.date}; not yet accepted`))
        panel.appendChild(head)

        if (node.layer === 'anchor') this.anchorPanel(panel, node)
        const source = store.sectionLink(node.source)
        if (source) {
            const p = this.el('p', { class : 'source' }, 'From the brief, ')
            p.appendChild(this.el('a', { href : `#section=${node.source.section}`, 'data-section' : node.source.section, title : 'read the section here, in the navigator' }, source.title))
            p.appendChild(document.createTextNode(' ('))
            p.appendChild(this.el('a', { href : source.href, target : '_top', class : 'leave' }, 'rendered page'))
            p.appendChild(document.createTextNode(')'))
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
            dl.appendChild(this.linkPaths(this.el('dd'), Array.isArray(value) ? value.join(', ') : String(value)))
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
                if (other && other.layer === 'anchor') {                              // the chain ends here: open it without leaving, or open the thing itself
                    li.appendChild(document.createTextNode(' '))
                    if (other.kind === 'file' || other.kind === 'test') {
                        const [path, lines] = other.record.ref.split(':', 2)[1].split('#')
                        li.appendChild(this.el('a', { href : other.href, class : 'open', 'data-file' : path, 'data-lines' : lines && lines.startsWith('L') ? lines : null }, 'open'))
                    } else if (other.kind === 'section') {
                        li.appendChild(this.el('a', { href : other.href, class : 'open', 'data-section' : other.record.ref.split(':')[1] }, 'read'))
                    } else {
                        li.appendChild(this.el('a', { href : other.href, class : 'open leave', target : '_top' }, other.kind === 'url' ? 'visit' : 'open on GitHub'))
                    }
                }
                ul.appendChild(li)
            }
            panel.appendChild(ul)
        }
    }
}

customElements.define('review-node', ReviewNode)
