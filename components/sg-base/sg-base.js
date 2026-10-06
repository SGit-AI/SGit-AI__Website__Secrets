/**
 * sg-base — the base component for the site's own components (the reader's
 * column and what it holds), in the coding.sgit.ai shape and the same contract
 * as review-base: `static jsUrl = import.meta.url` to locate itself,
 * `resourceName`, `sharedCssPaths`, `onReady()` instead of `connectedCallback`.
 * Markup and styles come from the two sibling files as a fetched fragment and
 * a <link>, never inline, because the site's CSP is style-src 'self'. Design
 * tokens need no link: every --sg-* custom property is set on :root by
 * assets/themes.css and assets/site.css and inherits through the shadow root,
 * so a component follows the picked theme with no code of its own.
 *
 * Events go through document, namespaced `reader:`, bubbles and composed.
 *
 * @module sg-base
 * @version 0.1.0
 */

export const READER_EVENTS = Object.freeze({
    note   : 'reader:note',                                                       // { text, page? }: file a note in the reader's log (the chat's file_feedback tool uses it)
    log    : 'reader:log',                                                        // { count }: the log changed
    open   : 'reader:open',                                                       // { tab }: open the column on a tab
})

export class SgBase extends HTMLElement {
    static jsUrl = import.meta.url

    get resourceName() { return 'sg-base' }

    get sharedCssPaths() { return [] }

    get resourceUrl() { return new URL(`../${this.resourceName}/${this.resourceName}`, this.constructor.jsUrl) }

    constructor() {
        super()
        this._listeners = []
        this._ready     = false
    }

    async connectedCallback() {
        if (this._ready) return
        this.attachShadow({ mode : 'open' })
        for (const href of this.sharedCssPaths.concat([`${this.resourceUrl.href}.css`])) {
            const link = document.createElement('link')
            link.rel  = 'stylesheet'
            link.href = href
            this.shadowRoot.appendChild(link)
        }
        try {
            const response = await fetch(`${this.resourceUrl.href}.html`, { cache : 'no-cache' })
            const holder   = document.createElement('div')
            holder.innerHTML = await response.text()
            while (holder.firstChild) this.shadowRoot.appendChild(holder.firstChild)
        } catch (error) {
            const note = document.createElement('p')
            note.textContent = `${this.resourceName}: markup failed to load (${error.message})`
            this.shadowRoot.appendChild(note)
        }
        this._ready = true
        this.onReady()
    }

    disconnectedCallback() {
        for (const [name, handler] of this._listeners) document.removeEventListener(name, handler)
        this._listeners = []
    }

    onReady() {}

    $(selector)  { return this.shadowRoot.querySelector(selector) }

    $$(selector) { return [...this.shadowRoot.querySelectorAll(selector)] }

    on(name, handler) {
        document.addEventListener(name, handler)
        this._listeners.push([name, handler])
    }

    emit(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { detail, bubbles : true, composed : true }))
    }

    el(tag, attrs = {}, text = null) {                                           // a small element builder; no innerHTML with data in it
        const node = document.createElement(tag)
        for (const [key, value] of Object.entries(attrs)) {
            if (key.startsWith('data-')) node.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
            else node.setAttribute(key, value)
        }
        if (text !== null) node.textContent = text
        return node
    }

    static mayConnect(host) {                                                   // whether this page's Content-Security-Policy allows a connection to host
        const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
        if (!meta) return true
        const connect = (meta.content.split(';').find(part => part.trim().startsWith('connect-src')) || '')
        return connect.includes(host)
    }

    static speechRecognition() {                                                  // the browser's own speech-to-text, where it exists; nothing is loaded for it
        return window.SpeechRecognition || window.webkitSpeechRecognition || null
    }

    dictate(button, onText) {                                                     // one utterance into onText; the button shows the state
        const Recognition = SgBase.speechRecognition()
        if (!Recognition) return
        const recognition = new Recognition()
        recognition.lang           = document.documentElement.lang || 'en'
        recognition.interimResults = false
        recognition.maxAlternatives = 1
        button.setAttribute('aria-pressed', 'true')
        recognition.addEventListener('result', (event) => onText(event.results[0][0].transcript))
        recognition.addEventListener('end',    () => button.setAttribute('aria-pressed', 'false'))
        recognition.addEventListener('error',  () => button.setAttribute('aria-pressed', 'false'))
        recognition.start()
    }
}

customElements.define('sg-base', SgBase)
