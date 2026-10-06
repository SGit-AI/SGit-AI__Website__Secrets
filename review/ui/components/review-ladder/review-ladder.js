/**
 * review-ladder — the layers of the review folder as a rail, top to bottom in
 * the brief's order: the intent (stories, rules, examples, flows, steps,
 * components), the derived code (surfaces, modules, classes, methods, lines),
 * the deploy layer, then the join, the changes and the checks. Each intent
 * layer shows its count and switches the tree; each layer that does not exist
 * yet says which step of the review brief brings it, so what is missing is on
 * the page, not implied. Counts come from the store; the absent layers are
 * named here, with their step, until the derivation writes them.
 *
 * @module review-ladder
 * @version 0.1.0
 */
import { ReviewBase, REVIEW_EVENTS } from '../review-base/review-base.js'

export const LADDER = Object.freeze([
    { group : 'Intent, from the brief', rungs : [
        { label : 'stories',    layers : ['story'],     view : 'stories' },
        { label : 'rules',      layers : ['rule'],      view : 'stories' },
        { label : 'examples',   layers : ['example'],   view : 'stories' },
        { label : 'flows',      layers : ['flow'],      view : 'flows' },
        { label : 'steps',      layers : ['step'],      view : 'flows' },
        { label : 'components', layers : ['component'], view : 'components' },
    ] },
    { group : 'Derived, from the code', rungs : [
        { label : 'surfaces', step : 2, note : 'pages, routes, commands, the things an example names' },
        { label : 'modules',  step : 2, note : 'files, from the syntax tree' },
        { label : 'classes',  step : 2, note : 'one class per file, in the house style' },
        { label : 'methods',  step : 2, note : 'with calls between them' },
        { label : 'lines',    step : 5, note : 'the source itself, reachable from a method' },
    ] },
    { group : 'Deploy, from the brief', rungs : [
        { label : 'environments', layers : ['environment'], view : 'deploy' },
        { label : 'resources',    layers : ['resource'],    view : 'deploy' },
        { label : 'pipelines',    layers : ['pipeline'],    view : 'deploy' },
        { label : 'jobs',         layers : ['job'],         view : 'deploy' },
    ] },
    { group : 'Across the layers', rungs : [
        { label : 'join',    step : 3, note : 'intent matched to code, with a coverage figure' },
        { label : 'changes', step : 4, note : 'every commit read upwards' },
        { label : 'streams', step : 5, note : 'the code on one path, in call order' },
        { label : 'checks',  step : 6, note : 'the house rules as queries over the graph' },
    ] },
])

export class ReviewLadder extends ReviewBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'review-ladder' }

    onReady() {
        this.$('[data-ladder]').addEventListener('click', (event) => {
            const button = event.target.closest('[data-view]')
            if (button) ReviewBase.store.show(button.dataset.view)
        })
        this.on(REVIEW_EVENTS.loaded, () => this.render())
        this.on(REVIEW_EVENTS.route,  () => this.render())
        this.on(REVIEW_EVENTS.select, () => this.render())
        if (ReviewBase.store.loaded) this.render()
    }

    render() {
        const store  = ReviewBase.store
        const counts = store.counts()
        const nav    = this.$('[data-ladder]')
        nav.replaceChildren()
        for (const group of LADDER) {
            nav.appendChild(this.el('h3', { class : 'group' }, group.group))
            const ul = this.el('ul', { class : 'rungs' })
            for (const rung of group.rungs) {
                const li = this.el('li', { class : `rung${rung.step ? ' absent' : ''}` })
                if (rung.step) {
                    li.appendChild(this.el('span', { class : 'label' }, rung.label))
                    li.appendChild(this.el('span', { class : 'step', title : rung.note }, `step ${rung.step}`))
                } else {
                    const count  = rung.layers.reduce((sum, layer) => sum + (counts[layer] || 0), 0)
                    const here   = store.route.view === rung.view
                    const button = this.el('button', { type : 'button', class : `label${here ? ' here' : ''}`, 'data-view' : rung.view, 'aria-pressed' : here ? 'true' : 'false' }, rung.label)
                    li.appendChild(button)
                    li.appendChild(this.el('span', { class : 'count' }, String(count)))
                }
                ul.appendChild(li)
            }
            nav.appendChild(ul)
        }
        nav.appendChild(this.el('p', { class : 'set' }, `set: ${store.set === 'self' ? 'the tool (review/self/)' : 'the project'}`))
    }
}

customElements.define('review-ladder', ReviewLadder)
