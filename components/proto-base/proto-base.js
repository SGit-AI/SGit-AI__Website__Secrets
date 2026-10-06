/**
 * proto-base — the base of the design prototype under /mockups/, and its store.
 * The store is the pretend app: who is signed in, which environment, whether
 * the keyring is locked, the entries, the devices, the recovery code, plus a
 * log of every action and a count of every screen visited, all in localStorage
 * under LOCAL_STORAGE_KEYS.proto so a reader can click through the screens as
 * if the app existed and see their own data come back. Every value is
 * invented; nothing here is a secret, and the real app will never store what
 * this stores. The screens, the paths between them and the three UX variants
 * come from mockups/screens.json. The picked variant is kept under
 * LOCAL_STORAGE_KEYS.protoUx. Events go through document, namespaced `proto:`.
 *
 * @module proto-base
 * @version 0.1.0
 */
import { SgBase, READER_EVENTS } from '../sg-base/sg-base.js'
import { LOCAL_STORAGE_KEYS }    from '../../app/config/storage-keys.js'

export const PROTO_EVENTS = Object.freeze({
    ready   : 'proto:ready',                                                      // the screens are loaded
    state   : 'proto:state',                                                      // { action, detail }: the pretend state changed
    screen  : 'proto:screen',                                                     // { screen }: the current screen changed
    variant : 'proto:variant',                                                    // { variant }: the UX variant changed
})

export const KINDS      = Object.freeze(['password', 'api-key', 'sgit-vault-key', 'sgit-read-key', 'pki-private-key', 'note'])
export const ENVS       = Object.freeze(['prod', 'dev', 'main'])
export const SOFT_LIMIT = 1024 * 1024
export const LOG_LIMIT  = 400
const SCREENS_URL       = new URL('../../mockups/screens.json', import.meta.url)
const WORDS             = Object.freeze(['apple', 'river', 'stone', 'cloud', 'maple', 'harbour', 'lantern', 'copper', 'meadow', 'violet', 'ember', 'quartz'])

function id()    { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }
function now()   { return new Date().toISOString() }
function words(n) { return Array.from({ length : n }, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join('-') }

export function emptyState() {
    return { v : 1, user : null, env : 'dev', keyring : null, locked : true, selected : null, entries : [], devices : [], checks : null, probes : null,
             votes : {}, log : [], visits : {} }
}

class ProtoStore {

    constructor() {
        this.screens  = []
        this.edges    = []
        this.variants = []
        this.state    = this.read()
        this.screen   = null
        this.variant  = this.readVariant()
        this.loaded   = null
        this.ready    = this.load()
    }

    async load() {
        try {
            const data    = await (await fetch(SCREENS_URL, { cache : 'no-cache' })).json()
            this.screens  = data.screens
            this.edges    = data.edges
            this.variants = data.variants
            this.loaded   = data
        } catch (error) {
            this.loaded = { error : error.message }
        }
        this.emit(PROTO_EVENTS.ready, { screens : this.screens.length })
        return this
    }

    // ── persistence ─────────────────────────────────────────────────────────

    read() {
        try {
            const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.proto) || 'null')
            if (data && data.v === 1) return { ...emptyState(), ...data }
        } catch (error) { /* absent or unreadable: start empty */ }
        return emptyState()
    }

    save() {
        try { localStorage.setItem(LOCAL_STORAGE_KEYS.proto, JSON.stringify(this.state)) } catch (error) { /* storage blocked: the prototype still runs for this page */ }
    }

    readVariant() {
        try { return localStorage.getItem(LOCAL_STORAGE_KEYS.protoUx) || 'desk' } catch (error) { return 'desk' }
    }

    setVariant(name) {
        this.variant = name
        try { localStorage.setItem(LOCAL_STORAGE_KEYS.protoUx, name) } catch (error) { /* not kept */ }
        this.act('variant', { variant : name })
        this.emit(PROTO_EVENTS.variant, { variant : name })
    }

    // ── screens and paths ───────────────────────────────────────────────────

    byId(screenId) { return this.screens.find(s => s.id === screenId) || null }

    go(screenId, how = 'link') {
        if (!this.byId(screenId) && this.screens.length) return
        this.screen = screenId
        this.state.visits[screenId] = (this.state.visits[screenId] || 0) + 1
        this.log('go', { to : screenId, how })
        this.save()
        this.emit(PROTO_EVENTS.screen, { screen : screenId })
    }

    pathsFrom(screenId) { return this.edges.filter(e => e.from === screenId) }

    pathsTo(screenId)   { return this.edges.filter(e => e.to === screenId) }

    next() {                                                                      // where the app would send the user from here, by its own rules
        const s = this.state
        if (!s.user) return 'sign-in'
        if (!s.keyring) return 'setup'
        if (s.locked) return 'unlock'
        return 'vault'
    }

    // ── actions: every one logged ───────────────────────────────────────────

    log(action, detail = {}) {
        this.state.log.push({ t : now(), screen : this.screen, action, detail })
        if (this.state.log.length > LOG_LIMIT) this.state.log.splice(0, this.state.log.length - LOG_LIMIT)
    }

    act(action, detail = {}, mutate = null) {
        if (mutate) mutate(this.state)
        this.log(action, detail)
        this.save()
        this.emit(PROTO_EVENTS.state, { action, detail })
    }

    signIn(method, email = 'dinis@example.com') {
        this.act('sign-in', { method, email }, (s) => { s.user = { email, method, since : now() } })
    }

    signOut() {
        this.act('sign-out', {}, (s) => { s.user = null; s.locked = true; s.selected = null })
    }

    createKeyring() {
        this.act('create-keyring', {}, (s) => {
            s.keyring = { created : now(), recovery : words(4) + '-' + Math.floor(1000 + Math.random() * 9000), recoveryShown : true, version : 1 }
            s.devices = [{ id : id(), name : 'This browser', added : now(), last : now(), prf : true }]
            s.locked  = false
        })
    }

    unlock(method) {
        this.act('unlock', { method }, (s) => { s.locked = false; s.unlockedAt = now(); for (const d of s.devices.slice(0, 1)) d.last = now() })
    }

    lock(why = 'button') {
        this.act('lock', { why }, (s) => { s.locked = true; s.selected = null })
    }

    addEntry(entry) {
        const record = { id : id(), kind : entry.kind, title : entry.title, secret : entry.secret || '', notes : entry.notes || '', created : now(), updated : now(), revealed : 0, copied : 0 }
        this.act('add-entry', { kind : record.kind, title : record.title }, (s) => { s.entries.unshift(record); s.selected = record.id })
        return record
    }

    updateEntry(entryId, patch) {
        this.act('edit-entry', { id : entryId, fields : Object.keys(patch) }, (s) => {
            const entry = s.entries.find(e => e.id === entryId)
            if (entry) Object.assign(entry, patch, { updated : now() })
        })
    }

    deleteEntry(entryId) {
        this.act('delete-entry', { id : entryId }, (s) => { s.entries = s.entries.filter(e => e.id !== entryId); if (s.selected === entryId) s.selected = null })
    }

    select(entryId) {
        this.act('open-entry', { id : entryId }, (s) => { s.selected = entryId })
    }

    reveal(entryId) {
        this.act('reveal', { id : entryId }, (s) => { const e = s.entries.find(x => x.id === entryId); if (e) e.revealed++ })
    }

    copy(entryId) {
        this.act('copy', { id : entryId }, (s) => { const e = s.entries.find(x => x.id === entryId); if (e) e.copied++ })
    }

    addDevice(name) {
        this.act('add-device', { name }, (s) => { s.devices.push({ id : id(), name, added : now(), last : null, prf : true }) })
    }

    removeDevice(deviceId) {
        this.act('remove-device', { id : deviceId }, (s) => { s.devices = s.devices.filter(d => d.id !== deviceId) })
    }

    regenerateRecovery() {
        this.act('regenerate-recovery', {}, (s) => { if (s.keyring) { s.keyring.recovery = words(4) + '-' + Math.floor(1000 + Math.random() * 9000); s.keyring.recoveryShown = true } })
    }

    setEnv(env) {
        if (!ENVS.includes(env)) return
        this.act('set-env', { env }, (s) => { s.env = env; s.user = null; s.locked = true; s.selected = null })
    }

    runChecks() {
        const rows = ['Identity Platform: Google provider', 'Identity Platform: email provider', 'Authorised domains', 'Bucket exists', 'Bucket CORS', 'Storage rules deployed', 'Rules hash matches', 'Lifecycle rule']
        this.act('run-checks', {}, (s) => { s.checks = rows.map((name, i) => ({ name, ok : i % 5 !== 3, fixable : i === 3 || i === 4, at : now() })) })
    }

    fixCheck(index) {
        this.act('fix-check', { index }, (s) => { if (s.checks && s.checks[index]) { s.checks[index].ok = true; s.checks[index].at = now() } })
    }

    runProbes() {
        const names = ['webauthn-prf', 'crypto', 'config', 'auth', 'storage', 'keyring-roundtrip', 'offline', 'leak-check']
        this.act('run-probes', {}, (s) => { s.probes = names.map((name, i) => ({ name, result : i === 0 ? 'skip' : 'pass', ms : 40 + i * 17, at : now() })) })
    }

    vote(variant, up) {
        this.act('vote', { variant, up }, (s) => { const v = s.votes[variant] || { up : 0, down : 0 }; v[up ? 'up' : 'down']++; s.votes[variant] = v })
        const name = (this.variants.find(v => v.id === variant) || {}).name || variant
        document.dispatchEvent(new CustomEvent(READER_EVENTS.note, { detail : { text : `Prototype UX ${name}: ${up ? 'works for me' : 'does not work for me'}`, page : location.pathname, via : 'prototype' }, bubbles : true, composed : true }))
    }

    seed() {
        this.act('seed', {}, (s) => {
            s.user    = { email : 'dinis@example.com', method : 'google', since : now() }
            s.keyring = { created : now(), recovery : 'apple-river-stone-cloud-4821', recoveryShown : false, version : 1 }
            s.locked  = false
            s.devices = [{ id : id(), name : 'This browser', added : now(), last : now(), prf : true }, { id : id(), name : 'Phone (iOS)', added : '2026-09-20T09:00:00Z', last : '2026-10-01T18:00:00Z', prf : true }]
            s.entries = [
                { id : id(), kind : 'password',        title : 'github.com (dinis)',               secret : 'correct-horse-battery-staple', notes : '',                              created : '2026-09-01T10:00:00Z', updated : '2026-10-04T10:00:00Z', revealed : 2, copied : 5 },
                { id : id(), kind : 'sgit-vault-key',  title : 'sgit.ai board vault',              secret : 'an invented vault key, 44 characters in the real thing', notes : 'opens the board vault; share with care', created : '2026-09-10T10:00:00Z', updated : '2026-10-01T10:00:00Z', revealed : 1, copied : 3 },
                { id : id(), kind : 'sgit-read-key',   title : 'code review graphs (published)',   secret : 'an invented read key', notes : '',                     created : '2026-09-30T10:00:00Z', updated : '2026-09-30T10:00:00Z', revealed : 0, copied : 1 },
                { id : id(), kind : 'api-key',         title : 'OpenRouter, infographic-gen',      secret : 'an invented API key',   notes : 'spend limit 10/month',        created : '2026-09-21T10:00:00Z', updated : '2026-09-21T10:00:00Z', revealed : 0, copied : 2 },
                { id : id(), kind : 'pki-private-key', title : 'sgit pki: dinis@example.com',      secret : 'an invented PEM block',     notes : '',                            created : '2026-09-18T10:00:00Z', updated : '2026-09-18T10:00:00Z', revealed : 0, copied : 0 },
                { id : id(), kind : 'note',            title : 'Wi-Fi at the office',              secret : 'guest network, ask reception', notes : '',                              created : '2026-08-02T10:00:00Z', updated : '2026-08-02T10:00:00Z', revealed : 3, copied : 0 },
            ]
            s.selected = s.entries[1].id
        })
    }

    reset() {
        const fresh = emptyState()
        this.state  = fresh
        this.act('reset', {})
    }

    // ── figures for the column ──────────────────────────────────────────────

    size() { return JSON.stringify({ entries : this.state.entries, devices : this.state.devices }).length }

    byKind() {
        const counts = Object.fromEntries(KINDS.map(k => [k, 0]))
        for (const entry of this.state.entries) counts[entry.kind] = (counts[entry.kind] || 0) + 1
        return counts
    }

    emit(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail, bubbles : true, composed : true })) }
}

const store = new ProtoStore()

export class ProtoBase extends SgBase {
    static jsUrl = import.meta.url

    static get store() { return store }

    get resourceName() { return 'proto-base' }

    svg(tag, attrs = {}, text = null) {                                           // SVG elements for the column's charts and graph
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
        if (text !== null) node.textContent = text
        return node
    }
}

customElements.define('proto-base', ProtoBase)
