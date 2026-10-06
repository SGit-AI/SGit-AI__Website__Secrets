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

const VIEW_LABELS = Object.freeze({ stories : 'Stories', flows : 'Flows', components : 'Components', deploy : 'Deploy', claims : 'Claims', brief : 'The brief', code : 'Code' })

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
        this.on(REVIEW_EVENTS.graph,   () => { if (this._view === 'code') this.render() })
        this.$('[data-tree]').addEventListener('toggle', (event) => { const g = event.target; if (g.dataset.group) this._open[g.open ? 'add' : 'delete'](g.dataset.group) }, true)
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
        if (node.path) this._open.add(`pkg:${node.path.includes('/') ? node.path.split('/').slice(0, -1).join('/') : '(root)'}`)
        this.render()
    }

    render() {
        const store = ReviewBase.store
        for (const button of this.$$('[data-view]')) {
            button.classList.toggle('here', button.dataset.view === this._view)
            button.setAttribute('aria-pressed', button.dataset.view === this._view ? 'true' : 'false')
            const n = button.dataset.view === 'brief' ? null
                    : button.dataset.view === 'code' ? (store.graph ? store.roots('code').filter(n => n.layer === 'file').length : store.graphIndex ? store.graphIndex.counts.files : null)
                    : store.roots(button.dataset.view).length
            button.textContent = n === null ? VIEW_LABELS[button.dataset.view] : `${VIEW_LABELS[button.dataset.view]} (${n})`
        }
        const tree = this.$('[data-tree]')
        tree.replaceChildren()
        if (this._view === 'brief') return this.brief(tree)
        if (this._view === 'claims') return this.claims(tree)
        tree.classList.toggle('code', this._view === 'code')
        if (this._view === 'code') return this.code(tree)
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

    claims(tree) {                                                               // the same thing once: claims grouped by status and release, each group a fold with the chip on it
        const store  = ReviewBase.store
        const groups = new Map()
        const order  = (c) => c.status === 'shipped' ? `0 ${(c.record.since || '').split('.').map(n => n.padStart(3, '0')).join('.')}` : c.status === 'proposed' ? '1' : '2'
        for (const claim of store.roots('claims').sort((a, b) => order(b).localeCompare(order(a)))) {
            const key = claim.status === 'shipped' ? `shipped v${claim.record.since}` : claim.status
            if (!groups.has(key)) groups.set(key, { status : claim.status, claims : [] })
            groups.get(key).claims.push(claim)
        }
        const selected = this._selected ? store.get(this._selected) : null
        for (const [key, group] of groups) {
            const holds   = selected && group.claims.some(c => c.id === selected.id)
            const details = this.el('details', { class : 'group', 'data-group' : key })
            if (holds || this._open.has(key)) details.open = true
            const summary = this.el('summary', { class : 'group-head' })
            summary.appendChild(this.el('span', { class : `layer status-${group.status}` }, key))
            summary.appendChild(this.el('span', { class : 'count' }, `${group.claims.length} claim${group.claims.length === 1 ? '' : 's'}`))
            details.appendChild(summary)
            const ul = this.el('ul', { class : 'level level-1' })
            let lastArea = null
            for (const claim of group.claims.sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name))) {
                if (claim.area !== lastArea) { ul.appendChild(this.el('li', { class : 'area' }, claim.area)); lastArea = claim.area }
                const button = this.el('button', { type : 'button', class : `node layer-claim${claim.id === this._selected ? ' selected' : ''}`, 'data-node' : claim.id })
                button.appendChild(this.el('span', { class : 'name' }, claim.name))
                const li = this.el('li')
                li.appendChild(button)
                ul.appendChild(li)
            }
            details.appendChild(ul)
            tree.appendChild(details)
        }
    }

    async code(tree) {                                                           // packages > files > classes > methods; loads the derived layers on first use
        const store = ReviewBase.store
        if (!store.graph) { tree.appendChild(this.el('p', { class : 'empty' }, 'Reading the derived layers…')); await store.loadGraph(); tree.replaceChildren() }
        tree.classList.add('code')
        const files = store.roots('code').filter(n => n.layer === 'file')
        const byPackage = new Map()
        for (const file of files) { const pkg = file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '(root)'; if (!byPackage.has(pkg)) byPackage.set(pkg, []); byPackage.get(pkg).push(file) }
        const selected = this._selected ? store.get(this._selected) : null
        const selectedPath = selected && selected.path ? selected.path : null
        for (const [pkg, members] of [...byPackage.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const details = this.el('details', { class : 'group', 'data-group' : `pkg:${pkg}` })
            if (this._open.has(`pkg:${pkg}`) || (selectedPath && selectedPath.startsWith(pkg + '/'))) details.open = true
            const summary = this.el('summary', { class : 'group-head' })
            summary.appendChild(this.el('span', { class : 'pkg mono' }, pkg + '/'))
            summary.appendChild(this.el('span', { class : 'count' }, `${members.length} file${members.length === 1 ? '' : 's'}`))
            details.appendChild(summary)
            const ul = this.el('ul', { class : 'level level-1' })
            for (const file of members.sort((a, b) => a.path.localeCompare(b.path))) {
                const li = this.el('li', { role : 'treeitem' })
                const button = this.el('button', { type : 'button', class : `node layer-file${file.id === this._selected ? ' selected' : ''}`, 'data-node' : file.id })
                button.appendChild(this.el('span', { class : 'name mono' }, file.path.split('/').pop()))
                if (file.children.length) button.appendChild(this.el('span', { class : 'count' }, String(file.children.length)))
                li.appendChild(button)
                if (file.children.length && (this._open.has(file.id) || selectedPath === file.path)) {
                    const inner = this.el('ul', { class : 'level level-2' })
                    for (const child of file.children.map(id => store.get(id)).filter(Boolean)) {
                        const cli = this.el('li')
                        const cb  = this.el('button', { type : 'button', class : `node layer-${child.layer}${child.id === this._selected ? ' selected' : ''}`, 'data-node' : child.id })
                        cb.appendChild(this.el('span', { class : 'layer' }, child.layer))
                        cb.appendChild(this.el('span', { class : 'name mono' }, child.name))
                        if (child.children.length) cb.appendChild(this.el('span', { class : 'count' }, String(child.children.length)))
                        cli.appendChild(cb)
                        if (child.children.length && (this._open.has(child.id) || (selected && (selected.id === child.id || selected.parent === child.id)))) {
                            const leaves = this.el('ul', { class : 'level level-3' })
                            for (const leaf of child.children.map(id => store.get(id)).filter(Boolean)) {
                                const lli = this.el('li')
                                const lb  = this.el('button', { type : 'button', class : `node layer-method${leaf.id === this._selected ? ' selected' : ''}`, 'data-node' : leaf.id })
                                lb.appendChild(this.el('span', { class : 'name mono' }, leaf.name))
                                if (leaf.source && leaf.source.line) lb.appendChild(this.el('span', { class : 'surface' }, `L${leaf.source.line}`))
                                lli.appendChild(lb)
                                leaves.appendChild(lli)
                            }
                            cli.appendChild(leaves)
                        }
                        inner.appendChild(cli)
                    }
                    li.appendChild(inner)
                }
                ul.appendChild(li)
            }
            details.appendChild(ul)
            tree.appendChild(details)
        }
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
