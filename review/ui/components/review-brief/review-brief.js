/**
 * review-brief — a section of the MVP brief, shown in place: the heading, the
 * same HTML the rendered page shows (from review/brief/sections/, split by
 * review/tools/brief.py), the intent nodes that were written from it (each a
 * way into the graph), the previous and next subsection, and a link to the
 * rendered page for anyone who wants to leave. With no section in the route
 * it shows the table of contents. A reader following a claim down to the
 * brief stays in the navigator.
 *
 * @module review-brief
 * @version 0.1.0
 */
import { ReviewBase, REVIEW_EVENTS, LAYERS } from '../review-base/review-base.js'

const LAYER_OF = Object.freeze({ stories : 'story', rules : 'rule', examples : 'example', flows : 'flow', steps : 'step', components : 'component', deploy : 'environment' })

export class ReviewBrief extends ReviewBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'review-brief' }

    onReady() {
        this.shadowRoot.addEventListener('click', (event) => {
            const node = event.target.closest('[data-node]')
            if (node) { event.preventDefault(); ReviewBase.store.select(node.dataset.node); return }
            const section = event.target.closest('[data-section]')
            if (section) { event.preventDefault(); ReviewBase.store.showSection(section.dataset.section) }
        })
        this.on(REVIEW_EVENTS.section, (event) => this.render(event.detail.id))
        this.on(REVIEW_EVENTS.route,   (event) => { if (event.detail.view === 'brief') this.render(null) })
        this.on(REVIEW_EVENTS.loaded,  () => { const r = ReviewBase.store.route; if (r.section || r.view === 'brief') this.render(r.section) })
        const route = ReviewBase.store.route
        if (route.section || route.view === 'brief') this.render(route.section)
    }

    async render(id) {
        const store = ReviewBase.store
        const panel = this.$('[data-panel]')
        panel.replaceChildren()
        const index = await store.briefIndex()
        if (!id) return this.contents(panel, index)
        const found = await store.briefSection(id)
        if (!found) { panel.appendChild(this.el('p', { class : 'empty' }, `No section ${id} in the brief.`)); return }
        const { section, subsection } = found
        const head = this.el('header', { class : 'head' })
        head.appendChild(this.el('span', { class : 'layer' }, 'brief'))
        head.appendChild(this.el('h2', { class : 'name' }, subsection ? subsection.title : section.title))
        panel.appendChild(head)
        const crumb = this.el('p', { class : 'crumb' })
        crumb.appendChild(this.el('a', { href : '#view=brief', 'data-section' : '' }, 'the brief'))
        crumb.appendChild(document.createTextNode(' / '))
        crumb.appendChild(subsection ? this.el('a', { href : `#section=${section.id}`, 'data-section' : section.id }, section.title) : this.el('span', {}, section.title))
        crumb.appendChild(document.createTextNode(' · '))
        crumb.appendChild(this.el('a', { href : `${section.page}#${(subsection || section).anchor}`, target : '_top', class : 'leave' }, 'the rendered page'))
        panel.appendChild(crumb)
        const body = this.el('div', { class : 'body' })
        body.innerHTML = (subsection || section).html || '<p class="empty">This heading has no text of its own; see its subsections.</p>'   // our own build output, from the brief's markdown
        for (const link of body.querySelectorAll('a[href]')) link.setAttribute('target', '_top')
        panel.appendChild(body)
        if (!subsection && section.subsections.length) {
            panel.appendChild(this.el('h3', {}, 'Subsections'))
            const ul = this.el('ul', { class : 'links' })
            for (const sub of section.subsections) {
                const li = this.el('li')
                li.appendChild(this.el('a', { href : `#section=${sub.id}`, 'data-section' : sub.id }, sub.title))
                if (sub.nodes.length) li.appendChild(this.el('span', { class : 'count' }, ` ${sub.nodes.length} node${sub.nodes.length === 1 ? '' : 's'}`))
                ul.appendChild(li)
            }
            panel.appendChild(ul)
        }
        const nodes = (subsection || section).nodes
        panel.appendChild(this.el('h3', {}, nodes.length ? `Written from this section (${nodes.length})` : 'Nothing in the graph was written from this section'))
        if (nodes.length) {
            const ul = this.el('ul', { class : 'links' })
            for (const node of nodes) {
                const li = this.el('li')
                const layer = LAYER_OF[node.layer] || node.layer
                li.appendChild(this.el('span', { class : `layer layer-${layer}` }, (LAYERS[layer] || { label : layer }).label))
                li.appendChild(document.createTextNode(' '))
                li.appendChild(this.el('a', { href : `#node=${encodeURIComponent(node.id)}`, 'data-node' : node.id }, node.name))
                ul.appendChild(li)
            }
            panel.appendChild(ul)
        }
        const siblings = subsection ? section.subsections : index.sections
        const at       = siblings.findIndex(s => s.id === (subsection || section).id)
        const nav      = this.el('p', { class : 'prevnext' })
        if (at > 0) nav.appendChild(this.el('a', { href : `#section=${siblings[at - 1].id}`, 'data-section' : siblings[at - 1].id }, `← ${siblings[at - 1].title}`))
        if (at >= 0 && at < siblings.length - 1) { if (at > 0) nav.appendChild(document.createTextNode(' · ')); nav.appendChild(this.el('a', { href : `#section=${siblings[at + 1].id}`, 'data-section' : siblings[at + 1].id }, `${siblings[at + 1].title} →`)) }
        panel.appendChild(nav)
    }

    contents(panel, index) {
        const head = this.el('header', { class : 'head' })
        head.appendChild(this.el('span', { class : 'layer' }, 'brief'))
        head.appendChild(this.el('h2', { class : 'name' }, 'The MVP build brief, as sections'))
        panel.appendChild(head)
        const p = this.el('p', { class : 'crumb' }, 'Every intent node was written from one of these; every claim is described in one. ')
        p.appendChild(this.el('a', { href : index.page, target : '_top', class : 'leave' }, 'The rendered page'))
        p.appendChild(document.createTextNode(` · ${index.doc}`))
        panel.appendChild(p)
        const ol = this.el('ol', { class : 'toc' })
        for (const section of index.sections) {
            const li = this.el('li')
            li.appendChild(this.el('a', { href : `#section=${section.id}`, 'data-section' : section.id }, section.title))
            li.appendChild(this.el('span', { class : 'count' }, ` ${section.nodes} node${section.nodes === 1 ? '' : 's'}`))
            if (section.subsections.length) {
                const ul = this.el('ul', { class : 'subs' })
                for (const sub of section.subsections) {
                    const sli = this.el('li')
                    sli.appendChild(this.el('a', { href : `#section=${sub.id}`, 'data-section' : sub.id }, sub.title))
                    if (sub.nodes) sli.appendChild(this.el('span', { class : 'count' }, ` ${sub.nodes}`))
                    ul.appendChild(sli)
                }
                li.appendChild(ul)
            }
            ol.appendChild(li)
        }
        panel.appendChild(ol)
    }
}

customElements.define('review-brief', ReviewBrief)
