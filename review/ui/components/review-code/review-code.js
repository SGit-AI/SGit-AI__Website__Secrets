/**
 * review-code — the code panel, the bottom-up view: for the file, class,
 * method, test or surface in focus, what it says about itself (the technical
 * layer: its banner, its def's comment, its JSDoc, taken from the code by the
 * parser), why it exists (the business layer: the claims that live in it and
 * the stories they realise, the components that name it, the tests that test
 * it, the pages that expose it), its outline (classes and methods, each a
 * click that marks the lines in the source beside it), what it imports and
 * what imports it, and for a method what it calls and what calls it, every
 * one a link. Up to the story, down to the line, without leaving.
 *
 * @module review-code
 * @version 0.1.0
 */
import { ReviewBase, REVIEW_EVENTS, LAYERS, CODE_LAYERS } from '../review-base/review-base.js'

const RE_PATHS = /\b(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:py|js|mjs|css|html|json|yml|sh|rules|md)\b/g

export class ReviewCode extends ReviewBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'review-code' }

    onReady() {
        this.shadowRoot.addEventListener('click', (event) => {
            const node = event.target.closest('[data-node]')
            if (node) { event.preventDefault(); ReviewBase.store.select(node.dataset.node); return }
            const file = event.target.closest('[data-file]')
            if (file) { event.preventDefault(); ReviewBase.store.showFile(file.dataset.file, file.dataset.lines || null); return }
            const section = event.target.closest('[data-section]')
            if (section) { event.preventDefault(); ReviewBase.store.showSection(section.dataset.section) }
        })
        this.on(REVIEW_EVENTS.select, (event) => this.render(event.detail.node))
        this.on(REVIEW_EVENTS.file,   (event) => { if (!event.detail.node) this.render(ReviewBase.store.fileNode(event.detail.path), event.detail.path) })
        this.on(REVIEW_EVENTS.graph,  () => { const r = ReviewBase.store.route; if (r.node) this.render(ReviewBase.store.get(r.node)) })
        const route = ReviewBase.store.route
        if (route.node) this.render(ReviewBase.store.get(route.node))
    }

    link(id, text = null, cls = '') {
        const node = ReviewBase.store.get(id)
        return node ? this.el('a', { href : `#node=${encodeURIComponent(id)}`, 'data-node' : id, class : `${cls} layer-${node.layer}`.trim() }, text || node.name) : this.el('span', { class : 'mono' }, text || id)
    }

    fileLink(path, text = null) {
        return this.el('a', { href : `#file=${path}`, 'data-file' : path, class : 'mono' }, text || path)
    }

    list(items) {
        const ul = this.el('ul', { class : 'links' })
        for (const item of items) { const li = this.el('li'); li.appendChild(item); ul.appendChild(li) }
        return ul
    }

    render(node, pathOnly = null) {
        const store = ReviewBase.store
        const panel = this.$('[data-panel]')
        panel.replaceChildren()
        if (!node && pathOnly) {
            panel.appendChild(this.el('p', { class : 'empty' }, `${pathOnly} is served by the site but not in the derived graph (not a source file of the review set).`))
            return
        }
        if (!node || !CODE_LAYERS.includes(node.layer)) {
            panel.appendChild(this.el('p', { class : 'empty' }, 'Pick a file, a class or a method: the tree on the left, a path in any node, or "open" on a claim.'))
            return
        }
        const file = node.layer === 'file' ? node : store.fileNode(node.path)
        const head = this.el('header', { class : 'head' })
        head.appendChild(this.el('span', { class : `layer layer-${node.layer}` }, LAYERS[node.layer].label))
        head.appendChild(this.el('h2', { class : 'name' }, node.name))
        panel.appendChild(head)
        const where = this.el('p', { class : 'where' })
        if (file && node !== file) { where.appendChild(document.createTextNode('in ')); where.appendChild(this.link(file.id, file.path, 'mono')) }
        if (node.source && node.source.line) where.appendChild(document.createTextNode(`${file && node !== file ? ' · ' : ''}lines ${node.source.line} to ${node.source.end}`))
        if (node.record && node.record.loc) where.appendChild(document.createTextNode(` · ${node.record.loc} lines`))
        if (node.record && node.record.language) where.appendChild(document.createTextNode(`${node.record.language} · ${node.record.lines} lines · ${node.record.bytes} bytes`))
        panel.appendChild(where)

        // what: the technical layer, from the code's own words
        panel.appendChild(this.el('h3', {}, 'What it says about itself'))
        const doc = node.doc || (node.record && node.record.doc) || ''
        panel.appendChild(doc ? this.el('p', { class : 'doc' }, doc) : this.el('p', { class : 'empty' }, 'No comment of its own.'))

        // why: the business layer, from the claims and the intent that reach this code
        const why = this.why(node, file)
        panel.appendChild(this.el('h3', {}, `Why it exists (${why.length})`))
        panel.appendChild(why.length ? this.list(why) : this.el('p', { class : 'empty' }, 'No claim lives here and no component names it: either glue, or a gap in the claims.'))

        // the outline: classes and methods, each marking its lines
        if (node.layer === 'file' || node.layer === 'class') {
            const children = node.children.map(id => store.get(id)).filter(Boolean)
            if (children.length) {
                panel.appendChild(this.el('h3', {}, `Outline (${children.length})`))
                const ol = this.el('ol', { class : 'outline' })
                for (const child of children) {
                    const li = this.el('li')
                    li.appendChild(this.el('span', { class : `layer layer-${child.layer}` }, LAYERS[child.layer].label))
                    li.appendChild(document.createTextNode(' '))
                    li.appendChild(this.link(child.id))
                    if (child.source && child.source.line) li.appendChild(this.el('span', { class : 'lines' }, ` L${child.source.line}`))
                    if (child.doc) li.appendChild(this.el('span', { class : 'muted' }, ` ${child.doc.slice(0, 90)}`))
                    if (child.children.length) {
                        const sub = this.el('ul', { class : 'outline sub' })
                        for (const grand of child.children.map(id => store.get(id)).filter(Boolean)) {
                            const sli = this.el('li')
                            sli.appendChild(this.link(grand.id))
                            if (grand.source && grand.source.line) sli.appendChild(this.el('span', { class : 'lines' }, ` L${grand.source.line}`))
                            if (grand.doc) sli.appendChild(this.el('span', { class : 'muted' }, ` ${grand.doc.slice(0, 70)}`))
                            sub.appendChild(sli)
                        }
                        li.appendChild(sub)
                    }
                    ol.appendChild(li)
                }
                panel.appendChild(ol)
            }
        }

        // imports, and who imports this
        if (node.layer === 'file' && node.record.module) {
            const imports = store.edges.filter(e => e.verb === 'imports' && e.from === node.record.module)
            const by      = store.edges.filter(e => e.verb === 'imports' && e.to === node.record.module)
            if (imports.length) { panel.appendChild(this.el('h3', {}, `Imports (${imports.length})`)); panel.appendChild(this.list(imports.map(e => this.fileLink(e.to.slice(7))))) }
            if (by.length)      { panel.appendChild(this.el('h3', {}, `Imported by (${by.length})`));  panel.appendChild(this.list(by.map(e => this.fileLink(e.from.slice(7))))) }
            const external = (node.record.module.imports || []).filter(i => !store.byPath.has(i.module.replace(/^\//, '')) && !i.module.startsWith('.'))
            if (external.length) { panel.appendChild(this.el('h3', {}, `From outside the set (${external.length})`)); panel.appendChild(this.el('p', { class : 'mono muted' }, [...new Set(external.map(i => i.module))].join(', '))) }
        }

        // calls and callers
        if (node.layer === 'method') {
            const calls   = (node.calls || [])
            const callers = store.edges.filter(e => e.verb === 'calls' && e.to === node.id)
            panel.appendChild(this.el('h3', {}, `Calls (${calls.length})`))
            panel.appendChild(calls.length ? this.list(calls.map(c => c.kind === 'internal' ? this.link(c.to, `${store.get(c.to) ? store.get(c.to).name : c.to}${c.line ? ' · L' + c.line : ''}`) : this.el('span', { class : 'mono muted', title : 'outside the set: the platform, a library, or not resolved' }, `${c.to}${c.line ? ' · L' + c.line : ''}`))) : this.el('p', { class : 'empty' }, 'Calls nothing.'))
            panel.appendChild(this.el('h3', {}, `Called by (${callers.length})`))
            panel.appendChild(callers.length ? this.list(callers.map(e => this.link(e.from, `${store.get(e.from) ? store.get(e.from).name : e.from} (${e.from.split(':')[1]})`))) : this.el('p', { class : 'empty' }, 'Nothing in the set calls it: an entry point, a handler, or dead.'))
        }

        // tests
        if (node.layer === 'file' && node.record.module) {
            const tested = store.edges.filter(e => e.verb === 'tests' && e.to === node.record.module)
            if (tested.length) { panel.appendChild(this.el('h3', {}, `Tested by (${tested.length})`)); panel.appendChild(this.list(tested.map(e => this.link(e.from)))) }
        }
        if (node.layer === 'test') {
            const tests = store.edges.filter(e => e.verb === 'tests' && e.from === node.id)
            if (tests.length) { panel.appendChild(this.el('h3', {}, `Tests (${tests.length})`)); panel.appendChild(this.list(tests.map(e => this.fileLink(e.to.slice(7))))) }
        }
        if (node.layer === 'surface') {
            const exposes = store.edges.filter(e => (e.verb === 'exposes' || e.verb === 'handled_by') && e.from === node.id)
            const exposed = store.edges.filter(e => e.verb === 'exposes' && e.to === node.id)
            if (exposes.length) { panel.appendChild(this.el('h3', {}, `Shows (${exposes.length})`)); panel.appendChild(this.list(exposes.map(e => this.link(e.to)))) }
            if (exposed.length) { panel.appendChild(this.el('h3', {}, `Shown on (${exposed.length})`)); panel.appendChild(this.list(exposed.map(e => this.link(e.from)))) }
        }
        const github = `https://github.com/SGit-AI/SGit-AI__Website__Secrets/blob/dev/${node.path || (file && file.path) || ''}${node.source && node.source.line ? '#L' + node.source.line + '-L' + node.source.end : ''}`
        const foot = this.el('p', { class : 'foot' })
        foot.appendChild(this.el('a', { href : github, target : '_top', class : 'leave' }, 'on GitHub'))
        panel.appendChild(foot)
    }

    why(node, file) {                                                             // claims living in this file (or a parent folder), their stories; components naming the path; pages
        const store = ReviewBase.store
        const path  = node.path || (file && file.path) || ''
        const items = []
        const seen  = new Set()
        for (const edge of store.edges) {
            if ((edge.verb === 'lives_in' || edge.verb === 'proven_by') && /^anchor\.(file|test)\./.test(edge.to)) {
                const target = edge.to.replace(/^anchor\.(file|test)\./, '').split('@')[0]
                if (target === path || (target.endsWith('/') && path.startsWith(target))) {
                    const claim = store.get(edge.from)
                    if (!claim || seen.has(claim.id)) continue
                    seen.add(claim.id)
                    const li = this.el('span')
                    li.appendChild(this.el('span', { class : 'layer layer-claim' }, claim.status === 'shipped' ? `shipped v${claim.record.since}` : claim.status))
                    li.appendChild(document.createTextNode(' '))
                    li.appendChild(this.link(claim.id))
                    const stories = store.edges.filter(e => e.verb === 'realises' && e.from === claim.id).map(e => store.get(e.to)).filter(Boolean)
                    if (stories.length) {
                        li.appendChild(document.createTextNode(' → '))
                        stories.forEach((story, i) => { if (i) li.appendChild(document.createTextNode(', ')); li.appendChild(this.link(story.id)) })
                    }
                    items.push(li)
                }
            }
        }
        if (path) {
            for (const other of store.nodes.values()) {
                if (other.layer !== 'component' || seen.has(other.id)) continue
                const text = `${other.name} ${JSON.stringify(other.record.properties || {})}`
                if (text.includes(path) || (file && text.includes(file.path.split('/').slice(0, -1).join('/') + '/'))) {
                    seen.add(other.id)
                    const li = this.el('span')
                    li.appendChild(this.el('span', { class : 'layer layer-component' }, 'component'))
                    li.appendChild(document.createTextNode(' '))
                    li.appendChild(this.link(other.id))
                    items.push(li)
                }
            }
        }
        return items
    }
}

customElements.define('review-code', ReviewCode)
