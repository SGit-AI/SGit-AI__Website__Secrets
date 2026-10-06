// ── fx-base.js — the fixture base component: lifecycle, $(), emit() ──────────
export class FxBase extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' })
        this.onReady()
    }

    onReady() {}

    $(selector) { return this.shadowRoot.querySelector(selector) }

    emit(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }
}
