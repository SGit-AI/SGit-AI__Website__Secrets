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
    select  : 'review:select',
    route   : 'review:route',
    section : 'review:section',                                                  // { id }: a section of the brief is in focus, shown in place
    file    : 'review:file',                                                     // { path, lines }: a file of the repository is in focus, shown in place
    set     : 'review:set',
    loaded  : 'review:loaded',
    mode    : 'review:mode',                                                     // { mode }: intent or code; the shell lays the regions out for it
    graph   : 'review:graph',                                                    // { loaded }: the derived code layers were read
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
    claim       : { label : 'claim'       , group : 'claims'     , rank : 11 },
    release     : { label : 'release'     , group : 'claims'     , rank : 12 },
    anchor      : { label : 'anchor'      , group : 'claims'     , rank : 13 },
    file        : { label : 'file'        , group : 'code'       , rank : 14 },
    class       : { label : 'class'       , group : 'code'       , rank : 15 },
    method      : { label : 'method'      , group : 'code'       , rank : 16 },
    test        : { label : 'test'        , group : 'code'       , rank : 17 },
    surface     : { label : 'surface'     , group : 'code'       , rank : 18 },
})

export const CODE_LAYERS = Object.freeze(['file', 'class', 'method', 'test', 'surface'])
const GRAPH_FILES = Object.freeze(['files', 'modules', 'classes', 'methods', 'tests', 'surfaces'])

export const VIEWS = Object.freeze(['stories', 'flows', 'components', 'deploy', 'claims', 'brief', 'code'])

const INTENT_FILES = Object.freeze(['stories', 'flows', 'components', 'deploy', 'sections', 'claims'])
const UI_URL       = new URL('../../', import.meta.url)                         // review/ui/
const REVIEW_URL   = new URL('../', UI_URL)                                     // review/

class ReviewStore {

    constructor() {
        this.set      = 'project'
        this.nodes    = new Map()
        this.edges    = []
        this.sections = { sections : {} }
        this.route    = { view : 'stories', node : null, section : null, file : null, lines : null }
        this.brief    = null                                                      // brief/index.json, read on first use
        this.graph    = null                                                      // the derived layers, read on first use (they are large)
        this.graphIndex = null                                                    // graph/index.json: their counts and file paths, read with the intent
        this.mode     = 'intent'
        this.byPath   = new Map()                                                 // file path -> file node id
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

    standalone() {                                                                // the navigator shell on its own page (not the vault host, not framed, not a site page embedding a component)
        return !window.sg && window.top === window.self && document.documentElement.hasAttribute('data-review-shell')
    }

    async load(setName = this.set) {
        this.set = setName
        this.nodes.clear()
        this.edges = []
        const files = {}
        for (const name of INTENT_FILES) {
            try { files[name] = await this.readJson(`intent/${name}.json`) } catch (error) { files[name] = null }
        }
        try {                                                                     // the verbs live in review/tools/ for both sets
            const bundle = window.__REVIEW_BUNDLE__
            const verbs  = bundle && bundle['tools/verbs.json'] ? bundle['tools/verbs.json'] : await (await fetch(new URL('tools/verbs.json', REVIEW_URL), { cache : 'no-cache' })).json()
            this._verbs  = verbs.verbs
        } catch (error) { this._verbs = {} }
        this.sections = files.sections || { sections : {} }
        try { this.graphIndex = await this.readJson('graph/index.json') } catch (error) { this.graphIndex = null }   // counts and paths of the derived layers, before they load
        this.index(files)
        this.loaded = files
        this.emit(REVIEW_EVENTS.loaded, { set : setName, counts : this.counts() })
        this.emit(REVIEW_EVENTS.set, { set : setName })
        if (this.standalone()) {
            this.readRouteFromUrl()
            if (!this._hashing) { this._hashing = true; window.addEventListener('hashchange', () => this.readRouteFromUrl()) }   // a same-page link to another route
        }
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
        const claims = files.claims
        if (claims) {                                                             // the claims layer: claims, releases, anchors; edges to the intent and between them
            for (const claim of claims.claims) this.add(claim.id, 'claim', claim.name, claim, null, claim.source, { area : claim.area, status : claim.status })
            for (const release of claims.releases) this.add(release.id, 'release', release.name, release, null, null)
            for (const anchor of claims.anchors) this.add(anchor.id, 'anchor', anchor.name, anchor, null, null, { kind : anchor.kind, href : anchor.href, opens : anchor.opens, anchor : true })
            for (const edge of claims.edges) this.edges.push(edge)
        }
    }

    counts() {                                                                    // per layer; the derived layers from the index until they load
        const counts = {}
        for (const node of this.nodes.values()) counts[node.layer] = (counts[node.layer] || 0) + 1
        if (!this.graph && this.graphIndex) for (const [layer, key] of [['file', 'files'], ['class', 'classes'], ['method', 'methods'], ['test', 'tests'], ['surface', 'surfaces']]) counts[layer] = this.graphIndex.counts[key] || 0
        return counts
    }

    get(id) { return this.nodes.get(id) || null }

    roots(view) {
        if (view === 'claims') return [...this.nodes.values()].filter(node => node.layer === 'claim')
        if (view === 'code') return [...this.nodes.values()].filter(node => node.layer === 'file' || (node.layer === 'surface' && !node.parent))
        return [...this.nodes.values()].filter(node => LAYERS[node.layer].group === view && !node.parent)
    }

    async loadGraph() {                                                           // graph/*.json: files, modules, classes, methods, tests, surfaces; once
        if (this.graph) return this.graph
        const files = {}
        for (const name of GRAPH_FILES) {
            try { files[name] = await this.readJson(`graph/${name}.json`) } catch (error) { files[name] = null }
        }
        this.graph = files
        this.indexGraph(files)
        this.emit(REVIEW_EVENTS.graph, { loaded : Boolean(files.files) })
        return files
    }

    indexGraph(files) {
        const modules = new Map((files.modules ? files.modules.modules : []).map(m => [m.id, m]))
        for (const file of files.files ? files.files.files : []) {
            const module = file.module ? modules.get(file.module) : null
            this.add(file.id, 'file', file.path, { ...file, module : module || null }, null, { path : file.path, line : 1, end : file.lines, sha256 : file.sha256 }, { path : file.path, language : file.language, doc : module ? module.doc : (file.summary && file.summary.doc) || '' })
            this.byPath.set(file.path, file.id)
        }
        for (const cls of files.classes ? files.classes.classes : []) {
            const fileId = this.byPath.get(cls.source.path)
            this.add(cls.id, 'class', cls.name, cls, fileId || null, cls.source, { path : cls.source.path, doc : cls.doc || '' })
        }
        for (const method of files.methods ? files.methods.methods : []) {
            const parent = method.class || this.byPath.get(method.source.path) || null
            this.add(method.id, 'method', method.signature || method.name, method, parent, method.source, { path : method.source.path, doc : method.doc || '', calls : method.calls })
        }
        for (const test of files.tests ? files.tests.tests : []) this.add(test.id, 'test', test.name, test, this.byPath.get(test.path) || null, test.source, { path : test.path })
        for (const surface of files.surfaces ? files.surfaces.surfaces : []) this.add(surface.id, 'surface', `${surface.kind}: ${surface.name}`, surface, null, surface.source, { path : surface.path || '', kind : surface.kind })
        for (const name of GRAPH_FILES) for (const edge of (files[name] && files[name].edges) || []) this.edges.push(edge)
    }

    fileNode(path) { return this.byPath.has(path) ? this.get(this.byPath.get(path)) : null }
    knownPath(path) { return this.byPath.has(path) || Boolean(this.graphIndex && this.graphIndex.paths.includes(path)) }   // a served file the derivation saw

    setMode(mode) {
        if (this.mode === mode) return
        this.mode = mode
        this.emit(REVIEW_EVENTS.mode, { mode })
    }

    async briefIndex() {                                                          // the brief's table of contents, from brief/index.json
        if (!this.brief) {
            try { this.brief = await this.readJson('brief/index.json') } catch (error) { this.brief = { sections : [] } }
        }
        return this.brief
    }

    async briefSection(id) {                                                      // -> { section, subsection } for an id like 8 or 8.7
        const index = await this.briefIndex()
        const top   = id.split('.')[0]
        const entry = index.sections.find(s => s.id === top)
        if (!entry) return null
        const section = await this.readJson(`brief/${entry.file}`)
        return { section, subsection : id.includes('.') ? (section.subsections.find(s => s.id === id) || null) : null }
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
        const code = CODE_LAYERS.includes(node.layer)
        this.route = { view : LAYERS[node.layer].group, node : id, section : null, file : null, lines : null }
        this.setMode(code ? 'code' : 'intent')
        this.emit(REVIEW_EVENTS.select, { id, node })
        if (code && node.path) {                                                  // the source shows beside the node, its lines marked
            const lines = node.source && node.source.line ? `L${node.source.line}-L${node.source.end}` : null
            this.emit(REVIEW_EVENTS.file, { path : node.path, lines, node : id })
        }
        this.writeRouteToUrl()
    }

    show(view) {
        if (!VIEWS.includes(view)) return
        this.route = { view, node : null, section : null, file : null, lines : null }
        this.setMode(view === 'code' ? 'code' : 'intent')
        if (view === 'code') this.loadGraph().then(() => this.emit(REVIEW_EVENTS.route, { view }))
        this.emit(REVIEW_EVENTS.route, { view })
        this.writeRouteToUrl()
    }

    showSection(id) {                                                             // a section of the brief, in place; the navigator is not left
        this.route = { view : 'brief', node : null, section : id, file : null, lines : null }
        this.setMode('intent')
        this.emit(REVIEW_EVENTS.section, { id })
        this.writeRouteToUrl()
    }

    async showFile(path, lines = null) {                                           // a file of the repository, in place, in code mode
        await this.loadGraph()
        const file = this.fileNode(path)
        this.route = { view : 'code', node : file ? file.id : this.route.node, section : null, file : path, lines }
        this.setMode('code')
        if (file) this.emit(REVIEW_EVENTS.select, { id : file.id, node : file })
        this.emit(REVIEW_EVENTS.file, { path, lines, node : file ? file.id : null })
        this.writeRouteToUrl()
    }

    writeRouteToUrl() {                                                           // standalone only, and never by assigning location.hash
        if (!this.standalone()) return
        const value = this.route.file ? `file=${this.route.file}${this.route.lines ? '&lines=' + this.route.lines : ''}`
                    : this.route.section ? `section=${this.route.section}`
                    : this.route.node ? `node=${encodeURIComponent(this.route.node).replace(/%3A/g, ':').replace(/%2F/g, '/')}` : `view=${this.route.view}`   // ids keep their : and / readable
        history.replaceState(null, '', `#${value}`)
    }

    readRouteFromUrl() {
        const hash = location.hash.replace(/^#/, '')
        if (hash.startsWith('node=')) { const id = decodeURIComponent(hash.slice(5)); if (/^(file|class|method|test|surface|module):/.test(id)) this.loadGraph().then(() => this.select(id)); else this.select(id) }
        else if (hash.startsWith('section=')) this.showSection(hash.slice(8))
        else if (hash.startsWith('file=')) { const [path, rest] = hash.slice(5).split('&lines='); this.showFile(decodeURIComponent(path), rest || null) }
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
            if (value === null || value === undefined) continue
            if (key.startsWith('data-')) node.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
            else node.setAttribute(key, value)
        }
        if (text !== null) node.textContent = text
        return node
    }
}

customElements.define('review-base', ReviewBase)

if (!store.loaded) store.load('project')
