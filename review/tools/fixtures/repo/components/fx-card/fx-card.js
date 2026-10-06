/**
 * fx-card — a fixture component: one card with a title and a count.
 * @module fx-card
 * @version 0.1.0
 */
import { FxBase } from '../fx-base.js'

export const CARD_EVENTS = Object.freeze({
    opened : 'fx:card-opened',
})

export class FxCard extends FxBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'fx-card' }

    onReady() {
        this._count = 0
        this.$('[data-action="open"]').addEventListener('click', () => this.open())
    }

    open() {
        this._count += 1
        this.emit(CARD_EVENTS.opened, { count: this._count })
    }
}

customElements.define('fx-card', FxCard)
