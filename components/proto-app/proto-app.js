/**
 * proto-app — the design prototype in a mini browser frame: the ten screens
 * the brief describes, working on invented data (proto-base's store), in one
 * of three UX variants picked from the frame's bar: Desk (the brief's own
 * shape: header, sidebar, list, forms), Focus (one card per screen, a bottom
 * bar of tabs, phone first) and Command (a command bar, a dense table, an
 * inspector). The same screen bodies render in all three; the chrome around
 * them, the targets and the way you move differ, which is what A/B testing
 * needs. `screen="vault"` starts the frame on a screen; without it the frame
 * starts where the app would send this state. Every value is invented.
 *
 * @module proto-app
 * @version 0.1.0
 */
import { ProtoBase, PROTO_EVENTS, KINDS, ENVS, SOFT_LIMIT } from '../proto-base/proto-base.js'

const NAV     = Object.freeze([['vault', 'Vault'], ['devices', 'Devices'], ['environment', 'Environment'], ['account', 'Account']])
const ENV_IDS = Object.freeze({ prod : 'sgit-secrets-prod', dev : 'sgit-secrets-dev', main : 'sgit-secrets-main' })
const MASK    = '••••••••••••'
const HELP    = 'add <kind> <title> · open <n> · search <text> · lock · unlock · sign in · sign out · env dev|main|prod · vault · devices · environment · account · help'

function ago(iso) {
    if (!iso) return 'never'
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes} min ago`
    if (minutes < 60 * 48) return `${Math.round(minutes / 60)} h ago`
    return iso.slice(0, 10)
}

export class ProtoApp extends ProtoBase {
    static jsUrl = import.meta.url

    static get observedAttributes() { return ['screen'] }

    get resourceName() { return 'proto-app' }

    attributeChangedCallback() { if (this._ready && this.getAttribute('screen')) ProtoBase.store.go(this.getAttribute('screen'), 'page') }

    async onReady() {
        this._revealed = new Set()
        this._search   = ''
        this._kind     = ''
        this._confirm  = null
        this._forms    = {}
        const store = ProtoBase.store
        await store.ready
        this.$('[data-view]').addEventListener('click',  (event) => this.click(event))
        this.$('[data-view]').addEventListener('submit', (event) => { event.preventDefault(); this.submit(event) })
        this.$('[data-view]').addEventListener('input',  (event) => this.typed(event))
        this.$('[data-view]').addEventListener('keydown', (event) => this.keyed(event))
        this.$('[data-ux]').addEventListener('click', (event) => { const b = event.target.closest('[data-variant]'); if (b) store.setVariant(b.dataset.variant) })
        this.$('[data-seed]').addEventListener('click',  () => store.seed())
        this.$('[data-reset]').addEventListener('click', () => { store.reset(); store.go(this.getAttribute('screen') || 'sign-in', 'reset') })
        this.on(PROTO_EVENTS.screen,  () => this.render())
        this.on(PROTO_EVENTS.state,   () => this.render())
        this.on(PROTO_EVENTS.variant, () => this.render())
        store.go(this.getAttribute('screen') || store.next(), 'page')
    }

    // ── the frame ───────────────────────────────────────────────────────────

    h(tag, attrs = {}, ...children) {                                            // an element with children: strings or nodes
        const node = this.el(tag, attrs)
        for (const child of children) if (child !== null && child !== undefined) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
        return node
    }

    button(label, action, arg = '', cls = 'btn') {
        return this.h('button', { type : 'button', class : cls, 'data-action' : action, 'data-arg' : arg }, label)
    }

    render() {
        const store  = ProtoBase.store
        const screen = store.byId(store.screen) || store.screens[0]
        if (!screen) return
        const view = this.$('[data-view]')
        view.className = `mb-view variant-${store.variant}`
        this.$('[data-url]').textContent = `secrets.sgit.ai${screen.path}`
        const ux = this.$('[data-ux]')
        ux.replaceChildren()
        for (const variant of store.variants) {
            ux.appendChild(this.h('button', { type : 'button', class : 'ux-pick', 'data-variant' : variant.id, 'aria-pressed' : variant.id === store.variant ? 'true' : 'false', title : variant.description }, `${variant.tag} ${variant.name}`))
        }
        view.replaceChildren(this[`chrome_${store.variant}`](screen, this.body(screen)))
    }

    chrome_desk(screen, body) {
        const s    = ProtoBase.store.state
        const head = this.h('div', { class : 'app-head' },
            this.h('span', { class : 'brand' }, 'secrets', this.h('span', {}, '.sgit.ai')),
            this.envBadge(), this.lockBadge(),
            this.h('nav', { class : 'app-nav' }, ...NAV.map(([id, label]) => this.h('button', { type : 'button', class : `navlink${screen.id === id ? ' here' : ''}`, 'data-action' : 'go', 'data-arg' : id }, label))),
            this.h('span', { class : 'who' }, s.user ? s.user.email : ''))
        const centre = ['sign-in', 'setup', 'unlock'].includes(screen.id)
        const side   = screen.id === 'vault' && s.user && s.keyring && !s.locked ? this.vaultSide() : null
        return this.h('div', { class : 'app desk' }, head, this.h('div', { class : `app-body${centre ? ' centre' : ''}` }, side, this.h('div', { class : centre ? 'card' : 'app-main' }, body)))
    }

    chrome_focus(screen, body) {
        const s   = ProtoBase.store.state
        const top = this.h('div', { class : 'focus-top' }, this.h('span', { class : 'brand' }, 'secrets', this.h('span', {}, '.sgit.ai')), this.envBadge(), this.lockBadge())
        const step = this.h('p', { class : 'focus-step' }, `${screen.n} of 10 · ${screen.title}`)
        const tabs = this.h('nav', { class : 'focus-tabs' }, ...NAV.map(([id, label]) => this.h('button', { type : 'button', class : `tab${screen.id === id ? ' here' : ''}`, 'data-action' : 'go', 'data-arg' : id }, this.h('span', { class : 'glyph' }, label[0]), label)))
        return this.h('div', { class : 'app focus' }, top, step, this.h('div', { class : 'focus-card' }, body), tabs, this.h('p', { class : 'focus-who' }, s.user ? s.user.email : 'not signed in'))
    }

    chrome_command(screen, body) {
        const s   = ProtoBase.store.state
        const bar = this.h('form', { class : 'cmd-bar', 'data-form' : 'command' },
            this.h('span', { class : 'prompt' }, '›'),
            this.h('input', { type : 'text', name : 'command', 'data-command' : '', placeholder : `${screen.title.toLowerCase()} · type a command, ? for help`, autocomplete : 'off', spellcheck : 'false', 'aria-label' : 'Command' }),
            this.h('span', { class : 'hint' }, this._cmdHint || HELP.split(' · ').slice(0, 4).join(' · ')))
        const inspector = this.h('aside', { class : 'inspector' }, this.inspector(screen))
        const status = this.h('div', { class : 'cmd-status' },
            this.h('span', {}, s.user ? s.user.email : 'signed out'), this.envBadge(), this.lockBadge(),
            this.h('span', {}, `${s.entries.length} entries`), this.h('span', { class : 'mono' }, screen.path))
        return this.h('div', { class : 'app command' }, bar, this.h('div', { class : 'cmd-split' }, this.h('div', { class : 'cmd-main' }, body), inspector), status)
    }

    inspector(screen) {
        const s     = ProtoBase.store.state
        const entry = s.entries.find(e => e.id === s.selected)
        const dl    = this.h('dl', { class : 'kv' })
        const row   = (k, v) => { dl.appendChild(this.h('dt', {}, k)); dl.appendChild(this.h('dd', {}, v)) }
        row('screen', screen.title)
        row('next', ProtoBase.store.next())
        row('keyring', s.keyring ? (s.locked ? 'locked' : 'open') : 'none')
        row('devices', String(s.devices.length))
        if (entry) { row('selected', entry.title); row('kind', entry.kind); row('updated', ago(entry.updated)) }
        return this.h('div', {}, this.h('h3', {}, 'Inspector'), dl)
    }

    envBadge()  { const env = ProtoBase.store.state.env; return this.h('span', { class : `env env-${env === 'prod' ? 'prod' : 'other'}`, title : ENV_IDS[env] }, env) }

    lockBadge() { const s = ProtoBase.store.state; return this.h('span', { class : `lock ${s.keyring && !s.locked ? 'lock-open' : 'lock-closed'}` }, s.keyring ? (s.locked ? 'locked' : 'unlocked') : 'no keyring') }

    kind(kind) { return this.h('span', { class : `kind kind-${kind}` }, kind) }

    // ── the screens ─────────────────────────────────────────────────────────

    body(screen) {
        const builder = this[`screen_${screen.id.replace(/-/g, '_')}`]
        return builder ? builder.call(this, screen) : this.h('p', {}, 'No body for this screen.')
    }

    gate(need) {                                                                  // what a screen shows when the state is not ready for it
        const s = ProtoBase.store.state
        if (need.includes('user') && !s.user) return this.h('div', { class : 'gate' }, this.h('p', {}, 'Sign in first; the login decides which paths in the bucket you may touch.'), this.button('Go to sign in', 'go', 'sign-in', 'btn btn-primary'))
        if (need.includes('keyring') && !s.keyring) return this.h('div', { class : 'gate' }, this.h('p', {}, 'No keyring yet on this account: the first run creates it.'), this.button('Create it', 'go', 'setup', 'btn btn-primary'))
        if (need.includes('open') && s.locked) return this.h('div', { class : 'gate' }, this.h('p', {}, 'The keyring is locked. Nothing decrypted exists until you touch your passkey.'), this.button('Unlock', 'go', 'unlock', 'btn btn-primary'))
        return null
    }

    screen_sign_in() {
        const s   = ProtoBase.store.state
        const env = s.env
        if (s.user) return this.h('div', {}, this.h('h2', {}, 'Signed in'), this.h('p', {}, `${s.user.email} with ${s.user.method}. The app routes on from here.`), this.button(`Continue to ${ProtoBase.store.next()}`, 'go', ProtoBase.store.next(), 'btn btn-primary'), ' ', this.button('Sign out', 'sign-out', '', 'btn btn-ghost'))
        return this.h('div', {},
            this.h('h2', {}, 'Sign in'),
            this.h('p', { class : 'muted' }, 'Environment: ', this.envBadge(), ` · ${ENV_IDS[env]} · `, this.button('change', 'go', 'environment', 'linkish')),
            this.button('Sign in with Google', 'sign-in', 'google', 'btn btn-primary'),
            this.h('p', { class : 'muted' }, 'or with an email address'),
            this.h('form', { 'data-form' : 'email' },
                this.h('label', { class : 'field' }, 'Email', this.h('input', { type : 'email', name : 'email', value : 'dinis@example.com', autocomplete : 'off' })),
                this.h('label', { class : 'field' }, 'Password', this.h('input', { type : 'password', name : 'password', value : 'invented-password', autocomplete : 'off' })),
                this.h('button', { type : 'submit', class : 'btn' }, 'Sign in'), ' ', this.button('Create account', 'sign-in', 'email-new', 'btn btn-ghost')),
            this.h('div', { class : 'warn-box' }, 'The login decides which paths in the bucket you may touch. Your passkey, not your login, is what opens them.'))
    }

    screen_setup() {
        const s = ProtoBase.store.state
        const gate = this.gate(['user'])
        if (gate) return gate
        if (s.keyring && s.keyring.recoveryShown) {
            return this.h('div', {},
                this.h('h2', {}, 'Your recovery code'),
                this.h('p', {}, 'Shown once. It is the only other way into your keyring; the server never sees it.'),
                this.h('p', { class : 'code-big' }, s.keyring.recovery),
                this.h('div', { class : 'warn-box' }, 'Write it down somewhere that is not this device.'),
                this.button('I have written it down', 'recovery-written', '', 'btn btn-primary'))
        }
        if (s.keyring) return this.h('div', {}, this.h('h2', {}, 'Keyring exists'), this.h('p', {}, `Created ${ago(s.keyring.created)}.`), this.button('Open the vault', 'go', 'vault', 'btn btn-primary'))
        return this.h('div', {},
            this.h('h2', {}, 'First run: create a passkey'),
            this.h('p', {}, 'One passkey on this device creates your keyring. The PRF secret the authenticator returns derives the key that wraps it; the browser keeps the plaintext only while the page is open.'),
            this.h('ol', { class : 'steps' }, this.h('li', {}, 'Touch your passkey (rp.id secrets.sgit.ai, never sgit.ai).'), this.h('li', {}, 'The keyring is created, empty, and written to the bucket as ciphertext.'), this.h('li', {}, 'A recovery code is shown once.')),
            this.button('Create passkey and keyring', 'create-keyring', '', 'btn btn-primary'))
    }

    screen_unlock() {
        const s = ProtoBase.store.state
        const gate = this.gate(['user', 'keyring'])
        if (gate) return gate
        if (!s.locked) return this.h('div', {}, this.h('h2', {}, 'Unlocked'), this.h('p', {}, `Open since ${ago(s.unlockedAt)}; locks on the timer, on sign out, or on Lock.`), this.button('Open the vault', 'go', 'vault', 'btn btn-primary'), ' ', this.button('Lock', 'lock', '', 'btn btn-ghost'))
        return this.h('div', {},
            this.h('h2', {}, 'Unlock'),
            this.h('p', {}, `${s.user.email} · keyring created ${ago(s.keyring.created)} · ${s.devices.length} passkey${s.devices.length === 1 ? '' : 's'}`),
            this.button('Touch your passkey', 'unlock', 'passkey', 'btn btn-primary'),
            this.h('details', { class : 'other-way' }, this.h('summary', {}, 'Another way: the recovery code'),
                this.h('form', { 'data-form' : 'recovery' }, this.h('label', { class : 'field' }, 'Recovery code', this.h('input', { type : 'text', name : 'code', placeholder : 'apple-river-stone-cloud-4821', autocomplete : 'off' })), this.h('button', { type : 'submit', class : 'btn' }, 'Unlock with the code'))),
            this.h('p', { class : 'muted' }, 'A new device has no passkey yet: unlock with the code, then add one on the Devices page.'))
    }

    vaultSide() {
        const store  = ProtoBase.store
        const counts = store.byKind()
        const chips  = KINDS.map(k => this.h('button', { type : 'button', class : `chip${this._kind === k ? ' here' : ''}`, 'data-action' : 'filter-kind', 'data-arg' : k }, this.kind(k), ` ${counts[k]}`))
        return this.h('div', { class : 'app-side' },
            this.h('label', { class : 'field' }, 'Search', this.h('input', { type : 'search', 'data-search' : '', value : this._search, placeholder : 'title or kind', autocomplete : 'off' })),
            this.h('p', { class : 'muted' }, 'Kinds'), this.h('div', { class : 'chips' }, ...chips, this._kind ? this.button('all', 'filter-kind', '', 'chip') : null),
            this.h('p', { class : 'muted' }, `${store.state.entries.length} entries · ${Math.round(store.size() / 102.4) / 10} KB of ${SOFT_LIMIT / 1024 / 1024} MB`),
            this.button('+ Add entry', 'add-form', '', 'btn btn-primary'))
    }

    screen_vault() {
        const store = ProtoBase.store
        const gate  = this.gate(['user', 'keyring', 'open'])
        if (gate) return gate
        const s     = store.state
        const q     = this._search.toLowerCase()
        const rows  = s.entries.filter(e => (!this._kind || e.kind === this._kind) && (!q || e.title.toLowerCase().includes(q) || e.kind.includes(q)))
        const list  = this.h('ul', { class : 'list' }, ...rows.map((e, i) => this.h('li', { class : e.id === s.selected ? 'active' : '' },
            this.h('button', { type : 'button', class : 'row-btn', 'data-action' : 'open', 'data-arg' : e.id }, this.h('span', { class : 'n' }, String(i + 1)), this.kind(e.kind), this.h('span', { class : 'title' }, e.title), this.h('span', { class : 'when' }, `updated ${ago(e.updated)}`)))))
        const head  = this.h('div', { class : 'row between' }, this.h('h2', {}, 'Vault'), store.variant !== 'desk' ? this.h('span', {}, this.button('+ Add', 'add-form', '', 'btn btn-primary'), ' ', this.button('Lock', 'lock', '', 'btn btn-ghost')) : this.button('Lock', 'lock', '', 'btn btn-ghost'))
        const parts = [head]
        if (store.variant !== 'desk') parts.push(this.h('input', { type : 'search', 'data-search' : '', value : this._search, placeholder : 'search title or kind', autocomplete : 'off', class : 'wide' }))
        if (this._forms.add) parts.push(this.addForm())
        parts.push(rows.length ? list : this.h('p', { class : 'muted' }, s.entries.length ? 'Nothing matches.' : 'Empty. Add an entry, or Seed the prototype from the frame bar.'))
        return this.h('div', {}, ...parts)
    }

    addForm() {
        return this.h('form', { class : 'add-form', 'data-form' : 'add' },
            this.h('label', { class : 'field' }, 'Kind', this.h('select', { name : 'kind' }, ...KINDS.map(k => this.h('option', { value : k }, k)))),
            this.h('label', { class : 'field' }, 'Title', this.h('input', { type : 'text', name : 'title', placeholder : 'what it opens', autocomplete : 'off', required : '' })),
            this.h('label', { class : 'field' }, 'Secret', this.h('input', { type : 'text', name : 'secret', placeholder : 'invented, please', autocomplete : 'off' })),
            this.h('button', { type : 'submit', class : 'btn btn-primary' }, 'Save'), ' ', this.button('Cancel', 'add-cancel', '', 'btn btn-ghost'))
    }

    screen_entry() {
        const store = ProtoBase.store
        const gate  = this.gate(['user', 'keyring', 'open'])
        if (gate) return gate
        const s     = store.state
        const entry = s.entries.find(e => e.id === s.selected)
        if (!entry) return this.h('div', {}, this.h('h2', {}, 'No entry selected'), this.button('Back to the vault', 'go', 'vault', 'btn'))
        const shown = this._revealed.has(entry.id)
        const guard = entry.kind === 'sgit-vault-key' ? this.h('div', { class : 'warn-box' }, 'A vault key opens a whole vault. Copying it asks once; sharing it is refused until phase 2.') : null
        const editing = this._forms.edit === entry.id
        return this.h('div', {},
            this.h('p', {}, this.button('← Vault', 'go', 'vault', 'linkish')),
            this.h('div', { class : 'row' }, this.kind(entry.kind), this.h('h2', {}, entry.title)),
            guard,
            this.h('label', { class : 'field' }, 'Secret', this.h('div', { class : `box${shown ? '' : ' masked'}` }, shown ? entry.secret : MASK)),
            this.h('div', { class : 'row' }, this.button(shown ? 'Hide' : 'Reveal', 'reveal', entry.id), this.button('Copy', 'copy', entry.id), this.button(editing ? 'Stop editing' : 'Edit', 'edit-form', entry.id), this.button(this._confirm === `delete:${entry.id}` ? 'Really delete' : 'Delete', 'delete', entry.id, 'btn btn-danger')),
            editing ? this.h('form', { class : 'add-form', 'data-form' : 'edit' }, this.h('input', { type : 'hidden', name : 'id', value : entry.id }),
                this.h('label', { class : 'field' }, 'Title', this.h('input', { type : 'text', name : 'title', value : entry.title })),
                this.h('label', { class : 'field' }, 'Notes', this.h('input', { type : 'text', name : 'notes', value : entry.notes })),
                this.h('button', { type : 'submit', class : 'btn btn-primary' }, 'Save')) : null,
            this.h('dl', { class : 'kv' }, this.h('dt', {}, 'notes'), this.h('dd', {}, entry.notes || '—'), this.h('dt', {}, 'created'), this.h('dd', {}, entry.created.slice(0, 10)), this.h('dt', {}, 'updated'), this.h('dd', {}, ago(entry.updated)), this.h('dt', {}, 'revealed'), this.h('dd', {}, `${entry.revealed} times`), this.h('dt', {}, 'copied'), this.h('dd', {}, `${entry.copied} times`)))
    }

    screen_devices() {
        const store = ProtoBase.store
        const gate  = this.gate(['user', 'keyring'])
        if (gate) return gate
        const s = store.state
        return this.h('div', {},
            this.h('h2', {}, 'Devices'),
            this.h('p', { class : 'muted' }, 'Every passkey that can open the keyring. Removing the last one leaves only the recovery code.'),
            this.h('ul', { class : 'list' }, ...s.devices.map(d => this.h('li', {}, this.h('span', { class : 'title' }, d.name), this.h('span', { class : 'when' }, `added ${d.added.slice(0, 10)} · last ${ago(d.last)}`), s.devices.length > 1 ? this.button('Remove', 'remove-device', d.id, 'btn btn-ghost') : null))),
            this.h('form', { class : 'row', 'data-form' : 'device' }, this.h('input', { type : 'text', name : 'name', placeholder : 'a name for this device', autocomplete : 'off', required : '' }), this.h('button', { type : 'submit', class : 'btn btn-primary' }, 'Add a passkey on this device')),
            this.h('h3', {}, 'Recovery code'),
            s.keyring.recoveryShown ? this.h('p', { class : 'code-big' }, s.keyring.recovery) : this.h('p', { class : 'muted' }, 'Shown once at setup; regenerating replaces it and shows the new one once.'),
            this.button(s.keyring.recoveryShown ? 'I have written it down' : 'Regenerate', s.keyring.recoveryShown ? 'recovery-written' : 'regenerate', '', 'btn'))
    }

    screen_environment() {
        const s = ProtoBase.store.state
        const rows = ENVS.map(env => this.h('li', {}, this.h('button', { type : 'button', class : `row-btn${s.env === env ? ' here' : ''}`, 'data-action' : 'set-env', 'data-arg' : env }, this.h('span', { class : `env env-${env === 'prod' ? 'prod' : 'other'}` }, env), this.h('span', { class : 'title mono' }, ENV_IDS[env]), this.h('span', { class : 'when' }, s.env === env ? 'active' : ''))))
        const json = JSON.stringify({ name : s.env, projectId : ENV_IDS[s.env], bucket : `${ENV_IDS[s.env]}-keyrings`, authDomain : `${ENV_IDS[s.env]}.firebaseapp.com` }, null, 1)
        return this.h('div', {},
            this.h('h2', {}, 'Environment'),
            this.h('p', {}, 'Which GCP project the app talks to. Changing it signs you out and clears every key in memory.'),
            this.h('ul', { class : 'list' }, ...rows),
            this.h('details', {}, this.h('summary', {}, 'Export, import, reset'), this.h('pre', { class : 'mono small' }, json), this.h('form', { 'data-form' : 'import' }, this.h('textarea', { name : 'json', rows : '3', placeholder : 'paste an environment JSON with a name of prod, dev or main' }), this.h('button', { type : 'submit', class : 'btn' }, 'Import'), ' ', this.button('Reset to default', 'set-env', 'dev', 'btn btn-ghost'))))
    }

    screen_account() {
        const store = ProtoBase.store
        const gate  = this.gate(['user'])
        if (gate) return gate
        const s = store.state
        return this.h('div', {},
            this.h('h2', {}, 'Account'),
            this.h('dl', { class : 'kv' }, this.h('dt', {}, 'signed in as'), this.h('dd', {}, s.user.email), this.h('dt', {}, 'with'), this.h('dd', {}, s.user.method), this.h('dt', {}, 'since'), this.h('dd', {}, ago(s.user.since)),
                this.h('dt', {}, 'keyring'), this.h('dd', {}, s.keyring ? `${Math.round(store.size() / 102.4) / 10} KB of ${SOFT_LIMIT / 1024 / 1024} MB soft limit · ${s.entries.length} entries · ${s.devices.length} devices` : 'none')),
            this.h('div', { class : 'row' }, this.button('Sign out', 'sign-out', '', 'btn'), this.button(this._confirm === 'delete-account' ? 'Really delete everything' : 'Delete account', 'delete-account', '', 'btn btn-danger')))
    }

    screen_admin_checklist() {
        const s = ProtoBase.store.state
        const gate = this.gate(['user'])
        if (gate) return gate
        const rows = (s.checks || []).map((c, i) => this.h('tr', {}, this.h('td', {}, c.name), this.h('td', { class : `check ${c.ok ? 'check-ok' : 'check-bad'}` }, c.ok ? 'ok' : 'missing'), this.h('td', {}, c.ok ? ago(c.at) : (c.fixable ? this.button('Fix', 'fix-check', String(i), 'btn') : 'needs the console'))))
        return this.h('div', {},
            this.h('h2', {}, `Setup checklist · ${ENV_IDS[s.env]}`),
            this.h('p', {}, 'Every per-project resource as a row. Fix where the browser can; the rest names what to do in the console.'),
            this.button(s.checks ? 'Run again' : 'Run the checks', 'run-checks', '', 'btn btn-primary'),
            s.checks ? this.h('table', { class : 'mini' }, this.h('thead', {}, this.h('tr', {}, this.h('th', {}, 'Resource'), this.h('th', {}, 'State'), this.h('th', {}, ''))), this.h('tbody', {}, ...rows)) : null)
    }

    screen_matrix() {
        const s = ProtoBase.store.state
        const rows = (s.probes || []).map(p => this.h('tr', {}, this.h('td', { class : 'mono' }, p.name), this.h('td', { class : `check check-${p.result === 'pass' ? 'ok' : 'skip'}` }, p.result), this.h('td', {}, `${p.ms} ms`)))
        return this.h('div', {},
            this.h('h2', {}, 'Compatibility matrix'),
            this.h('p', {}, 'Every probe page, run in this browser. Nothing is sent; the result is for you.'),
            this.button(s.probes ? 'Run again' : 'Run every probe', 'run-probes', '', 'btn btn-primary'),
            s.probes ? this.h('table', { class : 'mini' }, this.h('thead', {}, this.h('tr', {}, this.h('th', {}, 'Probe'), this.h('th', {}, 'Result'), this.h('th', {}, 'Time'))), this.h('tbody', {}, ...rows)) : null,
            s.probes ? this.h('p', { class : 'muted' }, 'PRF is skipped here because this prototype never calls WebAuthn. ', this.button('Try the app', 'go', 'sign-in', 'linkish')) : null)
    }

    // ── what a click, a submit and a keystroke do ───────────────────────────

    click(event) {
        const button = event.target.closest('[data-action]')
        if (!button) return
        const store = ProtoBase.store
        const { action, arg } = button.dataset
        const confirmKey = `${action}:${arg}`
        if (action === 'go')               store.go(arg, 'click')
        if (action === 'sign-in')          { store.signIn(arg === 'email-new' ? 'email (new account)' : arg); store.go(store.next(), 'route') }
        if (action === 'sign-out')         { store.signOut(); store.go('sign-in', 'route') }
        if (action === 'create-keyring')   store.createKeyring()
        if (action === 'recovery-written') { store.act('recovery-written', {}, (s) => { s.keyring.recoveryShown = false }); store.go('vault', 'route') }
        if (action === 'unlock')           { store.unlock(arg); store.go('vault', 'route') }
        if (action === 'lock')             { store.lock(); store.go('unlock', 'route') }
        if (action === 'filter-kind')      { this._kind = this._kind === arg ? '' : arg; store.log('filter', { kind : this._kind }); store.save(); this.render() }
        if (action === 'add-form')         { this._forms.add = true; this.render() }
        if (action === 'add-cancel')       { this._forms.add = false; this.render() }
        if (action === 'open')             { store.select(arg); store.go('entry', 'click') }
        if (action === 'reveal')           { if (this._revealed.has(arg)) this._revealed.delete(arg); else { this._revealed.add(arg); store.reveal(arg) }; this.render() }
        if (action === 'copy')             { const e = store.state.entries.find(x => x.id === arg); if (e && navigator.clipboard) navigator.clipboard.writeText(e.secret).catch(() => {}); store.copy(arg) }
        if (action === 'edit-form')        { this._forms.edit = this._forms.edit === arg ? null : arg; this.render() }
        if (action === 'delete')           { if (this._confirm === confirmKey) { this._confirm = null; store.deleteEntry(arg); store.go('vault', 'route') } else { this._confirm = confirmKey; this.render() } }
        if (action === 'delete-account')   { if (this._confirm === 'delete-account') { this._confirm = null; store.act('delete-account', {}, (s) => { Object.assign(s, { user : null, keyring : null, locked : true, entries : [], devices : [], selected : null }) }); store.go('sign-in', 'route') } else { this._confirm = 'delete-account'; this.render() } }
        if (action === 'remove-device')    store.removeDevice(arg)
        if (action === 'regenerate')       store.regenerateRecovery()
        if (action === 'set-env')          { store.setEnv(arg); store.go('sign-in', 'route') }
        if (action === 'run-checks')       store.runChecks()
        if (action === 'fix-check')        store.fixCheck(parseInt(arg, 10))
        if (action === 'run-probes')       store.runProbes()
    }

    submit(event) {
        const form  = event.target.closest('[data-form]')
        if (!form) return
        const store = ProtoBase.store
        const data  = Object.fromEntries(new FormData(form).entries())
        const name  = form.dataset.form
        if (name === 'email')    { store.signIn('email', data.email || 'dinis@example.com'); store.go(store.next(), 'route') }
        if (name === 'recovery') { if ((data.code || '').trim()) { store.unlock('recovery code'); store.go('vault', 'route') } }
        if (name === 'add')      { if (data.title) { this._forms.add = false; store.addEntry({ kind : data.kind, title : data.title, secret : data.secret }); store.go('entry', 'route') } }
        if (name === 'edit')     { this._forms.edit = null; store.updateEntry(data.id, { title : data.title, notes : data.notes }) }
        if (name === 'device')   { if (data.name) store.addDevice(data.name) }
        if (name === 'import')   { try { const env = JSON.parse(data.json || '{}'); if (ENVS.includes(env.name)) { store.setEnv(env.name); store.go('sign-in', 'route') } } catch (error) { store.log('import-failed', {}); store.save(); this.render() } }
        if (name === 'command')  this.command((data.command || '').trim(), form.querySelector('[data-command]'))
    }

    typed(event) {
        const input = event.target
        if (input.matches('[data-search]')) {
            this._search = input.value
            const list = this.$('.list')
            if (list) { const fresh = this.screen_vault(); const old = this.$('.app-main, .focus-card, .cmd-main'); if (old) { old.replaceChildren(fresh); const again = this.$('[data-search]'); if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length) } } }
        }
    }

    keyed(event) {
        if (event.key === 'Escape' && (this._forms.add || this._forms.edit || this._confirm)) { this._forms = {}; this._confirm = null; this.render() }
    }

    command(text, input) {                                                        // the Command variant's bar
        const store = ProtoBase.store
        const [verb, ...rest] = text.split(/\s+/)
        const arg = rest.join(' ')
        const say = (hint) => { this._cmdHint = hint; this.render(); const again = this.$('[data-command]'); if (again) again.focus() }
        store.log('command', { text })
        if (!verb || verb === '?' || verb === 'help') return say(HELP)
        if (verb === 'unlock' && store.state.keyring && store.state.locked) { store.unlock('passkey'); store.go('vault', 'route'); return say('unlocked') }
        if (['vault', 'devices', 'environment', 'account', 'unlock', 'setup', 'matrix'].includes(verb)) { store.go(verb, 'command'); return say(`→ ${verb}`) }
        if (verb === 'admin')    { store.go('admin-checklist', 'command'); return say('→ admin checklist') }
        if (verb === 'lock')     { store.lock('command'); store.go('unlock', 'route'); return say('locked') }
        if (verb === 'sign' && arg === 'in')  { store.signIn('google'); store.go(store.next(), 'route'); return say('signed in') }
        if (verb === 'sign' && arg === 'out') { store.signOut(); store.go('sign-in', 'route'); return say('signed out') }
        if (verb === 'env')      { if (ENVS.includes(arg)) { store.setEnv(arg); store.go('sign-in', 'route'); return say(`environment ${arg}; signed out`) } return say('env prod | dev | main') }
        if (verb === 'search')   { this._search = arg; if (store.screen !== 'vault') store.go('vault', 'command'); return say(`search "${arg}"`) }
        if (verb === 'open')     { const n = parseInt(arg, 10); const e = store.state.entries[n - 1]; if (e) { store.select(e.id); store.go('entry', 'command'); return say(`opened ${n}`) } return say('open <n>: the row number in the vault') }
        if (verb === 'add')      { const [kind, ...title] = rest; if (KINDS.includes(kind) && title.length) { store.addEntry({ kind, title : title.join(' '), secret : 'invented' }); store.go('entry', 'route'); return say(`added ${kind}`) } return say(`add <kind> <title>; kinds: ${KINDS.join(', ')}`) }
        if (verb === 'seed')     { store.seed(); return say('seeded') }
        if (verb === 'reset')    { store.reset(); store.go('sign-in', 'reset'); return say('reset') }
        say(`unknown: ${verb}. ${HELP}`)
    }
}

customElements.define('proto-app', ProtoApp)
