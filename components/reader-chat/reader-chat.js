/**
 * reader-chat — a chat over the site, in two tiers. Tier 0, no key: a matcher
 * over data/search-index.json, entirely in the browser. Tier 1, the reader's
 * own OpenRouter key: Claude Sonnet through openrouter.ai with tools that read
 * this site (search, open_page, list_pages, read_next), read the reader's log
 * (my_feedback) and file a note into it (file_feedback), so a conversation
 * turns into feedback the build agent receives. The key is held in memory, or
 * in this tab's sessionStorage when the reader ticks "keep for this tab",
 * never in localStorage, and is sent to openrouter.ai and nowhere else. Voice:
 * dictate a question and have replies spoken, with the browser's own speech
 * APIs; nothing is loaded for it.
 *
 * @module reader-chat
 * @version 0.1.0
 */
import { SgBase, READER_EVENTS }     from '../sg-base/sg-base.js'
import { SESSION_STORAGE_KEYS }      from '../../app/config/storage-keys.js'
import { readLog, pageState }        from '../reader-log/reader-log.js'

export const MODEL        = 'anthropic/claude-sonnet-5.5'
export const ENDPOINT     = 'https://openrouter.ai/api/v1/chat/completions'
export const INDEX_URL    = '/data/search-index.json'
export const READER_PAGE  = '/reader/'                                             // the one page whose policy allows the connection to openrouter.ai
const MAX_TOOL_ROUNDS     = 8
const RESULTS             = 6
const OPEN_LIMIT          = 14000                                                 // characters of a page the model gets per open_page

export const TOOLS = Object.freeze([
    { type : 'function', function : { name : 'search',        description : 'Search every page of this site. Returns the best matches with path, title and a snippet.', parameters : { type : 'object', properties : { query : { type : 'string' } }, required : ['query'] } } },
    { type : 'function', function : { name : 'open_page',     description : 'Read one page of this site as markdown, by its path (as returned by search or list_pages).', parameters : { type : 'object', properties : { path : { type : 'string' } }, required : ['path'] } } },
    { type : 'function', function : { name : 'list_pages',    description : 'Every page of this site: path and title.', parameters : { type : 'object', properties : {} } } },
    { type : 'function', function : { name : 'read_next',     description : 'The first page the reader has not marked read, in site order.', parameters : { type : 'object', properties : {} } } },
    { type : 'function', function : { name : 'my_feedback',   description : "The reader's log: what they marked, starred, voted and noted, newest last.", parameters : { type : 'object', properties : {} } } },
    { type : 'function', function : { name : 'file_feedback', description : "File a note into the reader's log, for the build agent, about a page (default: the current page). Use it when the reader states something that should change.", parameters : { type : 'object', properties : { text : { type : 'string' }, page : { type : 'string' } }, required : ['text'] } } },
])

export class ReaderChat extends SgBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'reader-chat' }

    onReady() {
        this._key      = this.storedKey()
        this._messages = []
        this._index    = null
        this.$('[data-model]').textContent = MODEL
        this.$('[data-key-form]').addEventListener('submit', (event) => { event.preventDefault(); this.useKey() })
        this.$('[data-forget]').addEventListener('click', () => this.forgetKey())
        this.$('[data-ask-form]').addEventListener('submit', (event) => { event.preventDefault(); this.ask() })
        this.$('[data-ask]').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.ask() } })
        this.$('[data-messages]').addEventListener('click', (event) => {
            const link = event.target.closest('a[data-ask-link]')
            if (link) { event.preventDefault(); this.$('[data-ask]').value = link.dataset.askLink; this.ask() }
        })
        const mic = this.$('[data-mic]')
        if (SgBase.speechRecognition()) {
            mic.hidden = false
            mic.addEventListener('click', () => this.dictate(mic, (text) => { this.$('[data-ask]').value = text; this.ask() }))
        }
        this.$('[data-speak]').disabled = !('speechSynthesis' in window)
        this.tier()
    }

    storedKey() {
        try { return sessionStorage.getItem(SESSION_STORAGE_KEYS.openrouterKey) || '' } catch (error) { return '' }
    }

    useKey() {
        const key  = this.$('[data-key]').value.trim()
        const keep = this.$('[data-keep]').checked
        this._key  = key
        try {
            if (key && keep) sessionStorage.setItem(SESSION_STORAGE_KEYS.openrouterKey, key)
            else sessionStorage.removeItem(SESSION_STORAGE_KEYS.openrouterKey)
        } catch (error) { /* session storage blocked: the key lives in memory for this page */ }
        this.$('[data-key]').value = ''
        this.tier()
    }

    forgetKey() {
        this._key = ''
        try { sessionStorage.removeItem(SESSION_STORAGE_KEYS.openrouterKey) } catch (error) { /* nothing to forget */ }
        this.tier()
    }

    tier() {
        const label = this.$('[data-tier]')
        this._allowed = SgBase.mayConnect('https://openrouter.ai')
        if (!this._allowed) {
            label.replaceChildren(document.createTextNode('Tier 0 here: offline search. This page\'s policy allows no connection to openrouter.ai; the conversation with tools runs on '))
            label.appendChild(this.el('a', { href : READER_PAGE }, 'the reader\'s page'))
            label.appendChild(document.createTextNode('.'))
            this.$('[data-key-form]').hidden = true
            return
        }
        label.textContent = this._key ? `Tier 1: ${MODEL} through openrouter.ai with tools over this site. Your key stays ${this.storedKey() ? 'in this tab' : 'in memory'}.`
                                      : 'Tier 0: offline search over this site. Add your OpenRouter key for a conversation with tools.'
        this.$('[data-forget]').hidden = !this._key
    }

    async index() {
        if (!this._index) {
            const response = await fetch(INDEX_URL, { cache : 'no-cache' })
            this._index = (await response.json()).entries
        }
        return this._index
    }

    tokens(text) { return (text.toLowerCase().match(/[a-z0-9][a-z0-9.-]{1,}/g) || []).filter(t => t.length > 2) }

    async search(query) {
        const entries = await this.index()
        const terms   = [...new Set(this.tokens(query))]
        const scored  = []
        for (const entry of entries) {
            const haystacks = [[entry.title, 6], [entry.headings.join(' '), 3], [entry.description, 2], [entry.text, 1]]
            let score = 0
            for (const term of terms) for (const [text, weight] of haystacks) {
                const count = text.toLowerCase().split(term).length - 1
                if (count) score += weight * Math.min(count, 5)
            }
            if (score) scored.push({ score, entry })
        }
        scored.sort((a, b) => b.score - a.score)
        return scored.slice(0, RESULTS).map(({ score, entry }) => ({ path : entry.url, twin : entry.twin, title : entry.title, score, snippet : this.snippet(entry, terms) }))
    }

    snippet(entry, terms) {
        const text  = entry.text
        const lower = text.toLowerCase()
        let at = -1
        for (const term of terms) { at = lower.indexOf(term); if (at >= 0) break }
        if (at < 0) return entry.description.slice(0, 160)
        const start = Math.max(0, at - 70)
        return (start ? '…' : '') + text.slice(start, start + 180).replace(/\n+/g, ' ') + '…'
    }

    async openPage(path) {
        const entries = await this.index()
        const entry   = entries.find(e => e.url === path || e.twin === path || e.url === path + '/' || e.url === path.replace(/\.md$/, '.html'))
        if (!entry) return { error : `no page at ${path}; use list_pages` }
        const response = await fetch(entry.twin, { cache : 'no-cache' })
        const text     = await response.text()
        return { path : entry.url, title : entry.title, markdown : text.slice(0, OPEN_LIMIT), truncated : text.length > OPEN_LIMIT }
    }

    async readNext() {
        const entries = await this.index()
        const events  = readLog().events
        for (const entry of entries) if (!pageState(events, entry.url).read) return { path : entry.url, title : entry.title, description : entry.description }
        return { done : true, note : 'every page is marked read' }
    }

    fileFeedback(text, page) {
        this.emit(READER_EVENTS.note, { text, page : page || location.pathname, via : 'chat' })
        return { filed : true, page : page || location.pathname }
    }

    async tool(name, args) {
        if (name === 'search')        return { results : await this.search(args.query || '') }
        if (name === 'open_page')     return this.openPage(args.path || '')
        if (name === 'list_pages')    return { pages : (await this.index()).map(e => ({ path : e.url, title : e.title })) }
        if (name === 'read_next')     return this.readNext()
        if (name === 'my_feedback')   return { events : readLog().events.filter(e => e.kind !== 'sent').slice(-60) }
        if (name === 'file_feedback') return this.fileFeedback(args.text || '', args.page)
        return { error : `no tool ${name}` }
    }

    system() {
        const version = (document.querySelector('meta[name="sg-secrets:version"]') || {}).content || ''
        return [`You are the reader's assistant on ${location.host}, site version ${version}: a static site about a zero-knowledge secrets manager that runs in the browser, being built in the open from a brief.`,
                `The reader is on ${location.pathname} ("${document.title}").`,
                'Read the site with the tools before answering; cite pages by path. What the site marks "proposed" is designed, not built, and "absent" is deliberately out; never describe either as existing.',
                "When the reader says something should change, be wrong, or be added, file it with file_feedback in their words, then confirm in one line. Keep answers short and concrete."].join(' ')
    }

    async ask() {
        const box  = this.$('[data-ask]')
        const text = box.value.trim()
        if (!text || this._busy) return
        box.value = ''
        this.say('user', text)
        this._busy = true
        try {
            if (this._key && this._allowed) await this.tier1(text)
            else await this.tier0(text)
        } catch (error) {
            this.say('error', `Something failed: ${error.message}`)
        }
        this._busy = false
    }

    async tier0(text) {
        const results = await this.search(text)
        const li      = this.say('assistant', results.length ? `Offline search, ${results.length} page${results.length === 1 ? '' : 's'}:` : 'Offline search found nothing for that; try other words, or add a key for a conversation.')
        const ol = this.el('ol', { class : 'results' })
        for (const result of results) {
            const item = this.el('li')
            item.appendChild(this.el('a', { href : result.path }, result.title))
            item.appendChild(this.el('span', { class : 'snippet' }, ' ' + result.snippet))
            ol.appendChild(item)
        }
        li.appendChild(ol)
        this.speak(li.textContent)
    }

    async tier1(text) {
        if (!this._messages.length) this._messages.push({ role : 'system', content : this.system() })
        this._messages.push({ role : 'user', content : text })
        const thinking = this.say('assistant', '…')
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await fetch(ENDPOINT, {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json', Authorization : `Bearer ${this._key}`, 'HTTP-Referer' : location.origin, 'X-Title' : location.host },
                body    : JSON.stringify({ model : MODEL, messages : this._messages, tools : TOOLS, tool_choice : 'auto', max_tokens : 1200 }),
            })
            if (!response.ok) {
                const detail = await response.text()
                thinking.remove()
                this.say('error', `openrouter.ai answered HTTP ${response.status}: ${detail.slice(0, 200)}`)
                this._messages.pop()
                return
            }
            const data    = await response.json()
            const message = data.choices[0].message
            this._messages.push(message)
            if (message.tool_calls && message.tool_calls.length) {
                for (const call of message.tool_calls) {
                    let args = {}
                    try { args = JSON.parse(call.function.arguments || '{}') } catch (error) { args = {} }
                    this.note(thinking, `${call.function.name}(${Object.values(args).join(', ').slice(0, 80)})`)
                    const result = await this.tool(call.function.name, args)
                    this._messages.push({ role : 'tool', tool_call_id : call.id, content : JSON.stringify(result) })
                }
                continue
            }
            thinking.remove()
            const li = this.say('assistant', '')
            this.render(li, message.content || '')
            this.speak(message.content || '')
            return
        }
        thinking.remove()
        this.say('error', 'The model kept calling tools; stopped after the limit.')
    }

    say(role, text) {
        const ol = this.$('[data-messages]')
        const li = this.el('li', { class : `msg role-${role}` }, text)
        ol.appendChild(li)
        ol.scrollTop = ol.scrollHeight
        return li
    }

    note(li, text) {
        li.appendChild(this.el('span', { class : 'tool' }, text))
    }

    render(li, text) {                                                            // paragraphs, and site paths and URLs as links; no HTML from the model
        li.replaceChildren()
        for (const paragraph of text.split(/\n{2,}/)) {
            const p = this.el('p')
            for (const part of paragraph.split(/(https?:\/\/\S+|(?<![\w/])\/[a-z0-9][a-z0-9/._-]*)/g)) {
                if (/^https?:\/\//.test(part) || /^\/[a-z0-9]/.test(part)) p.appendChild(this.el('a', { href : part.replace(/[.,)]+$/, ''), target : '_top' }, part))
                else p.appendChild(document.createTextNode(part))
            }
            li.appendChild(p)
        }
    }

    speak(text) {
        if (!this.$('[data-speak]').checked || !('speechSynthesis' in window) || !text) return
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0, 1200)))
    }
}

customElements.define('reader-chat', ReaderChat)
