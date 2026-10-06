// ── derive_js.mjs — the JavaScript half of the derivation: files in, syntax trees out ──
//
// Reads repo-relative paths on stdin (one per line), parses each with the
// vendored acorn (vendor/acorn.mjs, hashed in vendor/MANIFEST.json), and writes
// one JSON object to stdout: per file, its imports, exports, classes (with
// their methods, each method's calls), free functions and the custom element
// it defines. No resolution happens here; derive.py joins names across files.
// Run by derive.py only; never by a page.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as acorn from '../../vendor/acorn.mjs'

const ROOT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', '..')      // the repository, or a fixture root

function leadingComment(source, node) {                                          // the JSDoc or line comments just above a node, as plain text
    const before = source.slice(0, node.start)
    const block  = before.match(/\/\*\*?([\s\S]*?)\*\/\s*$/)
    if (block) return block[1].split('\n').map(l => l.replace(/^\s*\*\s?/, '')).join('\n').trim()
    const lines = before.split('\n').slice(-1 - 8, -1).reverse()
    const out   = []
    for (const line of lines) {
        const m = line.match(/^\s*\/\/\s?(.*)$/)
        if (!m) break
        out.unshift(m[1])
    }
    return out.join('\n').trim()
}

function trailingComment(source, node) {                                         // a // comment on the node's first line
    const lineEnd = source.indexOf('\n', node.start)
    const line    = source.slice(node.start, lineEnd < 0 ? source.length : lineEnd)
    const m       = line.match(/\/\/\s?(.*)$/)
    return m ? m[1].trim() : ''
}

function calleeName(callee) {                                                    // -> { name, via } for Identifier and MemberExpression callees
    if (callee.type === 'Identifier') return { name : callee.name, via : '' }
    if (callee.type === 'MemberExpression' && !callee.computed) {
        const prop = callee.property.name
        const obj  = callee.object
        const via  = obj.type === 'ThisExpression' ? 'this' : obj.type === 'Super' ? 'super' : obj.type === 'Identifier' ? obj.name : obj.type === 'MemberExpression' && !obj.computed ? `${obj.object.type === 'ThisExpression' ? 'this' : (obj.object.name || '…')}.${obj.property.name}` : '…'
        return { name : prop, via }
    }
    return null
}

function walk(node, visit, parent = null) {
    if (!node || typeof node.type !== 'string') return
    if (visit(node, parent) === false) return
    for (const key of Object.keys(node)) {
        const value = node[key]
        if (Array.isArray(value)) { for (const child of value) if (child && typeof child.type === 'string') walk(child, visit, node) }
        else if (value && typeof value.type === 'string') walk(value, visit, node)
    }
}

function callsIn(body, source) {                                                 // every call inside a function body, outermost function only
    const calls = []
    walk(body, (node) => {
        if (node !== body && (node.type === 'FunctionDeclaration')) return false
        if (node.type === 'CallExpression' || node.type === 'NewExpression') {
            const named = calleeName(node.callee)
            if (named) calls.push({ name : named.name, via : named.via, line : source.slice(0, node.start).split('\n').length, kind : node.type === 'NewExpression' ? 'construct' : 'call' })
        }
        return true
    })
    return calls
}

function lineOf(source, index) { return source.slice(0, index).split('\n').length }

function readFile(path) {
    const source = readFileSync(join(ROOT, path), 'utf8')
    const out    = { path, lines : source.split('\n').length, imports : [], exports : [], classes : [], functions : [], defines : [], header : '', error : null }
    const head   = source.match(/^\s*\/\*\*?([\s\S]*?)\*\/|^\s*((?:\/\/.*\n)+)/)
    if (head) out.header = (head[1] || head[2] || '').split('\n').map(l => l.replace(/^\s*(\*|\/\/)\s?/, '')).join('\n').trim()
    let tree
    try {
        tree = acorn.parse(source, { ecmaVersion : 'latest', sourceType : 'module', locations : false, allowHashBang : true })
    } catch (error) {
        out.error = error.message
        return out
    }
    const seen = new Set()
    for (const node of tree.body) {
        if (node.type === 'ImportDeclaration') {
            for (const spec of node.specifiers) out.imports.push({ module : node.source.value, name : spec.imported ? spec.imported.name : spec.local.name, as : spec.local.name, line : lineOf(source, node.start) })
            if (!node.specifiers.length) out.imports.push({ module : node.source.value, name : '*', as : '', line : lineOf(source, node.start) })
        }
        if (node.type === 'ExportNamedDeclaration' && node.declaration) {
            const decl = node.declaration
            if (decl.type === 'ClassDeclaration' || decl.type === 'FunctionDeclaration') out.exports.push(decl.id.name)
            if (decl.type === 'VariableDeclaration') for (const d of decl.declarations) if (d.id.type === 'Identifier') out.exports.push(d.id.name)
        }
    }
    walk(tree, (node) => {
        if (node.type === 'ClassDeclaration' || (node.type === 'ClassExpression' && node.id)) {
            if (seen.has(node)) return true
            seen.add(node)
            const cls = { name : node.id.name, superClass : node.superClass && node.superClass.type === 'Identifier' ? node.superClass.name : (node.superClass ? 'expression' : null),
                          line : lineOf(source, node.start), end : lineOf(source, node.end), doc : leadingComment(source, node), methods : [] }
            for (const member of node.body.body) {
                if (member.type !== 'MethodDefinition' && member.type !== 'PropertyDefinition') continue
                const name = member.key.type === 'Identifier' ? member.key.name : member.key.type === 'Literal' ? String(member.key.value) : 'computed'
                if (member.type === 'PropertyDefinition') { cls.methods.push({ name, kind : member.static ? 'static field' : 'field', line : lineOf(source, member.start), end : lineOf(source, member.end), doc : trailingComment(source, member), calls : [], params : [] }); continue }
                cls.methods.push({ name, kind : member.kind === 'get' ? 'getter' : member.kind === 'set' ? 'setter' : member.static ? 'static' : member.kind === 'constructor' ? 'constructor' : 'method',
                                   line : lineOf(source, member.start), end : lineOf(source, member.end), doc : trailingComment(source, member) || leadingComment(source, member),
                                   params : member.value.params.map(p => p.type === 'Identifier' ? p.name : p.type === 'AssignmentPattern' && p.left.type === 'Identifier' ? p.left.name : '…'),
                                   calls : callsIn(member.value.body, source) })
            }
            out.classes.push(cls)
            return true
        }
        if (node.type === 'FunctionDeclaration' && node.id) {
            out.functions.push({ name : node.id.name, line : lineOf(source, node.start), end : lineOf(source, node.end), doc : trailingComment(source, node) || leadingComment(source, node),
                                 params : node.params.map(p => p.type === 'Identifier' ? p.name : '…'), calls : callsIn(node.body, source), async : Boolean(node.async) })
            return false
        }
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && node.callee.object.name === 'customElements' && node.callee.property.name === 'define' && node.arguments[0] && node.arguments[0].type === 'Literal') {
            out.defines.push({ element : node.arguments[0].value, class : node.arguments[1] && node.arguments[1].type === 'Identifier' ? node.arguments[1].name : '', line : lineOf(source, node.start) })
        }
        return true
    })
    return out
}

const paths = readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
const files = {}
for (const path of paths) files[path] = readFile(path)
process.stdout.write(JSON.stringify(files))
