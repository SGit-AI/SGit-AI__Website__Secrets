/**
 * review-crumb — the path walked so far, root to the selected node, each step
 * a way back: clicking an ancestor selects it.
 *
 * @module review-crumb
 * @version 0.1.0
 */
import { ReviewBase, REVIEW_EVENTS, LAYERS } from '../review-base/review-base.js'

export class ReviewCrumb extends ReviewBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'review-crumb' }

    onReady() {
        this.$('[data-crumb]').addEventListener('click', (event) => {
            const button = event.target.closest('[data-node]')
            if (button && !button.classList.contains('current')) ReviewBase.store.select(button.dataset.node)
        })
        this.on(REVIEW_EVENTS.select, (event) => this.render(event.detail.id))
        this.on(REVIEW_EVENTS.route,  () => this.render(null))
        this.render(ReviewBase.store.route.node)
    }

    render(id) {
        const nav = this.$('[data-crumb]')
        nav.replaceChildren()
        const path = id ? ReviewBase.store.ancestors(id) : []
        if (!path.length) {
            nav.appendChild(this.el('span', { class : 'empty' }, `${ReviewBase.store.route.view}: nothing selected`))
            return
        }
        path.forEach((node, index) => {
            if (index) nav.appendChild(this.el('span', { class : 'sep', 'aria-hidden' : 'true' }, '/'))
            const last   = index === path.length - 1
            const button = this.el('button', { type : 'button', class : `step${last ? ' current' : ''}`, 'data-node' : node.id, 'aria-current' : last ? 'page' : 'false' },
                                   `${LAYERS[node.layer].label}: ${node.name}`)
            nav.appendChild(button)
        })
    }
}

customElements.define('review-crumb', ReviewCrumb)
