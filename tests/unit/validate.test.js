// ── validate.test.js — the gate's checks against fake fixtures and the real tree ──
//
// Runs under `node --test tests/unit/`. The fake secrets below are assembled at
// runtime from pieces so that this file never contains a value the tripwire
// would match; the tripwire scans tests/ too, as it should.

'use strict'

const test   = require('node:test')
const assert = require('node:assert/strict')
const path   = require('node:path')

const V = require(path.join(__dirname, '..', '..', 'admin', 'build', 'validate.js'))

const trips = (text) => V.LEAK_PATTERNS.filter(p => p.re.test(text)).map(p => p.name)

test('leak tripwire: catches each fake shape', () => {
    const fakes = {
        'sgit vault key'             : 'sgit_private_' + 'vault_' + 'FAKEFAKEFAKE0000',
        'sgit read key'              : 'sgit_private_' + 'read_' + 'FAKEFAKEFAKE0000',
        'sgit passphrase:vault_id'   : 'apple-banana-cherry' + ':' + '12345678-1234-1234-1234-123456789abc',
        'AWS access key id'          : 'AK' + 'IA' + 'FAKEFAKEFAKEFAKE',
        'GitHub token'               : 'gh' + 'p_' + 'F'.repeat(36),
        'sk- API key'                : 'sk-' + 'ant-' + 'FAKE'.repeat(8),
        'PEM private key block'      : '-----BEGIN ' + 'RSA PRIVATE KEY-----',
        'Slack token'                : 'xox' + 'b-' + '1234-FAKEFAKEFAKE',
        'Google OAuth client secret' : 'GOC' + 'SPX-' + 'FAKEFAKEFAKEFAKE',
        'service-account JSON'       : '"private_' + 'key_id": "abc"',
        'bare 12-digit number'       : 'account ' + '1234567890' + '12' + ' here',
        'Firebase web API key'       : 'AI' + 'za' + 'A'.repeat(35),
    }
    for (const [name, value] of Object.entries(fakes)) {
        assert.ok(trips(value).includes(name), `${name} should trip on ${value}`)
    }
})

test('leak tripwire: does not trip on the shapes the brief writes about', () => {
    const benign = [
        'the prefix `sgit_private_vault_` is shown on the entry',
        'Google OAuth client secrets (`GOCSPX-`)',
        'service-account JSON (`"private_key_id"`)',
        'AWS `AKIA/ASIA`, GitHub `gh[pousr]_`, `sk-`/`sk-ant-`',
        'sha256:6caa0c5280ef2a5429e832ccef6dddc5e6cae5625ec284f895a516d221dae250',
        '217,266 lines and 1,234,567,890,123 bytes',
        'a 32-byte value 12345678901234567890123456789012 is not twelve digits',
    ]
    for (const text of benign) assert.deepEqual(trips(text), [], `should not trip: ${text}`)
})

test('leak tripwire: AIza is allowed only in config/environments.json', () => {
    const pattern = V.LEAK_PATTERNS.find(p => p.name === 'Firebase web API key')
    assert.deepEqual(pattern.allowIn, ['config/environments.json'])
    assert.deepEqual(V.LEAK_ALLOW_FILES, ['admin/build/validate.js'])
})

test('headingSlug follows GitHub anchors', () => {
    assert.equal(V.headingSlug('## Shipped (12)'.replace(/^#+\s*/, '')), 'shipped-12')
    assert.equal(V.headingSlug('C1. "Type_Safe style" for the generators'), 'c1-typesafe-style-for-the-generators')
    assert.equal(V.headingSlug('What a human must do'), 'what-a-human-must-do')
})

test('isInternalLink', () => {
    assert.equal(V.isInternalLink('/admin/'), true)
    assert.equal(V.isInternalLink('../index.md'), true)
    assert.equal(V.isInternalLink('#top'), true)
    assert.equal(V.isInternalLink('https://sgit.ai/'), false)
    assert.equal(V.isInternalLink('mailto:x@example.com'), false)
    assert.equal(V.isInternalLink('data:text/plain,hi'), false)
    assert.equal(V.isInternalLink('//cdn.example/x.js'), false)
})

test('resolveLink maps directories to index.html and keeps fragments', () => {
    assert.deepEqual(V.resolveLink('admin/index.html', '/'), { rel : 'index.html', fragment : null })
    assert.deepEqual(V.resolveLink('admin/index.html', '/admin/'), { rel : 'admin/index.html', fragment : null })
    assert.deepEqual(V.resolveLink('admin/versions.html', '../docs/ops/release.md#the-version'), { rel : 'docs/ops/release.md', fragment : 'the-version' })
    assert.deepEqual(V.resolveLink('docs/ops/needs.md', 'dns.md?x=1'), { rel : 'docs/ops/dns.md', fragment : null })
})

test('storage keys: literals and constants from the allow-list pass, anything else fails', () => {
    const keys = V.loadStorageKeys()
    assert.ok(keys.local.has('config'))
    assert.ok(keys.session.has('adminOauthState'))
    const call = (store, arg) => `${store}.set` + `Item(${arg}, value)`         // assembled so this file holds no setItem call the gate would scan
    const ok = [
        call('localStorage', "'sgit.secrets.ui.theme'"),
        call('localStorage', 'LOCAL_STORAGE_KEYS.config'),
        call('sessionStorage', 'SESSION_STORAGE_KEYS.adminOauthState'),
    ]
    for (const snippet of ok) assert.deepEqual(V.storageKeyProblems('app/x.js', snippet, keys), [], snippet)
    const bad = [
        call('localStorage', "'kek'"),
        call('localStorage', 'someKey'),
        call('sessionStorage', "'sgit.secrets.config.v1'"),                       // a local key used in session storage
        call('sessionStorage', 'SESSION_STORAGE_KEYS.token'),
    ]
    for (const snippet of bad) assert.equal(V.storageKeyProblems('app/x.js', snippet, keys).length, 1, snippet)
})

test('nextVersionOk: next minor, patch, or major .0.0', () => {
    assert.equal(V.nextVersionOk(null, '0.1.0'), true)
    assert.equal(V.nextVersionOk('0.1.0', '0.2.0'), true)
    assert.equal(V.nextVersionOk('0.2.0', '0.2.1'), true)
    assert.equal(V.nextVersionOk('0.9.3', '1.0.0'), true)
    assert.equal(V.nextVersionOk('0.1.0', '0.3.0'), false)
    assert.equal(V.nextVersionOk('0.1.0', '0.1.2'), false)
    assert.equal(V.nextVersionOk('0.1.0', '1.1.0'), false)
})

test('the eight checks pass on the real tree', () => {
    for (const check of V.CHECKS) {
        assert.deepEqual(check.run(V.ROOT), [], `check ${check.n} ${check.name}`)
    }
})
