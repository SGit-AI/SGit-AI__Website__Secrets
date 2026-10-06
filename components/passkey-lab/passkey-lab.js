/**
 * passkey-lab — the passkey, bit by bit, in the reader's own browser. Runs the
 * two WebAuthn calls of the design (create with the PRF extension, get with
 * prf.eval) against the reader's authenticator, then the key chain of section
 * 8.2 on the browser's WebCrypto (HKDF-SHA256 to a wrapping key, AES-256-GCM
 * to wrap a lab KEK and encrypt a lab body), and unlocks it again with the
 * same or a second passkey. Every call is logged with its inputs and decoded
 * outputs. It talks to nothing but the authenticator.
 *
 * The same rules as the app: the RP ID is this host and this host must be
 * secrets.sgit.ai or localhost (never sgit.ai), else the lab refuses; the one
 * localStorage record (LOCAL_STORAGE_KEYS.lab) holds the lab's PRF salt (a
 * random public input, like keyring.prfSalt) and the public facts of each lab
 * passkey; the PRF bytes, the wrapping keys, the KEK and the body live in this
 * page's memory and are overwritten on pagehide. Nothing derived from a key is
 * ever written anywhere.
 *
 * @module passkey-lab
 * @version 0.1.0
 */
import { SgBase }             from '../sg-base/sg-base.js'
import { LOCAL_STORAGE_KEYS } from '../../app/config/storage-keys.js'

const RP_IDS      = Object.freeze(['secrets.sgit.ai', 'localhost'])
const INFO_PREFIX = 'sgit-secrets/v1/wrap/'
const ALGS        = Object.freeze({ '-7' : 'ES256 (ECDSA P-256)', '-257' : 'RS256 (RSASSA-PKCS1-v1_5)', '-8' : 'EdDSA' })
const FLAG_BITS   = Object.freeze([['UP', 0, 'user present'], ['UV', 2, 'user verified'], ['BE', 3, 'backup eligible: a synced passkey'], ['BS', 4, 'backed up'], ['AT', 6, 'attested credential data follows'], ['ED', 7, 'extension data follows']])

const rnd    = (n) => crypto.getRandomValues(new Uint8Array(n))
const utf8   = (s) => new TextEncoder().encode(s)
const bytes  = (b) => b instanceof Uint8Array ? b : new Uint8Array(b)
const hex    = (b) => [...bytes(b)].map(x => x.toString(16).padStart(2, '0')).join('')
const b64url = (b) => btoa(String.fromCharCode(...bytes(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64  = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0))
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(b)))
const finger = async (b) => hex(await sha256(b)).slice(0, 16)
const uuid   = () => crypto.randomUUID()

export class PasskeyLab extends SgBase {
    static jsUrl = import.meta.url

    get resourceName() { return 'passkey-lab' }

    onReady() {
        this.rpId   = location.hostname
        this.record = this.readRecord()
        this.mem    = { prf : new Map(), wk : new Map(), kek : null, keyring : null, body : null }
        this.$('[data-storage-key]').textContent = LOCAL_STORAGE_KEYS.lab
        this.$('[data-create-form]').addEventListener('submit', (event) => { event.preventDefault(); this.create(new FormData(event.currentTarget).get('name')) })
        for (const button of this.$$('[data-get]')) button.addEventListener('click', () => this.getPrf(button.dataset.get === 'other'))
        this.$('[data-build]').addEventListener('click',         () => this.build())
        this.$('[data-unlock]').addEventListener('click',        () => this.unlock())
        this.$('[data-forget-memory]').addEventListener('click', () => this.forgetMemory())
        this.$('[data-forget-local]').addEventListener('click',  () => this.forgetLocal())
        this.$('[data-copy-log]').addEventListener('click',      () => navigator.clipboard.writeText(this.logText()).catch(() => {}))
        this.$('[data-clear-log]').addEventListener('click',     () => this.$('[data-log]').replaceChildren())
        this.$('[data-reveal]').addEventListener('change',       () => this.renderPrf())
        window.addEventListener('pagehide', () => this.forgetMemory(false))
        this.support()
        this.renderCredentials()
        this.renderWhere()
    }

    // ── the record in localStorage: public values only ──────────────────────

    readRecord() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.lab) || 'null')
            if (saved && saved.salt && Array.isArray(saved.credentials)) return saved
        } catch (error) { /* a broken record is a fresh record */ }
        return { v : 1, salt : b64url(rnd(32)), credentials : [] }
    }

    writeRecord() {
        try { localStorage.setItem(LOCAL_STORAGE_KEYS.lab, JSON.stringify(this.record)) } catch (error) { /* storage blocked: the lab still runs for this page */ }
        this.renderWhere()
    }

    get salt() { return unb64(this.record.salt) }

    // ── 0 · support ──────────────────────────────────────────────────────────

    async support() {
        const ok = (cell, yes, text) => { cell.textContent = text; cell.className = yes ? 'yes' : 'no' }
        this.$('[data-rp-id]').textContent = this.rpId
        if (!RP_IDS.includes(this.rpId)) {
            const refused = this.$('[data-refused]')
            refused.textContent = `This lab runs only on ${RP_IDS.join(' or ')}; this page is on ${this.rpId}. A passkey scoped to any other host, and above all to the apex sgit.ai, is exactly what the design refuses to create.`
            refused.hidden = false
            for (const button of this.$$('button')) button.disabled = true
            return
        }
        const webauthn = Boolean(window.PublicKeyCredential)
        ok(this.$('[data-cap="webauthn"]'), webauthn, webauthn ? 'yes' : 'no: this browser has no WebAuthn')
        let platform = false
        if (webauthn) { try { platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() } catch (error) { platform = false } }
        ok(this.$('[data-cap="platform"]'), platform, platform ? 'yes' : 'no (a hardware key or a phone over QR may still work)')
        let prf = null
        if (webauthn && PublicKeyCredential.getClientCapabilities) { try { prf = (await PublicKeyCredential.getClientCapabilities())['extension:prf'] } catch (error) { prf = null } }
        ok(this.$('[data-cap="prf"]'), prf !== false, prf === true ? 'yes' : prf === false ? 'no' : 'unknown: this browser cannot say in advance; step 1 will tell')
        const subtle = Boolean(crypto.subtle && crypto.subtle.deriveKey)
        ok(this.$('[data-cap="crypto"]'), subtle, subtle ? 'yes' : 'no')
    }

    // ── 1 · create ───────────────────────────────────────────────────────────

    async create(name) {
        const userHandle = rnd(32)
        const challenge  = rnd(32)
        const options    = { rp : { id : this.rpId, name : this.rpId }, user : { id : userHandle, name : `lab ${name}`, displayName : `${name} (lab, secrets.sgit.ai)` }, challenge,
                             pubKeyCredParams : [{ type : 'public-key', alg : -7 }, { type : 'public-key', alg : -257 }],
                             authenticatorSelection : { residentKey : 'required', userVerification : 'required' },
                             extensions : { prf : {} } }
        const entry = this.log('navigator.credentials.create', { rp : options.rp, 'user.id' : `${b64url(userHandle)} (32 random bytes)`, 'user.name' : options.user.name, challenge : b64url(challenge), pubKeyCredParams : 'ES256, RS256', authenticatorSelection : options.authenticatorSelection, extensions : options.extensions })
        let credential
        try {
            credential = await navigator.credentials.create({ publicKey : options })
        } catch (error) {
            this.fail(entry, error)
            this.show('[data-create-result]', this.el('p', { class : 'no' }, `create failed: ${error.name}: ${error.message}`))
            return
        }
        const ext      = credential.getClientExtensionResults()
        const response = credential.response
        const auth     = this.parseAuthData(response.getAuthenticatorData())
        const alg      = response.getPublicKeyAlgorithm()
        const pub      = response.getPublicKey()
        const record   = { id : credential.id, name, alg, algName : ALGS[String(alg)] || String(alg), transports : response.getTransports ? response.getTransports() : [], aaguid : auth.aaguid, prfEnabled : Boolean(ext.prf && ext.prf.enabled), backedUp : auth.flags.BS, createdAt : new Date().toISOString(), publicKeySha256 : pub ? (await finger(pub)) : null }
        this.record.credentials.push(record)
        this.writeRecord()
        this.done(entry, { 'credential.id' : credential.id, 'rpIdHash matches SHA-256(rpId)' : auth.rpIdHash === hex(await sha256(utf8(this.rpId))), flags : auth.flags, signCount : auth.signCount, aaguid : auth.aaguid, publicKeyAlgorithm : record.algName, transports : record.transports, 'prf.enabled' : record.prfEnabled, clientData : this.clientData(response.clientDataJSON) })
        const out = this.el('div')
        out.appendChild(this.el('h4', {}, `The authenticator answered. prf.enabled = ${record.prfEnabled}`))
        if (!record.prfEnabled) out.appendChild(this.el('p', { class : 'no' }, 'This authenticator cannot do PRF: it made a passkey, but it cannot unlock a keyring. The app would say so and offer the recovery code or another authenticator.'))
        out.appendChild(this.kv([
            ['credential id (public, goes to meta.json)', credential.id],
            ['public key, SHA-256 (public, goes to meta.json)', record.publicKeySha256 || 'not exposed by this browser'],
            ['algorithm', record.algName],
            ['user handle (public, goes to meta.json)', b64url(userHandle)],
            ['rpIdHash in the authenticator data', `${auth.rpIdHash.slice(0, 16)}… = SHA-256("${this.rpId}"): the passkey is bound to this host`],
            ['flags', this.flags(auth.flags)],
            ['AAGUID (which kind of authenticator)', auth.aaguid || 'none'],
            ['transports', record.transports.join(', ') || 'not reported'],
            ['the private key and the PRF secret', 'in your authenticator; never shown to anyone, this page included'],
        ]))
        this.show('[data-create-result]', out)
        this.renderCredentials(credential.id)
    }

    // ── 2 · get, with PRF ────────────────────────────────────────────────────

    picked() {
        const id = this.$('[data-credential]').value
        return this.record.credentials.find(c => c.id === id) || null
    }

    async assert(credential, salt, why) {
        const challenge = rnd(32)
        const options   = { rpId : this.rpId, challenge, allowCredentials : [{ type : 'public-key', id : unb64(credential.id) }], userVerification : 'required', extensions : { prf : { eval : { first : salt } } } }
        const entry     = this.log(`navigator.credentials.get (${why})`, { rpId : options.rpId, challenge : b64url(challenge), allowCredentials : [credential.id], userVerification : 'required', 'extensions.prf.eval.first' : `${b64url(salt)} (${salt === this.salt ? 'the lab salt' : 'a throwaway salt'})` })
        let assertion
        try {
            assertion = await navigator.credentials.get({ publicKey : options })
        } catch (error) {
            this.fail(entry, error)
            throw error
        }
        const results = assertion.getClientExtensionResults().prf
        const prf     = results && results.results && results.results.first ? bytes(results.results.first) : null
        const auth    = this.parseAuthData(assertion.response.authenticatorData)
        this.done(entry, { 'credential.id' : assertion.id, flags : auth.flags, signCount : auth.signCount, 'prf.results.first' : prf ? `32 bytes, SHA-256 ${await finger(prf)}… (kept in memory)` : 'absent: this authenticator did not do PRF', 'signature' : `${assertion.response.signature.byteLength} bytes, ignored: there is no server to verify it for`, clientData : this.clientData(assertion.response.clientDataJSON) })
        if (!prf) throw new Error('no PRF result')
        return { prf, auth }
    }

    async getPrf(otherSalt) {
        const credential = this.picked()
        if (!credential) return this.show('[data-prf-result]', this.el('p', { class : 'no' }, 'Create a lab passkey first.'))
        const salt = otherSalt ? rnd(32) : this.salt
        let result
        try { result = await this.assert(credential, salt, otherSalt ? 'another salt' : 'the lab salt') } catch (error) { return this.show('[data-prf-result]', this.el('p', { class : 'no' }, `get failed: ${error.name || ''} ${error.message}`)) }
        const previous = this.mem.prf.get(credential.id)
        if (!otherSalt) this.mem.prf.set(credential.id, result.prf)
        this.last = { credential, salt : b64url(salt), prf : result.prf, same : previous ? hex(previous) === hex(result.prf) : null, other : otherSalt, flags : result.auth.flags, signCount : result.auth.signCount }
        this.renderPrf()
        this.renderWhere()
    }

    async renderPrf() {
        if (!this.last) return
        const reveal = this.$('[data-reveal]').checked
        const l      = this.last
        const out    = this.el('div')
        out.appendChild(this.el('h4', {}, l.other ? 'Another salt, the same passkey: different bytes' : l.same === null ? 'The PRF bytes for this passkey and the lab salt' : l.same ? 'Same salt again: the same bytes' : 'Same salt, but different bytes: this should not happen'))
        const rows = [
            ['passkey', `${l.credential.name} (${l.credential.id.slice(0, 12)}…)`],
            ['salt (prf.eval.first)', `${l.salt} ${l.other ? '(throwaway)' : '(the lab salt, stored in the clear, as keyring.prfSalt would be)'}`],
            ['PRF output', reveal ? hex(l.prf) : `SHA-256 ${await finger(l.prf)}… (32 bytes; tick the box to see them)`],
            ['flags', this.flags(l.flags)],
            ['sign count', String(l.signCount)],
        ]
        if (!l.other) {
            const others = []
            for (const [id, p] of this.mem.prf) if (id !== l.credential.id) others.push(`${(this.record.credentials.find(c => c.id === id) || {}).name}: ${await finger(p)}…`)
            if (others.length) rows.push(['other passkeys, same salt', others.join('; ')])
        }
        out.appendChild(this.kv(rows))
        out.appendChild(this.el('p', { class : 'hint' }, l.other ? 'The bytes for the throwaway salt were not kept.' : 'These bytes are in this page\'s memory now, nowhere else. They are what the keys page turns into a wrapping key: step 3.'))
        this.show('[data-prf-result]', out)
    }

    // ── 3 · HKDF, wrap, encrypt ──────────────────────────────────────────────

    async wrappingKey(credential, prf) {
        const info = utf8(`${INFO_PREFIX}${credential.id}`)
        const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveBits'])
        const bits = new Uint8Array(await crypto.subtle.deriveBits({ name : 'HKDF', hash : 'SHA-256', salt : this.salt, info }, base, 256))
        const key  = await crypto.subtle.importKey('raw', bits, { name : 'AES-GCM' }, false, ['encrypt', 'decrypt'])
        const fp   = await finger(bits)
        bits.fill(0)
        return { key, fp, info : `${INFO_PREFIX}${credential.id}` }
    }

    async build() {
        const credential = this.picked()
        const prf        = credential && this.mem.prf.get(credential.id)
        if (!prf) return this.show('[data-keys-result]', this.el('p', { class : 'no' }, 'Ask this passkey for its PRF bytes with the lab salt first (step 2, "Same salt").'))
        const entry = this.log('HKDF-SHA256 → wrapping key; AES-256-GCM wrap of the KEK', { ikm : 'the PRF bytes in memory', salt : `${this.record.salt} (the lab salt)`, info : `${INFO_PREFIX}${credential.id}`, output : 'AES-256-GCM key, 256 bits' })
        const wk = await this.wrappingKey(credential, prf)
        this.mem.wk.set(credential.id, wk)
        let first = false
        if (!this.mem.kek) {
            first = true
            this.mem.kek  = rnd(32)
            const keyring = { v : 1, keyringId : uuid(), rev : 1, prfSalt : this.record.salt, wraps : [], body : null }
            const kekKey  = await crypto.subtle.importKey('raw', this.mem.kek, { name : 'AES-GCM' }, false, ['encrypt', 'decrypt'])
            this.mem.body = { v : 1, keys : { note : 'the real body also carries the key pair' }, entries : [{ id : uuid(), kind : 'note', title : 'lab entry', fields : { notes : `made ${new Date().toISOString()} in the passkey lab` } }] }
            const iv      = rnd(12)
            const ct      = await crypto.subtle.encrypt({ name : 'AES-GCM', iv, additionalData : utf8(`${keyring.keyringId}|${keyring.rev}`) }, kekKey, utf8(JSON.stringify(this.mem.body)))
            keyring.body  = { iv : b64url(iv), ct : b64url(ct), aad : `${keyring.keyringId}|${keyring.rev}` }
            this.mem.keyring = keyring
        }
        const keyring = this.mem.keyring
        const wrapId  = `pk-${credential.id}`
        if (!keyring.wraps.some(w => w.id === wrapId)) {
            const iv = rnd(12)
            const ct = await crypto.subtle.encrypt({ name : 'AES-GCM', iv, additionalData : utf8(`${keyring.keyringId}|${wrapId}`) }, wk.key, this.mem.kek)
            keyring.wraps.push({ id : wrapId, kind : 'passkey', name : credential.name, createdAt : new Date().toISOString(), iv : b64url(iv), ct : b64url(ct) })
            keyring.rev += first ? 0 : 1
        }
        this.done(entry, { 'wrapping key' : `SHA-256 ${wk.fp}… (in memory)`, KEK : `SHA-256 ${await finger(this.mem.kek)}… (in memory; ${first ? 'made now, 32 random bytes' : 'the one made earlier'})`, wraps : keyring.wraps.length, rev : keyring.rev })
        const out = this.el('div')
        out.appendChild(this.el('h4', {}, first ? 'A lab keyring, with one wrap' : `The same lab keyring, now with ${keyring.wraps.length} wraps and one KEK`))
        out.appendChild(this.kv([
            ['HKDF info (the label)', wk.info],
            ['wrapping key for this passkey', `SHA-256 ${wk.fp}… (in memory, never stored)`],
            ['KEK', `SHA-256 ${await finger(this.mem.kek)}… (in memory; stored only inside wraps[].ct)`],
            ['the body, in memory', JSON.stringify(this.mem.body.entries[0])],
        ]))
        out.appendChild(this.el('h4', {}, 'keyring.json, as it would be written to the bucket (nothing here is secret)'))
        out.appendChild(this.el('pre', {}, JSON.stringify(keyring, null, 2)))
        this.show('[data-keys-result]', out)
        this.renderWhere()
    }

    // ── 4 · unlock ───────────────────────────────────────────────────────────

    async unlock() {
        const credential = this.picked()
        const keyring    = this.mem.keyring
        if (!credential || !keyring) return this.show('[data-unlock-result]', this.el('p', { class : 'no' }, 'Build the lab keyring first (step 3).'))
        const wrap = keyring.wraps.find(w => w.id === `pk-${credential.id}`)
        if (!wrap) return this.show('[data-unlock-result]', this.el('p', { class : 'no' }, `The lab keyring has no wrap for "${credential.name}". Run step 2 and step 3 for it: that is how a new passkey is added.`))
        let result
        try { result = await this.assert(credential, this.salt, 'unlock') } catch (error) { return this.show('[data-unlock-result]', this.el('p', { class : 'no' }, `get failed: ${error.name || ''} ${error.message}`)) }
        const entry = this.log('HKDF → unwrap the KEK → decrypt the body', { wrap : wrap.id, aad : `${keyring.keyringId}|${wrap.id}`, 'body aad' : keyring.body.aad })
        const wk    = await this.wrappingKey(credential, result.prf)
        let kek, body
        try {
            kek = new Uint8Array(await crypto.subtle.decrypt({ name : 'AES-GCM', iv : unb64(wrap.iv), additionalData : utf8(`${keyring.keyringId}|${wrap.id}`) }, wk.key, unb64(wrap.ct)))
            const kekKey = await crypto.subtle.importKey('raw', kek, { name : 'AES-GCM' }, false, ['decrypt'])
            body = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name : 'AES-GCM', iv : unb64(keyring.body.iv), additionalData : utf8(keyring.body.aad) }, kekKey, unb64(keyring.body.ct))))
        } catch (error) {
            this.fail(entry, error)
            return this.show('[data-unlock-result]', this.el('p', { class : 'no' }, 'Unwrap or decrypt failed: wrong bytes, or a changed byte. AES-GCM says no instead of returning garbage.'))
        }
        const remembered = this.mem.kek ? hex(this.mem.kek) === hex(kek) : null
        this.mem.kek  = kek
        this.mem.body = body
        this.mem.prf.set(credential.id, result.prf)
        this.done(entry, { 'wrapping key' : `SHA-256 ${wk.fp}…`, KEK : `SHA-256 ${await finger(kek)}… ${remembered === null ? '(recovered from the wrap: memory was empty)' : remembered ? '(equal to the one in memory)' : '(DIFFERENT from the one in memory)'}`, body : body.entries[0].title })
        const out = this.el('div')
        out.appendChild(this.el('h4', { class : remembered === false ? 'no' : 'yes' }, remembered === null ? 'Unlocked from the wrap alone: the returning flow' : remembered ? 'Unlocked, and the KEK matches the one in memory' : 'Unlocked to a different KEK: this should not happen'))
        out.appendChild(this.kv([
            ['passkey', credential.name],
            ['wrapping key', `SHA-256 ${wk.fp}… (same derivation, same key)`],
            ['KEK, unwrapped', `SHA-256 ${await finger(kek)}…`],
            ['the body, decrypted', JSON.stringify(body.entries[0])],
        ]))
        this.show('[data-unlock-result]', out)
        this.renderWhere()
    }

    // ── memory and the record ────────────────────────────────────────────────

    forgetMemory(render = true) {
        for (const p of this.mem.prf.values()) p.fill(0)
        if (this.mem.kek) this.mem.kek.fill(0)
        this.mem.prf.clear()
        this.mem.wk.clear()
        this.mem.kek  = null
        this.mem.body = null
        this.last     = null
        if (render) { this.renderWhere(); this.show('[data-keys-result]', this.el('p', { class : 'hint' }, 'Forgotten: the PRF bytes, the wrapping keys, the KEK and the body are gone from memory. The lab keyring (ciphertext) stays, so step 4 now needs a gesture to open it, exactly like a returning user.')) }
    }

    forgetLocal() {
        try { localStorage.removeItem(LOCAL_STORAGE_KEYS.lab) } catch (error) { /* nothing to remove */ }
        this.record = { v : 1, salt : b64url(rnd(32)), credentials : [] }
        this.forgetMemory(false)
        this.mem.keyring = null
        this.renderCredentials()
        this.renderWhere()
    }

    async renderWhere() {
        const n = this.record.credentials.length
        this.$('[data-where="auth"]').textContent = n ? `${n} lab passkey${n === 1 ? '' : 's'} for ${this.rpId}: ${this.record.credentials.map(c => `"${c.name}"`).join(', ')}; each with a private key and a PRF secret that never leave it` : 'no lab passkey yet'
        this.$('[data-where="local"]').textContent = JSON.stringify(this.record, null, 2)
        const parts = []
        if (this.mem.prf.size) parts.push(`PRF bytes for ${this.mem.prf.size} passkey${this.mem.prf.size === 1 ? '' : 's'}`)
        if (this.mem.wk.size) parts.push(`${this.mem.wk.size} wrapping key${this.mem.wk.size === 1 ? '' : 's'}`)
        if (this.mem.kek) parts.push(`the KEK (SHA-256 ${await finger(this.mem.kek)}…)`)
        if (this.mem.body) parts.push('the plaintext body')
        if (this.mem.keyring) parts.push(`the lab keyring (ciphertext, ${this.mem.keyring.wraps.length} wrap${this.mem.keyring.wraps.length === 1 ? '' : 's'})`)
        this.$('[data-where="memory"]').textContent = parts.length ? `${parts.join('; ')}. Gone on leaving the page.` : 'nothing'
    }

    renderCredentials(pick = null) {
        const select = this.$('[data-credential]')
        select.replaceChildren()
        for (const c of this.record.credentials) select.appendChild(this.el('option', { value : c.id }, `${c.name} · ${c.algName || c.alg} · ${c.prfEnabled ? 'prf' : 'no prf'} · ${c.id.slice(0, 10)}…`))
        if (pick) select.value = pick
        if (!this.record.credentials.length) select.appendChild(this.el('option', { value : '' }, 'none yet'))
    }

    // ── decoding and display ─────────────────────────────────────────────────

    parseAuthData(buffer) {
        const data  = bytes(buffer)
        const flags = data[32]
        const out   = { rpIdHash : hex(data.slice(0, 32)), flags : {}, signCount : new DataView(data.buffer, data.byteOffset + 33, 4).getUint32(0), aaguid : '' }
        for (const [name, bit] of FLAG_BITS) out.flags[name] = Boolean(flags & (1 << bit))
        if (out.flags.AT && data.length >= 55) {
            const a = hex(data.slice(37, 53))
            out.aaguid = `${a.slice(0, 8)}-${a.slice(8, 12)}-${a.slice(12, 16)}-${a.slice(16, 20)}-${a.slice(20)}`
        }
        return out
    }

    clientData(buffer) {
        try { const d = JSON.parse(new TextDecoder().decode(buffer)); return { type : d.type, origin : d.origin, crossOrigin : Boolean(d.crossOrigin) } } catch (error) { return {} }
    }

    flags(flags) {
        const holder = this.el('span', { class : 'flags' })
        for (const [name, , meaning] of FLAG_BITS) holder.appendChild(this.el('span', { class : flags[name] ? 'on' : '', title : meaning }, `${name}${flags[name] ? '' : ' off'}`))
        return holder
    }

    kv(rows) {
        const table = this.el('table', { class : 'kv' })
        const body  = this.el('tbody')
        for (const [k, v] of rows) {
            const tr = this.el('tr')
            tr.appendChild(this.el('th', {}, k))
            const td = this.el('td', { class : 'mono' })
            if (v instanceof Node) td.appendChild(v)
            else td.textContent = v
            tr.appendChild(td)
            body.appendChild(tr)
        }
        table.appendChild(body)
        return table
    }

    show(selector, node) {
        const holder = this.$(selector)
        holder.replaceChildren(node)
        holder.hidden = false
    }

    log(call, input) {
        const li      = this.el('li')
        const details = this.el('details')
        const summary = this.el('summary')
        summary.appendChild(this.el('span', { class : 'call' }, call))
        summary.appendChild(document.createTextNode(` · ${new Date().toLocaleTimeString()} · `))
        const state = this.el('span', {}, 'waiting for the authenticator…')
        summary.appendChild(state)
        details.appendChild(summary)
        details.appendChild(this.el('pre', {}, `in:  ${JSON.stringify(input, null, 1)}`))
        li.appendChild(details)
        this.$('[data-log]').prepend(li)
        return { li, details, state }
    }

    done(entry, output) {
        entry.state.textContent = 'done'
        entry.details.appendChild(this.el('pre', {}, `out: ${JSON.stringify(output, null, 1)}`))
    }

    fail(entry, error) {
        entry.state.textContent = `${error.name || 'error'}: ${error.message}`
        entry.state.className   = 'err'
    }

    logText() {
        return this.$$('[data-log] li').map(li => li.textContent).reverse().join('\n\n')
    }
}

customElements.define('passkey-lab', PasskeyLab)
