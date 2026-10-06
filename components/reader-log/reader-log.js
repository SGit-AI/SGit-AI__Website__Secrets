/**
 * reader-log — the reader's log for this page: read, star, up or down, a note
 * (typed or dictated), every action one event in an append-only log in
 * localStorage, keyed by page path and a hash of the page's text so a note
 * written against an older version says so. Undo is another event, never a
 * deletion. "Send to the agent" seals the unsent events to the build agent's
 * public key (the sgit PKI envelope, made here with WebCrypto) and writes them
 * to the readers lane of the comms vault named in /.well-known/sgit-agents.json.
 * "Copy for Claude" puts the same on the clipboard as markdown with JSON, and
 * "Paste to merge" takes it back on another device. Nothing leaves the page
 * without a click, and nothing here is secret.
 *
 * @module reader-log
 * @version 0.1.0
 */
import { SgBase, READER_EVENTS } from '../sg-base/sg-base.js'
import { LOCAL_STORAGE_KEYS }    from '../../app/config/storage-keys.js'

export const LOG_VERSION  = 1
export const CONTACT_URL  = '/.well-known/sgit-agents.json'
export const LANE_NAME    = 'readers'
export const READER_PAGE  = '/reader/'                                             // the one page whose policy allows the connection to the vault endpoint
export const MARKS        = Object.freeze({ read : ['read', 'unread'], star : ['star', 'unstar'], up : ['up', 'unvote'], down : ['down', 'unvote'] })
const SHOWN_PER_PAGE      = 30

export function readLog() {                                                       // the whole log; empty when storage is absent or unreadable
    try {
        const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.readerLog) || 'null')
        if (data && data.v === LOG_VERSION && Array.isArray(data.events)) return data
    } catch (error) { /* fall through */ }
    return { v : LOG_VERSION, events : [] }
}

export function pageState(events, page) {                                         // what the last events say about one page
    const state = { read : false, star : false, vote : null }
    for (const event of events) {
        if (event.page !== page) continue
        if (event.kind === 'read')   state.read = true
        if (event.kind === 'unread') state.read = false
        if (event.kind === 'star')   state.star = true
        if (event.kind === 'unstar') state.star = false
        if (event.kind === 'up' || event.kind === 'down') state.vote = event.kind
        if (event.kind === 'unvote') state.vote = null
    }
    return state
}

export function unsentEvents(events) {                                            // every event no `sent` event has listed
    const sent = new Set()
    for (const event of events) if (event.kind === 'sent') for (const id of event.ids || []) sent.add(id)
    return events.filter(event => event.kind !== 'sent' && !sent.has(event.id))
}

export async function textHash(text) {                                            // 16 hex of SHA-256 over the page's text, whitespace folded
    const data   = new TextEncoder().encode(text.replace(/\s+/g, ' ').trim())
    const digest = await crypto.subtle.digest('SHA-256', data)
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

function pemToDer(pem) {
    const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
    return Uint8Array.from(atob(body), c => c.charCodeAt(0))
}

function toBase64(bytes) {
    let binary = ''
    for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
    return btoa(binary)
}

export async function seal(recipientPem, plaintext) {                             // the sgit PKI envelope v2, then base64 again for the lane
    const publicKey  = await crypto.subtle.importKey('spki', pemToDer(recipientPem), { name : 'RSA-OAEP', hash : 'SHA-256' }, false, ['encrypt'])
    const aesKey     = await crypto.subtle.generateKey({ name : 'AES-GCM', length : 256 }, true, ['encrypt'])
    const iv         = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt({ name : 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext))
    const rawKey     = await crypto.subtle.exportKey('raw', aesKey)
    const wrapped    = await crypto.subtle.encrypt({ name : 'RSA-OAEP' }, publicKey, rawKey)
    const envelope   = JSON.stringify({ v : 2, w : toBase64(wrapped), i : toBase64(iv), c : toBase64(ciphertext) })
    return btoa(btoa(envelope))                                                   // the envelope is ASCII; the lane payload is base64 of the .enc, which is base64 itself
}

export class ReaderLog extends SgBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'reader-log' }

    async onReady() {
        this._page  = location.pathname
        this._title = document.title.split(' — ')[0]
        this._hash  = await textHash((document.querySelector('main') || document.body).innerText || '')
        this.$('[data-page-title]').textContent = this._title
        this.$('[data-hash]').textContent       = this._hash
        this.$('[data-marks]').addEventListener('click', (event) => {
            const button = event.target.closest('[data-mark]')
            if (button) this.mark(button.dataset.mark)
        })
        this.$('[data-note-form]').addEventListener('submit', (event) => { event.preventDefault(); this.addNote() })
        this.$('[data-send]').addEventListener('click',         () => this.send())
        this.$('[data-copy]').addEventListener('click',         () => this.copy())
        this.$('[data-paste-toggle]').addEventListener('click', () => { const form = this.$('[data-paste-form]'); form.hidden = !form.hidden })
        this.$('[data-paste-form]').addEventListener('submit', (event) => { event.preventDefault(); this.merge() })
        const mic = this.$('[data-mic]')
        if (SgBase.speechRecognition()) {
            mic.hidden = false
            mic.addEventListener('click', () => this.dictate(mic, (text) => { const note = this.$('[data-note]'); note.value = (note.value ? note.value + ' ' : '') + text }))
        }
        this.on(READER_EVENTS.note, (event) => this.append('note', { text : event.detail.text, page : event.detail.page || this._page, via : event.detail.via || 'chat' }))
        this.render()
        this.contact()
    }

    append(kind, extra = {}) {
        const log   = readLog()
        const event = { id : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, t : new Date().toISOString(),
                        page : this._page, hash : this._hash, title : this._title, kind, ...extra }
        log.events.push(event)
        try { localStorage.setItem(LOCAL_STORAGE_KEYS.readerLog, JSON.stringify(log)) } catch (error) { this.status('Storage is blocked in this browser; nothing was kept.') }
        this.render()
        return event
    }

    mark(name) {
        const state = pageState(readLog().events, this._page)
        const [on, off] = MARKS[name]
        if (name === 'read') this.append(state.read ? off : on)
        else if (name === 'star') this.append(state.star ? off : on)
        else this.append(state.vote === on ? off : on)
    }

    addNote() {
        const note = this.$('[data-note]')
        const text = note.value.trim()
        if (!text) return
        this.append('note', { text })
        note.value = ''
    }

    render() {
        const log    = readLog()
        const state  = pageState(log.events, this._page)
        const marks  = { read : state.read, star : state.star, up : state.vote === 'up', down : state.vote === 'down' }
        for (const button of this.$$('[data-mark]')) button.setAttribute('aria-pressed', marks[button.dataset.mark] ? 'true' : 'false')
        const here   = log.events.filter(event => event.page === this._page && event.kind !== 'sent')
        const unsent = unsentEvents(log.events)
        this.$('[data-count-page]').textContent   = String(here.length)
        this.$('[data-count-unsent]').textContent = String(unsent.length)
        this.$('[data-count-all]').textContent    = String(log.events.filter(e => e.kind !== 'sent').length)
        this.list(this.$('[data-events-page]'), here.slice(-SHOWN_PER_PAGE).reverse(), true)
        this.list(this.$('[data-events-all]'),  log.events.filter(e => e.kind !== 'sent').slice(-200).reverse(), false)
        this.$('[data-send]').disabled = !(this._lane && unsent.length)
        this.emit(READER_EVENTS.log, { count : log.events.length, unsent : unsent.length })
    }

    list(ol, events, samePage) {
        ol.replaceChildren()
        if (!events.length) { ol.appendChild(this.el('li', { class : 'empty' }, 'nothing yet')); return }
        for (const event of events) {
            const li = this.el('li', { class : `event kind-${event.kind}` })
            li.appendChild(this.el('time', { datetime : event.t }, event.t.slice(0, 16).replace('T', ' ')))
            li.appendChild(this.el('span', { class : 'kind' }, event.kind))
            if (!samePage) li.appendChild(this.el('a', { href : event.page, class : 'page' }, event.title || event.page))
            if (event.text) li.appendChild(this.el('span', { class : 'text' }, event.text))
            if (samePage && event.hash && event.hash !== this._hash) li.appendChild(this.el('span', { class : 'changed', title : `written against text ${event.hash}; the page now hashes ${this._hash}` }, 'page changed since'))
            ol.appendChild(li)
        }
    }

    status(text) { this.$('[data-status]').textContent = text }

    async contact() {                                                             // where Send goes, read from the contact file; absent or pending means Copy instead
        try {
            const response = await fetch(CONTACT_URL, { cache : 'no-cache' })
            const data     = await response.json()
            const identity = Object.values(data.identities || {})[0] || {}
            const inbox    = identity.inbox || {}
            const lane     = (inbox.lanes || []).find(l => l.name === LANE_NAME)
            if (inbox.status === 'open' && lane && identity.bundle && identity.bundle.encrypt && !SgBase.mayConnect(inbox.endpoint.replace(/\/$/, ''))) {
                this._lane = null
                this.status(`Send runs on ${READER_PAGE}, the one page whose policy allows the connection to ${inbox.endpoint}; your log is the same there. Or Copy for Claude.`)
            } else if (inbox.status === 'open' && lane && identity.bundle && identity.bundle.encrypt) {
                this._lane = { endpoint : inbox.endpoint.replace(/\/$/, ''), vault : inbox.vault, token : lane.append_token, pem : identity.bundle.encrypt, to : identity.address }
                this.status(`Send goes to ${identity.address}, sealed to ${identity.fingerprint}; only the agent can read it.`)
            } else {
                this._lane = null
                this.status(`The agent's lane is ${inbox.status || 'absent'}: ${inbox.status_note || 'use Copy for Claude.'}`)
            }
        } catch (error) {
            this._lane = null
            this.status('The agent contact file could not be read; use Copy for Claude.')
        }
        this.render()
    }

    message(events) {
        return { schema : 'reader-message/v1', site : location.host, sent : new Date().toISOString(), via : 'the reader\'s column',
                 siteVersion : (document.querySelector('meta[name="sg-secrets:version"]') || {}).content || '', events }
    }

    async send() {
        if (!this._lane) return
        const events = unsentEvents(readLog().events)
        if (!events.length) return
        this.status('Sealing and sending…')
        try {
            const payload  = await seal(this._lane.pem, JSON.stringify(this.message(events)))
            const response = await fetch(`${this._lane.endpoint}/api/vault/append/write/${this._lane.vault}`, {
                method : 'POST', headers : { 'Content-Type' : 'application/json' }, body : JSON.stringify({ append_token : this._lane.token, payload }) })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            this.append('sent', { ids : events.map(e => e.id), lane : LANE_NAME, to : this._lane.to })
            this.status(`Sent ${events.length} event${events.length === 1 ? '' : 's'} to ${this._lane.to}. The agent reads the lane at its next session.`)
        } catch (error) {
            this.status(`Not sent (${error.message}); nothing was lost, use Copy for Claude.`)
        }
    }

    markdown(events) {
        const lines = [`# Reader's log from ${location.host} (site v${this.message([]).siteVersion}, ${new Date().toISOString().slice(0, 10)})`, '']
        for (const event of events) lines.push(`- ${event.t.slice(0, 16)} ${event.page} **${event.kind}**${event.text ? ': ' + event.text : ''}`)
        lines.push('', '```json', JSON.stringify(this.message(events), null, 1), '```', '')
        return lines.join('\n')
    }

    async copy() {
        const events = unsentEvents(readLog().events)
        const text   = this.markdown(events.length ? events : readLog().events.filter(e => e.kind !== 'sent'))
        try {
            await navigator.clipboard.writeText(text)
            this.status(`Copied ${events.length || 'all'} event(s) as markdown with JSON. Paste it to Claude, or into another device's "Paste to merge".`)
        } catch (error) {
            const form = this.$('[data-paste-form]')
            form.hidden = false
            this.$('[data-paste]').value = text
            this.status('The clipboard is not available here; the text is in the box below, select and copy it.')
        }
    }

    merge() {
        const raw   = this.$('[data-paste]').value
        const match = raw.match(/```json\s*([\s\S]*?)```/) || [null, raw]
        try {
            const data   = JSON.parse(match[1])
            const events = Array.isArray(data) ? data : (data.events || [])
            const log    = readLog()
            const known  = new Set(log.events.map(e => e.id))
            let added    = 0
            for (const event of events) if (event && event.id && !known.has(event.id)) { log.events.push(event); added++ }
            log.events.sort((a, b) => (a.t || '').localeCompare(b.t || ''))
            localStorage.setItem(LOCAL_STORAGE_KEYS.readerLog, JSON.stringify(log))
            this.$('[data-paste]').value = ''
            this.status(`Merged ${added} new event(s).`)
            this.render()
        } catch (error) {
            this.status('That is not something "Copy for Claude" produced; nothing merged.')
        }
    }
}

customElements.define('reader-log', ReaderLog)
