/**
 * reader-panel — the reader's column: a tab on the right edge of every page
 * that opens a drawer with three views. Log: mark this page read, star it,
 * vote, leave a note, dictate one, then send it all to the build agent or copy
 * it for Claude (reader-log). Chat: ask the site, offline or through the
 * reader's own OpenRouter key (reader-chat). Graph: the intent nodes this page
 * names and their neighbours, drawn by the navigator's review-graph, loaded
 * only when the tab is first opened. Terms: the glossary entries this page
 * links (a.sg-term, written by the build from data/terms.json), with their
 * definitions and a way to the page that explains each. Open or closed and the current tab are
 * kept in localStorage under LOCAL_STORAGE_KEYS.reader; nothing else.
 *
 * @module reader-panel
 * @version 0.1.0
 */
import { SgBase, READER_EVENTS } from '../sg-base/sg-base.js'
import { LOCAL_STORAGE_KEYS }    from '../../app/config/storage-keys.js'
import '../reader-log/reader-log.js'
import '../reader-chat/reader-chat.js'

const TABS      = Object.freeze(['log', 'chat', 'graph', 'terms'])
const GRAPH_URL = new URL('../../review/ui/components/review-graph/review-graph.js', import.meta.url)

export class ReaderPanel extends SgBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'reader-panel' }

    onReady() {
        this._state = this.readState()
        this.$('[data-toggle]').addEventListener('click', () => this.open(!this._state.open))
        this.$('[data-close]').addEventListener('click',  () => this.open(false))
        this.$('[data-tabs]').addEventListener('click', (event) => {
            const button = event.target.closest('[data-tab]')
            if (button) this.show(button.dataset.tab)
        })
        this.on(READER_EVENTS.open, (event) => { this.open(true); if (event.detail && event.detail.tab) this.show(event.detail.tab) })
        this.on(READER_EVENTS.log,  (event) => this.badge(event.detail.unsent))
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && this._state.open) this.open(false) })
        this.show(this._state.tab, false)
        this.open(this._state.open, false)
        const asked = location.hash.replace(/^#/, '')                            // /reader/#chat, #log: a link into the column opens it on that tab
        if (TABS.includes(asked)) { this.show(asked); this.open(true) }
    }

    readState() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.reader) || '{}')
            return { open : Boolean(saved.open), tab : TABS.includes(saved.tab) ? saved.tab : 'log' }
        } catch (error) { return { open : false, tab : 'log' } }
    }

    writeState() {
        try { localStorage.setItem(LOCAL_STORAGE_KEYS.reader, JSON.stringify(this._state)) } catch (error) { /* storage blocked: the column still works for this page */ }
    }

    open(open, persist = true) {
        this._state.open = open
        this.$('[data-panel]').hidden = !open
        this.$('[data-toggle]').setAttribute('aria-expanded', open ? 'true' : 'false')
        document.documentElement.classList.toggle('reader-open', open)
        if (open && this._state.tab === 'graph') this.loadGraph()
        if (persist) this.writeState()
    }

    show(tab, persist = true) {
        this._state.tab = tab
        for (const button of this.$$('[data-tab]')) button.setAttribute('aria-pressed', button.dataset.tab === tab ? 'true' : 'false')
        for (const body of this.$$('[data-body]')) body.hidden = body.dataset.body !== tab
        if (tab === 'graph' && this._state.open) this.loadGraph()
        if (tab === 'terms') this.renderTerms()
        if (persist) this.writeState()
    }

    badge(unsent) {
        const toggle = this.$('[data-toggle]')
        toggle.dataset.unsent = unsent > 0 ? String(unsent) : ''
    }

    renderTerms() {                                                               // the glossary terms this page uses, from the links the build wrote
        const list = this.$('[data-terms-list]')
        const hint = this.$('[data-terms-hint]')
        const seen = new Map()
        for (const link of document.querySelectorAll('a.sg-term')) {
            const href = link.getAttribute('href')
            if (!seen.has(href)) seen.set(href, { text : link.textContent, definition : link.getAttribute('title') || '' })
        }
        list.replaceChildren()
        hint.replaceChildren()
        if (!seen.size) {
            hint.appendChild(document.createTextNode('This page uses no glossary term. '))
            hint.appendChild(this.el('a', { href : '/learn/#glossary' }, 'The glossary'))
            hint.appendChild(document.createTextNode(' is on the learn page.'))
            return
        }
        hint.appendChild(document.createTextNode(`${seen.size} term${seen.size === 1 ? '' : 's'} on this page, each defined in this site's context; the link opens the explanation. `))
        hint.appendChild(this.el('a', { href : '/learn/#glossary' }, 'All terms'))
        hint.appendChild(document.createTextNode('.'))
        for (const [href, term] of seen) {
            const dt = this.el('dt')
            dt.appendChild(this.el('a', { href }, term.text))
            list.appendChild(dt)
            list.appendChild(this.el('dd', {}, term.definition))
        }
    }

    pageNodes() {                                                                 // the intent nodes this page links into the navigator
        const ids = new Set()
        for (const link of document.querySelectorAll('a[href*="/review/ui/#node="]')) {
            const id = decodeURIComponent(link.getAttribute('href').split('#node=')[1] || '')
            if (id) ids.add(id)
        }
        return [...ids]
    }

    async loadGraph() {                                                           // the navigator's component, imported once, on first use
        const body = this.$('[data-body="graph"]')
        if (!body.dataset.loaded) {
            body.dataset.loaded = 'loading'
            try {
                await import(GRAPH_URL.href)
                body.dataset.loaded = 'yes'
            } catch (error) {
                body.dataset.loaded = ''
                this.$('[data-graph-hint]').textContent = `The graph could not load (${error.message}).`
                return
            }
        }
        const nodes = this.pageNodes()
        const graph = this.$('review-graph')
        graph.setAttribute('nodes', nodes.join(','))
        const hint = this.$('[data-graph-hint]')
        hint.replaceChildren()
        if (nodes.length) {
            hint.appendChild(document.createTextNode(`${nodes.length} intent node${nodes.length === 1 ? '' : 's'} named on this page, with their neighbours. Click a node to centre on it; `))
            const link = this.el('a', { href : `/review/ui/#node=${encodeURIComponent(nodes[0])}` }, 'open in the navigator')
            hint.appendChild(link)
            hint.appendChild(document.createTextNode('.'))
        } else {
            hint.appendChild(document.createTextNode('This page names no intent node; the graph shows the stories. '))
            hint.appendChild(this.el('a', { href : '/review/ui/' }, 'Open the navigator'))
            hint.appendChild(document.createTextNode(' to walk the whole graph.'))
        }
    }
}

customElements.define('reader-panel', ReaderPanel)
