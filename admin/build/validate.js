#!/usr/bin/env node
// ── validate.js — the eight-check release gate for secrets.sgit.ai ────────────
//
// No dependencies beyond Node's standard library. Run from anywhere:
//     node admin/build/validate.js
// Exit code 0 means every check passed. Each check returns a list of problems;
// the run prints every problem of every check before failing, so one run shows
// everything. The helpers are exported for tests/unit/validate.test.js and the
// script only runs when invoked directly.
//
// Checks (section 9.3 of the brief):
//   1 version agreement      5 vendor manifest and no runtime script from another origin
//   2 internal links         6 storage rules hash in sync with data/features.json
//   3 canonical host         7 docs/reality.md regenerates identically
//   4 leak tripwire          8 browser storage keys come from app/config/storage-keys.js

'use strict'

const fs            = require('node:fs')
const path          = require('node:path')
const crypto        = require('node:crypto')
const { spawnSync } = require('node:child_process')

const ROOT          = path.resolve(__dirname, '..', '..')
const SKIP_DIRS     = new Set(['.git', 'node_modules', '__pycache__', '.pytest_cache', '_site'])
const TEXT_PROBE    = 8000                                                       // bytes inspected for a NUL to decide binary
const SELF          = 'admin/build/validate.js'

// ── leak tripwire patterns ────────────────────────────────────────────────────
// The fix for a trip is always a redaction, never a wider pattern. `allowIn`
// names the only files where that shape may appear, and why.

const LEAK_PATTERNS = Object.freeze([
    { name : 'sgit vault key'               , re : /sgit_private_vault_[A-Za-z0-9]{6,}/                                                     },
    { name : 'sgit read key'                , re : /sgit_private_read_[A-Za-z0-9]{6,}/                                                      },
    { name : 'sgit passphrase:vault_id'     , re : /\b[a-z]+(?:-[a-z]+){2,}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/ },
    { name : 'AWS access key id'            , re : /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/                                                          },
    { name : 'GitHub token'                 , re : /\bgh[pousr]_[A-Za-z0-9]{30,}\b/                                                         },
    { name : 'sk- API key'                  , re : /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/                                                     },
    { name : 'PEM private key block'        , re : /-----BEGIN [A-Z ]*PRIVATE KEY-----/                                                     },
    { name : 'Slack token'                  , re : /\bxox[bpa]-[A-Za-z0-9-]{10,}\b/                                                         },
    { name : 'Google OAuth client secret'   , re : /\bGOCSPX-[A-Za-z0-9_-]{10,}\b/                                                          },
    { name : 'service-account JSON'         , re : /"private_key_id"\s*:/                                                                   },
    { name : 'bare 12-digit number'         , re : /(?<![\w.\-])\d{12}(?![\w.\-])/                                                          },
    { name : 'Firebase web API key'         , re : /\bAIza[0-9A-Za-z_-]{35}\b/, allowIn : ['config/environments.json'],
      why  : 'Firebase web API keys are public identifiers restricted by referrer; they belong in the config file and nowhere else' },
])

const LEAK_ALLOW_FILES = Object.freeze([SELF])                                    // validate.js names every pattern, so it is exempt

// ── runtime-origin rules (check 5) ────────────────────────────────────────────

const RUNTIME_DIRS          = Object.freeze(['app', 'components', 'admin', 'tests'])
const RUNTIME_RE            = Object.freeze([
    { name : '<script src="http…">'      , re : /<script\b[^>]*\bsrc\s*=\s*["']https?:/i       },
    { name : "import from 'http…'"       , re : /\bfrom\s+["']https?:/                          },
    { name : "import 'http…'"            , re : /\bimport\s*\(?\s*["']https?:/                  },
    { name : '@import url(http…)'        , re : /@import\s+(?:url\()?\s*["']?https?:/i          },
])
const LINK_RELS_THAT_LOAD    = Object.freeze(['stylesheet', 'preload', 'modulepreload', 'prefetch', 'icon', 'manifest'])  // canonical, alternate, license are pointers, not loads
const LINK_TAG_RE            = /<link\b[^>]*>/gi
const RUNTIME_ALLOW         = Object.freeze([
    { dir : 'app/auth/', hosts : ['https://accounts.google.com'] },               // Google's own auth endpoints, section 4.6; popups, never a script
])

// ── storage rules (check 8) ───────────────────────────────────────────────────

const STORAGE_KEYS_FILE     = 'app/config/storage-keys.js'
const STORAGE_SCAN_DIRS     = RUNTIME_DIRS
const STORAGE_CALL_RE       = /\b(localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*([^,)]+)/g
const INDEXED_DB_RE         = /\bindexedDB\b/
const INDEXED_DB_DIRS       = Object.freeze(['app', 'components', 'admin'])      // tests/leak-check.html may scan IndexedDB

// ── helpers ───────────────────────────────────────────────────────────────────

function walkTree(root = ROOT, dir = root, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes : true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walkTree(root, path.join(dir, entry.name), out)
        } else if (entry.isFile()) {
            out.push(path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/'))
        }
    }
    return out.sort()
}

function read(rel, root = ROOT) {
    return fs.readFileSync(path.join(root, rel), 'utf8')
}

function exists(rel, root = ROOT) {
    return fs.existsSync(path.join(root, rel))
}

function isBinary(rel, root = ROOT) {
    const fd  = fs.openSync(path.join(root, rel), 'r')
    const buf = Buffer.alloc(TEXT_PROBE)
    const n   = fs.readSync(fd, buf, 0, TEXT_PROBE, 0)
    fs.closeSync(fd)
    return buf.subarray(0, n).includes(0)
}

function sha256(rel, root = ROOT) {
    return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex')
}

function lineOf(text, index) {
    return text.slice(0, index).split('\n').length
}

function headingSlug(heading) {                                                   // GitHub-style anchors for markdown headings
    return heading.toLowerCase().trim()
        .replace(/<[^>]+>/g, '')
        .replace(/[`*_~]/g, '')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-')
}

function stripCode(markdown) {                                                    // fenced blocks and inline code are not links
    return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
}

function isInternalLink(href) {
    if (!href) return false
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('/')) return false // http:, https:, mailto:, data:, javascript:
    if (href.startsWith('//')) return false
    return true
}

function resolveLink(fromRel, href, root = ROOT) {                                // → { rel, fragment, isDir }
    const [withoutQuery]        = href.split('?')
    const [target, fragment]    = withoutQuery.split('#')
    let rel
    if (target === '')       rel = fromRel
    else if (target.startsWith('/')) rel = target.slice(1)
    else                     rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), target))
    if (rel === '.' || rel === '') rel = ''
    const abs = path.join(root, rel)
    if (rel === '' || (fs.existsSync(abs) && fs.statSync(abs).isDirectory())) {
        rel = path.posix.join(rel, 'index.html')
    }
    return { rel, fragment : fragment || null }
}

function anchorsIn(rel, root = ROOT) {
    const text  = read(rel, root)
    const found = new Set()
    for (const match of text.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/g)) found.add(match[1])
    if (rel.endsWith('.md')) {
        for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) found.add(headingSlug(match[1]))
    }
    return found
}

function linksIn(rel, root = ROOT) {                                              // → [{ href, line }]
    const text  = read(rel, root)
    const links = []
    if (rel.endsWith('.html')) {
        for (const match of text.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/g)) {
            links.push({ href : match[1], line : lineOf(text, match.index) })
        }
    } else if (rel.endsWith('.md')) {
        const scan = stripCode(text)
        for (const match of scan.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
            links.push({ href : match[1], line : lineOf(scan, match.index) })
        }
    }
    return links
}

function readVersion(root = ROOT) {
    return read('admin/build/version.txt', root).trim()
}

function loadStorageKeys(root = ROOT) {                                           // → { local: Map(name→value), session: Map(name→value) }
    const text   = read(STORAGE_KEYS_FILE, root)
    const parse  = (constName) => {
        const block = text.match(new RegExp(`export const ${constName}\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\)`))
        const map   = new Map()
        if (!block) return map
        for (const match of block[1].matchAll(/(\w+)\s*:\s*'([^']+)'/g)) map.set(match[1], match[2])
        return map
    }
    return { local : parse('LOCAL_STORAGE_KEYS'), session : parse('SESSION_STORAGE_KEYS') }
}

function storageKeyProblems(rel, text, keys) {                                    // check 8 on one file's text
    const problems = []
    for (const match of text.matchAll(STORAGE_CALL_RE)) {
        const store   = match[1]
        const arg     = match[2].trim()
        const allowed = store === 'localStorage' ? keys.local : keys.session
        const constOf = store === 'localStorage' ? 'LOCAL_STORAGE_KEYS' : 'SESSION_STORAGE_KEYS'
        const literal = arg.match(/^(['"])(.*)\1$/)
        const member  = arg.match(new RegExp(`^${constOf}\\.(\\w+)$`))
        const line    = lineOf(text, match.index)
        if (literal) {
            if (![...allowed.values()].includes(literal[2])) problems.push(`${rel}:${line}: ${store}.setItem key '${literal[2]}' is not in ${STORAGE_KEYS_FILE}`)
        } else if (member) {
            if (!allowed.has(member[1])) problems.push(`${rel}:${line}: ${constOf}.${member[1]} is not defined in ${STORAGE_KEYS_FILE}`)
        } else {
            problems.push(`${rel}:${line}: ${store}.setItem key must be a literal or ${constOf}.<name>, got ${arg}`)
        }
    }
    return problems
}

function nextVersionOk(previous, next) {                                           // next minor, a patch, or a deliberate major .0.0
    if (!previous) return true
    const [pM, pm, pp] = previous.split('.').map(Number)
    const [nM, nm, np] = next.split('.').map(Number)
    if (nM === pM && nm === pm + 1 && np === 0) return true
    if (nM === pM && nm === pm && np === pp + 1) return true
    if (nM === pM + 1 && nm === 0 && np === 0) return true
    return false
}

// ── the checks ────────────────────────────────────────────────────────────────

function checkVersionAgreement(root = ROOT) {
    const problems = []
    const version  = readVersion(root)
    if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push(`admin/build/version.txt: '${version}' is not X.Y.Z`)

    for (const rel of walkTree(root).filter(f => f.endsWith('.html'))) {
        const text   = read(rel, root)
        const badges = [...text.matchAll(/data-version="([^"]+)"/g)].map(m => m[1])
        if (!text.includes('sg-secrets:head:start')) continue
        if (badges.length === 0) problems.push(`${rel}: no version badge (data-version)`)
        for (const badge of badges) if (badge !== version) problems.push(`${rel}: badge says ${badge}, version.txt says ${version}`)
    }

    const releases = JSON.parse(read('data/versions.json', root)).releases
    const seen     = new Set()
    for (const release of releases) {
        if (seen.has(release.version)) problems.push(`data/versions.json: ${release.version} listed twice`)
        seen.add(release.version)
    }
    if (!releases.length || releases[0].version !== version) problems.push(`data/versions.json: newest row is ${releases[0] && releases[0].version}, version.txt says ${version}`)
    const versionsPage = read('admin/versions.html', root)
    if (!versionsPage.includes(`<code>v${version}</code>`)) problems.push(`admin/versions.html: no row for v${version}`)

    for (const rel of ['llms.txt', 'llms-full.txt']) {
        const match = read(rel, root).match(/^Site version: v(\d+\.\d+\.\d+)/m)
        if (!match) problems.push(`${rel}: no 'Site version: vX.Y.Z' line`)
        else if (match[1] !== version) problems.push(`${rel}: says ${match[1]}, version.txt says ${version}`)
    }
    const twin = read('index.md', root).match(/· site v(\d+\.\d+\.\d+)/)
    if (!twin) problems.push('index.md: no "site vX.Y.Z" in the source line')
    else if (twin[1] !== version) problems.push(`index.md: says ${twin[1]}, version.txt says ${version}`)

    const config = JSON.parse(read('config/environments.json', root))
    if (config.siteVersion !== version) problems.push(`config/environments.json#siteVersion is ${config.siteVersion}, version.txt says ${version}`)
    return problems
}

function checkInternalLinks(root = ROOT) {
    const problems = []
    const anchors  = new Map()
    const anchorsOf = (rel) => {
        if (!anchors.has(rel)) anchors.set(rel, anchorsIn(rel, root))
        return anchors.get(rel)
    }
    for (const rel of walkTree(root).filter(f => f.endsWith('.html') || f.endsWith('.md'))) {
        for (const { href, line } of linksIn(rel, root)) {
            if (!isInternalLink(href)) continue
            const { rel : target, fragment } = resolveLink(rel, href, root)
            if (!exists(target, root) || fs.statSync(path.join(root, target)).isDirectory()) {
                problems.push(`${rel}:${line}: link '${href}' → ${target} does not exist`)
                continue
            }
            if (fragment && (target.endsWith('.html') || target.endsWith('.md')) && !anchorsOf(target).has(fragment)) {
                problems.push(`${rel}:${line}: fragment '#${fragment}' not found in ${target}`)
            }
        }
    }
    return problems
}

function checkCanonicalHost(root = ROOT) {
    const problems = []
    const host     = read('CNAME', root).trim()
    const base     = `https://${host}/`
    for (const rel of walkTree(root).filter(f => f.endsWith('.html'))) {
        const text = read(rel, root)
        if (!text.includes('sg-secrets:head:start')) continue
        const canonical = text.match(/<link rel="canonical" href="([^"]+)">/)
        const og        = text.match(/<meta property="og:url" content="([^"]+)">/)
        if (!canonical)                              problems.push(`${rel}: no rel=canonical`)
        else if (!canonical[1].startsWith(base))     problems.push(`${rel}: canonical ${canonical[1]} is not on ${base}`)
        if (!og)                                     problems.push(`${rel}: no og:url`)
        else if (!og[1].startsWith(base))            problems.push(`${rel}: og:url ${og[1]} is not on ${base}`)
        if (canonical && og && canonical[1] !== og[1]) problems.push(`${rel}: canonical and og:url differ`)
    }
    return problems
}

function checkLeakTripwire(root = ROOT) {
    const problems = []
    for (const rel of walkTree(root)) {
        if (LEAK_ALLOW_FILES.includes(rel)) continue
        if (isBinary(rel, root)) continue
        const text = read(rel, root)
        for (const pattern of LEAK_PATTERNS) {
            if (pattern.allowIn && pattern.allowIn.includes(rel)) continue
            const match = pattern.re.exec(text)
            if (match) problems.push(`${rel}:${lineOf(text, match.index)}: looks like a ${pattern.name} (${match[0].slice(0, 6)}…). Redact it.`)
        }
    }
    return problems
}

function checkVendorManifest(root = ROOT) {
    const problems = []
    const manifest = JSON.parse(read('vendor/MANIFEST.json', root)).files
    const present  = walkTree(root).filter(f => f.startsWith('vendor/') && f !== 'vendor/MANIFEST.json').map(f => f.slice('vendor/'.length))
    for (const file of present) {
        if (!manifest[file])                             problems.push(`vendor/${file} is not listed in vendor/MANIFEST.json`)
        else if (manifest[file].sha256 !== sha256(`vendor/${file}`, root)) problems.push(`vendor/${file}: sha256 ${sha256(`vendor/${file}`, root)} does not match the manifest`)
    }
    for (const file of Object.keys(manifest)) {
        if (!present.includes(file)) problems.push(`vendor/MANIFEST.json lists ${file} but it is not in vendor/`)
        for (const key of ['source', 'version', 'sha256', 'licence']) if (!manifest[file][key]) problems.push(`vendor/MANIFEST.json: ${file} has no ${key}`)
    }
    for (const rel of walkTree(root).filter(f => RUNTIME_DIRS.some(d => f.startsWith(d + '/')) && /\.(html|js|mjs|css)$/.test(f))) {
        const text = read(rel, root)
        const foreign = (index, name) => {
            const url     = text.slice(index).match(/https?:\/\/[^"')\s]+/)
            const allowed = RUNTIME_ALLOW.some(a => rel.startsWith(a.dir) && url && a.hosts.some(h => url[0].startsWith(h)))
            if (!allowed) problems.push(`${rel}:${lineOf(text, index)}: ${name} loads from another origin. Vendor it, hash it, or do without.`)
        }
        for (const rule of RUNTIME_RE) {
            for (const match of text.matchAll(new RegExp(rule.re.source, rule.re.flags + 'g'))) foreign(match.index, rule.name)
        }
        for (const match of text.matchAll(LINK_TAG_RE)) {
            const relAttr = match[0].match(/\brel\s*=\s*["']([^"']+)["']/i)
            const href    = match[0].match(/\bhref\s*=\s*["'](https?:[^"']*)["']/i)
            if (relAttr && href && LINK_RELS_THAT_LOAD.includes(relAttr[1].toLowerCase())) foreign(match.index, `<link rel="${relAttr[1]}" href="http…">`)
        }
    }
    return problems
}

function checkRulesInSync(root = ROOT) {
    const features = JSON.parse(read('data/features.json', root))
    if (!exists(features.rulesSource, root)) return [`${features.rulesSource} does not exist`]
    const actual = 'sha256:' + sha256(features.rulesSource, root)
    if (actual !== features.rulesHash) return [`${features.rulesSource} hashes to ${actual}; data/features.json#rulesHash says ${features.rulesHash}. A rules change needs a release note and the new hash.`]
    return []
}

function checkReality(root = ROOT) {
    const run = spawnSync('python3', ['admin/build/gen_features.py', '--check'], { cwd : root, encoding : 'utf8' })
    if (run.error) return [`could not run gen_features.py --check: ${run.error.message}`]
    if (run.status !== 0) return [`gen_features.py --check failed:\n${(run.stdout + run.stderr).trim()}`]
    return []
}

function checkStorageKeys(root = ROOT) {
    const problems = []
    if (!exists(STORAGE_KEYS_FILE, root)) return [`${STORAGE_KEYS_FILE} does not exist`]
    const keys = loadStorageKeys(root)
    if (keys.local.size === 0) problems.push(`${STORAGE_KEYS_FILE}: LOCAL_STORAGE_KEYS is empty or unreadable`)
    for (const rel of walkTree(root).filter(f => STORAGE_SCAN_DIRS.some(d => f.startsWith(d + '/')) && /\.(html|js|mjs)$/.test(f))) {
        if (rel === STORAGE_KEYS_FILE || rel === SELF) continue                 // the gate names the forbidden shapes
        const text = read(rel, root)
        problems.push(...storageKeyProblems(rel, text, keys))
        if (INDEXED_DB_DIRS.some(d => rel.startsWith(d + '/')) && INDEXED_DB_RE.test(text)) {
            problems.push(`${rel}:${lineOf(text, text.search(INDEXED_DB_RE))}: indexedDB is not used by this app; nothing derived from a key is stored`)
        }
    }
    return problems
}

const CHECKS = Object.freeze([
    { n : 1, name : 'version agreement'                         , run : checkVersionAgreement },
    { n : 2, name : 'internal links and fragments resolve'      , run : checkInternalLinks    },
    { n : 3, name : 'canonical host'                            , run : checkCanonicalHost    },
    { n : 4, name : 'leak tripwire'                             , run : checkLeakTripwire     },
    { n : 5, name : 'vendor manifest, no runtime foreign origin', run : checkVendorManifest   },
    { n : 6, name : 'storage rules in sync'                     , run : checkRulesInSync      },
    { n : 7, name : 'reality regenerates identically'           , run : checkReality          },
    { n : 8, name : 'browser storage keys are allow-listed'     , run : checkStorageKeys      },
])

function main() {
    let failed = 0
    for (const check of CHECKS) {
        let problems
        try { problems = check.run(ROOT) } catch (error) { problems = [`threw: ${error.message}`] }
        if (problems.length === 0) {
            console.log(`  ✓ ${check.n}/8 ${check.name}`)
        } else {
            failed += 1
            console.log(`  ✗ ${check.n}/8 ${check.name}`)
            for (const problem of problems) console.log(`      ${problem}`)
        }
    }
    if (failed) {
        console.log(`validate: ${failed} of 8 checks failed (site v${readVersion()})`)
        process.exit(1)
    }
    console.log(`validate: 8/8 checks passed (site v${readVersion()})`)
}

module.exports = {
    ROOT, LEAK_PATTERNS, LEAK_ALLOW_FILES, RUNTIME_RE, RUNTIME_ALLOW, LINK_RELS_THAT_LOAD, CHECKS,
    walkTree, isBinary, sha256, headingSlug, stripCode, isInternalLink, resolveLink, anchorsIn, linksIn,
    loadStorageKeys, storageKeyProblems, nextVersionOk,
    checkVersionAgreement, checkInternalLinks, checkCanonicalHost, checkLeakTripwire,
    checkVendorManifest, checkRulesInSync, checkReality, checkStorageKeys,
}

if (require.main === module) main()
