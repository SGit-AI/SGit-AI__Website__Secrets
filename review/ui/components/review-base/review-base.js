/**
 * review-base — the base component every visualiser extends, and the shared store.
 *
 * A sibling of the tools' SgComponent with the same contract (brief-corrections R2):
 * `static jsUrl = import.meta.url` to locate itself, `resourceName`, `sharedCssPaths`,
 * `onReady()` instead of `connectedCallback`. Styles enter the shadow root as <link>
 * elements, never as inline <style>, because the site's CSP is style-src 'self'.
 *
 * The store reads the review folder's JSON files by path (an inlined bundle on
 * window.__REVIEW_BUNDLE__ is the fallback for the vault host), indexes every node
 * by id with its layer, parent and children, holds the route in a variable, and
 * emits events through document. It never assigns location.hash.
 *
 * @module review-base
 * @version 0.1.0
 */

export const REVIEW_EVENTS = Object.freeze({
    select : 'review:select',
    route  : 'review:route',
    set    : 'review:set',
    loaded : 'review:loaded',
})

export const LAYERS = Object.freeze({
    story       : { label : 'story'       , group : 'stories'    , rank : 1 },
    rule        : { label : 'rule'        , group : 'stories'    , rank : 2 },
    example     : { label : 'example'     , group : 'stories'    , rank : 3 },
    flow        : { label : 'flow'        , group : 'flows'      , rank : 4 },
    step        : { label : 'step'        , group : 'flows'      , rank : 5 },
    component   : { label : 'component'   , group : 'components' , rank : 6 },
    environment : { label : 'environment' , group : 'deploy'     , rank : 7 },
    resource    : { label : 'resource'    , group : 'deploy'     , rank : 8 },
    pipeline    : { label : 'pipeline'    , group : 'deploy'     , rank : 9 },
    job         : { label : 'job'         , group : 'deploy'     , rank : 10 },
})

export const VIEWS = Object.freeze(['stories', 'flows', 'components', 'deploy'])

const INTENT_FILES = Object.freeze(['stories', 'flows', 'components', 'deploy', 'sections'])
const UI_URL       = new URL('../../', import.meta.url)                         // review/ui/
const REVIEW_URL   = new URL('../', UI_URL)                                     // review/

class ReviewStore {

    constructor() {
        this.set      = 'project'
        this.nodes    = new Map()
        this.edges    = []
        this.sections = { sections : {} }
        this.route    = { view : 'stories', node : null }
        this.loaded   = null
        this._verbs   = {}
    }

    folderUrl() {
        return this.set === 'self' ? new URL('self/', REVIEW_URL) : REVIEW_URL
    }

    async readJson(relative) {                                                    // relative to the set's folder; bundle first, then the file
        const bundle = window.__REVIEW_BUNDLE__
        const key    = `${this.set}/${relative}`
        if (bundle && bundle[key]) return bundle[key]
        const response = await fetch(new URL(relative, this.folderUrl()), { cache : 'no-cache' })
        if (!response.ok) throw new Error(`${relative}: HTTP ${response.status}`)
        return response.json()
    }

    standalone() {                                                                // on its own page (not the vault host, not framed)
        return !window.sg && window.top === window.self
    }

    async load(setName = this.set) {
        this.set = setName
        this.nodes.clear()
        this.edges = []
        const files = {}
        for (const name of INTENT_FILES) {
            try { files[name] = await this.readJson(`intent/${name}.json`) } catch (error) { files[name] = null }
        }
        try { this._verbs = (await this.readJson('../tools/verbs.json')).verbs } catch (error) { this._verbs = {} }
        this.sections = files.sections || { sections : {} }
        this.index(files)
        this.loaded = files
        this.emit(REVIEW_EVENTS.loaded, { set : setName, counts : this.counts() })
        this.emit(REVIEW_EVENTS.set, { set : setName })
        if (this.standalone()) this.readRouteFromUrl()
    }

    add(id, layer, name, record, parent, source, extra = {}) {
        const node = { id, layer, name, record, parent, source, children : [], ...extra }
        this.nodes.set(id, node)
        if (parent && this.nodes.has(parent)) this.nodes.get(parent).children.push(id)
        return node
    }

    index(files) {
        const stories = files.stories ? files.stories.stories : []
        for (const story of stories) {
            this.add(story.id, 'story', story.name, story, null, story.source)
            for (const rule of story.rules || []) {
                this.add(rule.id, 'rule', rule.name, rule, story.id, rule.source)
                for (const example of rule.examples || []) {
                    this.add(example.id, 'example', example.name, example, rule.id, example.source, { surface : example.surface })
                }
            }
        }
        for (const flow of files.flows ? files.flows.flows : []) {
            this.add(flow.id, 'flow', flow.name, flow, null, flow.source)
            for (const step of flow.steps || []) {
                this.add(`${flow.id}#${step.n}`, 'step', `${step.n}. ${step.text}`, step, flow.id, step.source || flow.source, { surface : step.surface })
            }
            for (const storyId of flow.serves || []) this.edges.push({ from : flow.id, to : storyId, verb : 'serves', source : flow.source })
        }
        const components = files.components ? files.components.components : []
        for (const component of components) this.add(component.id, 'component', component.name, component, null, component.source)
        for (const component of components) {                                    // parents after every node exists, so order in the file does not matter
            if (component.parent && this.nodes.has(component.parent)) {
                this.nodes.get(component.id).parent = component.parent
                this.nodes.get(component.parent).children.push(component.id)
            }
        }
        for (const edge of files.components ? files.components.edges : []) this.edges.push(edge)
        const deploy = files.deploy
        if (deploy) {
            for (const env of deploy.environments) this.add(env.id, 'environment', env.name, env, null, env.source)
            for (const resource of deploy.resources) this.add(resource.id, 'resource', resource.name, resource, resource.environment, resource.source)
            for (const pipeline of deploy.pipelines) {
                this.add(pipeline.id, 'pipeline', pipeline.name, pipeline, null, pipeline.source)
                for (const job of pipeline.jobs || []) this.add(job.id, 'job', job.name, job, pipeline.id, job.source || pipeline.source)
            }
            for (const edge of deploy.edges) this.edges.push(edge)
        }
    }

    counts() {
        const counts = {}
        for (const node of this.nodes.values()) counts[node.layer] = (counts[node.layer] || 0) + 1
        return counts
    }

    get(id) { return this.nodes.get(id) || null }

    roots(view) {
        return [...this.nodes.values()].filter(node => LAYERS[node.layer].group === view && !node.parent)
    }

    ancestors(id) {                                                               // root first, the node last
        const path = []
        let node = this.get(id)
        while (node) { path.unshift(node); node = node.parent ? this.get(node.parent) : null }
        return path
    }

    edgesOf(id) {
        const out = this.edges.filter(edge => edge.from === id).map(edge => ({ ...edge, direction : 'out' }))
        const inn = this.edges.filter(edge => edge.to === id).map(edge => ({ ...edge, direction : 'in', verb : this.inverse(edge.verb) }))
        return out.concat(inn)
    }

    inverse(verb) { return (this._verbs[verb] && this._verbs[verb].inverse) || `${verb} (inverse)` }

    sentence(verb) { return (this._verbs[verb] && this._verbs[verb].sentence) || '' }

    sectionLink(source) {                                                         // where in the rendered brief a projected node came from
        if (!source || !source.section) return null
        const entry = this.sections.sections[source.section]
        const page  = this.sections.page || `/${source.doc.replace(/\.md$/, '.html')}`
        return { href : entry ? `${page}#${entry.anchor}` : page, title : entry ? entry.title : `section ${source.section}` }
    }

    select(id) {
        const node = this.get(id)
        if (!node) return
        this.route = { view : LAYERS[node.layer].group, node : id }
        this.emit(REVIEW_EVENTS.select, { id, node })
        this.writeRouteToUrl()
    }

    show(view) {
        if (!VIEWS.includes(view)) return
        this.route = { view, node : null }
        this.emit(REVIEW_EVENTS.route, { view })
        this.writeRouteToUrl()
    }

    writeRouteToUrl() {                                                           // standalone only, and never by assigning location.hash
        if (!this.standalone()) return
        const value = this.route.node ? `node=${encodeURIComponent(this.route.node)}` : `view=${this.route.view}`
        history.replaceState(null, '', `#${value}`)
    }

    readRouteFromUrl() {
        const hash = location.hash.replace(/^#/, '')
        if (hash.startsWith('node=')) this.select(decodeURIComponent(hash.slice(5)))
        else if (hash.startsWith('view=')) this.show(hash.slice(5))
        else this.show('stories')
    }

    emit(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { detail, bubbles : true, composed : true }))
    }
}

const store = new ReviewStore()

export class ReviewBase extends HTMLElement {
    static jsUrl = import.meta.url

    static get store() { return store }

    get resourceName() { return 'review-base' }

    get sharedCssPaths() { return [new URL('tokens.css', UI_URL).href] }

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

    emit(name, detail) { store.emit(name, detail) }

    el(tag, attrs = {}, text = null) {                                           // a small element builder; no innerHTML with data in it
        const node = document.createElement(tag)
        for (const [key, value] of Object.entries(attrs)) {
            if (key.startsWith('data-')) node.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
            else node.setAttribute(key, value)
        }
        if (text !== null) node.textContent = text
        return node
    }
}

customElements.define('review-base', ReviewBase)

if (!store.loaded) store.load('project')
