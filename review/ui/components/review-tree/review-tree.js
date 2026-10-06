/**
 * review-tree — story > rule > example, flow > step, the component tree, and
 * environment > resource / pipeline > job: one component, every tree shape.
 * A click on a node selects it (walking down); the selected path stays open.
 * The four view buttons at the top switch the tree; review-ladder replaces them
 * from step 2.
 *
 * @module review-tree
 * @version 0.1.0
 */
import { ReviewBase, REVIEW_EVENTS, LAYERS, VIEWS } from '../review-base/review-base.js'

const VIEW_LABELS = Object.freeze({ stories : 'Stories', flows : 'Flows', components : 'Components', deploy : 'Deploy', claims : 'Claims', brief : 'The brief' })

export class ReviewTree extends ReviewBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'review-tree' }

    onReady() {
        this._view     = ReviewBase.store.route.view
        this._selected = ReviewBase.store.route.node
        this._open     = new Set()
        this.$('[data-views]').addEventListener('click', (event) => {
            const button = event.target.closest('[data-view]')
            if (button) ReviewBase.store.show(button.dataset.view)
        })
        this.$('[data-tree]').addEventListener('click', (event) => {
            const button = event.target.closest('[data-node]')
            if (button) { ReviewBase.store.select(button.dataset.node); return }
            const section = event.target.closest('[data-section]')
            if (section) ReviewBase.store.showSection(section.dataset.section)
        })
        this.on(REVIEW_EVENTS.section, () => { if (this._view !== 'brief') { this._view = 'brief'; this.render() } })
        this.on(REVIEW_EVENTS.loaded, () => this.render())
        this.on(REVIEW_EVENTS.route,  (event) => { this._view = event.detail.view; this._selected = null; this.render() })
        this.on(REVIEW_EVENTS.select, (event) => this.follow(event.detail.id))
        if (ReviewBase.store.loaded) this.render()
    }

    follow(id) {
        const node = ReviewBase.store.get(id)
        if (!node) return
        this._selected = id
        this._view     = LAYERS[node.layer].group
        for (const ancestor of ReviewBase.store.ancestors(id)) this._open.add(ancestor.id)
        this.render()
    }

    render() {
        const store = ReviewBase.store
        for (const button of this.$$('[data-view]')) {
            button.classList.toggle('here', button.dataset.view === this._view)
            button.setAttribute('aria-pressed', button.dataset.view === this._view ? 'true' : 'false')
            button.textContent = `${VIEW_LABELS[button.dataset.view]} (${store.roots(button.dataset.view).length})`
        }
        const tree = this.$('[data-tree]')
        tree.replaceChildren()
        if (this._view === 'brief') return this.brief(tree)
        if (this._view === 'claims') return this.claims(tree)
        const roots = store.roots(this._view)
        if (!roots.length) {
            tree.appendChild(this.el('p', { class : 'empty' }, 'Nothing in this layer yet.'))
            return
        }
        tree.appendChild(this.list(roots, 0))
    }

    async brief(tree) {                                                          // the brief's sections, each opening in place on the right
        const index = await ReviewBase.store.briefIndex()
        const ol = this.el('ol', { class : 'level level-0 brief' })
        for (const section of index.sections) {
            const li = this.el('li')
            li.appendChild(this.el('button', { type : 'button', class : 'node layer-section', 'data-section' : section.id }, section.title))
            if (section.subsections.length) {
                const ul = this.el('ul', { class : 'level level-1' })
                for (const sub of section.subsections) {
                    const sli = this.el('li')
                    const b   = this.el('button', { type : 'button', class : 'node layer-section', 'data-section' : sub.id }, sub.title)
                    if (sub.nodes) b.appendChild(this.el('span', { class : 'count' }, String(sub.nodes)))
                    sli.appendChild(b)
                    ul.appendChild(sli)
                }
                li.appendChild(ul)
            }
            ol.appendChild(li)
        }
        tree.appendChild(ol)
    }

    claims(tree) {                                                               // every claim, grouped by area, with its status
        const store = ReviewBase.store
        const byArea = new Map()
        for (const claim of store.roots('claims')) { if (!byArea.has(claim.area)) byArea.set(claim.area, []); byArea.get(claim.area).push(claim) }
        const ol = this.el('ol', { class : 'level level-0' })
        for (const [area, claims] of byArea) {
            const li = this.el('li')
            li.appendChild(this.el('p', { class : 'area' }, `${area} (${claims.length})`))
            const ul = this.el('ul', { class : 'level level-1' })
            for (const claim of claims) {
                const button = this.el('button', { type : 'button', class : `node layer-claim status-${claim.status}${claim.id === this._selected ? ' selected' : ''}`, 'data-node' : claim.id })
                button.appendChild(this.el('span', { class : `layer status-${claim.status}` }, claim.status === 'shipped' ? `shipped v${claim.record.since}` : claim.status))
                button.appendChild(this.el('span', { class : 'name' }, claim.name))
                const sli = this.el('li')
                sli.appendChild(button)
                ul.appendChild(sli)
            }
            li.appendChild(ul)
            ol.appendChild(li)
        }
        tree.appendChild(ol)
    }

    list(nodes, depth) {
        const ul = this.el('ul', { class : `level level-${depth}`, role : depth ? 'group' : 'tree' })
        for (const node of nodes) {
            const li     = this.el('li', { role : 'treeitem', 'aria-expanded' : this._open.has(node.id) ? 'true' : 'false' })
            const button = this.el('button', { type : 'button', class : `node layer-${node.layer}`, 'data-node' : node.id, 'aria-label' : `${node.layer}: ${node.name}` })
            if (node.id === this._selected) button.classList.add('selected')
            if (node.record && node.record.proposed) button.classList.add('proposed')
            button.appendChild(this.el('span', { class : 'layer' }, LAYERS[node.layer].label))
            button.appendChild(this.el('span', { class : 'name' }, node.name))
            if (node.surface) button.appendChild(this.el('span', { class : 'surface' }, node.surface))
            if (node.children.length) button.appendChild(this.el('span', { class : 'count' }, String(node.children.length)))
            li.appendChild(button)
            if (node.children.length && this._open.has(node.id)) {
                li.appendChild(this.list(node.children.map(id => ReviewBase.store.get(id)).filter(Boolean), depth + 1))
            }
            ul.appendChild(li)
        }
        return ul
    }
}

customElements.define('review-tree', ReviewTree)
