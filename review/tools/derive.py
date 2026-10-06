# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Derive
# Step 2 of the review brief: the code graph, derived bottom up from the syntax
# tree by parsers, never by a model. Python through the standard library's
# ast; JavaScript through the vendored acorn (derive_js.mjs, run by node);
# every other source file counted and hashed. Writes review/graph/index.json, files.json,
# modules.json, classes.json, methods.json, tests.json and surfaces.json in the
# review brief's shapes, each with provenance (tool, commit, tree hash, every
# input's hash), sorted so two runs on the same tree are byte-identical. The
# words a file says about itself (its banner comment, a def's trailing comment,
# a JSDoc) travel with the node as `doc`: the technical explanation layer, from
# the code's own comments, with no model in between.
# Usage: python3 review/tools/derive.py [--check] [--root PATH] [--out PATH]
# ═══════════════════════════════════════════════════════════════════════════════

import ast
import hashlib
import json
import re
import subprocess
import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from review_tree import ROOT, REVIEW, Review__Tree                                # noqa: E402


TOOL        = 'review/tools/derive.py'
DERIVE_JS   = Path(__file__).resolve().parent / 'derive_js.mjs'
LANGUAGES   = {'.py': 'python', '.js': 'javascript', '.mjs': 'javascript', '.html': 'html', '.css': 'css', '.yml': 'yaml', '.sh': 'shell', '.json': 'json', '.tf': 'terraform', '.rules': 'rules', '.md': 'markdown', '.txt': 'text'}
RE_BANNER   = re.compile(r'^(?:#.*\n)+')
RE_TITLE    = re.compile(r'<title>(.*?)</title>', re.S)
RE_ELEMENT  = re.compile(r'<([a-z][a-z0-9]*-[a-z0-9-]+)\b')
RE_PY_TEST  = re.compile(r'^\s+def (test_\w+)\(', re.M)
RE_JS_TEST  = re.compile(r"^test\(\s*'([^']+)'", re.M)
RE_SLUG     = re.compile(r'[^A-Za-z0-9._-]+')


class Derive:

    def __init__(self, check=False, root=None, out=None):
        self.check  = check
        if root:                                                                  # a fixture root brings its own globs in review.config.json, else the project's
            root_path = Path(root).resolve()
            own       = root_path / 'review.config.json'
            self.tree = Review__Tree(root_path, own) if own.exists() else Review__Tree(root_path)
        else:
            self.tree = Review__Tree()
        self.root   = self.tree.root
        self.out    = Path(out) if out else REVIEW / 'graph'
        self.files  = []
        self.modules, self.classes, self.methods, self.tests, self.surfaces = [], [], [], [], []
        self.edges  = {'files': [], 'modules': [], 'classes': [], 'methods': [], 'tests': [], 'surfaces': []}
        self.names  = {}                                                           # method name -> [method id], for call resolution

    # ── helpers ───────────────────────────────────────────────────────────────

    def sha(self, text):
        return hashlib.sha256(text.encode('utf-8') if isinstance(text, str) else text).hexdigest()

    def source(self, path, line, end, text):
        return {'path': path, 'line': line, 'end': end, 'sha256': self.sha(text)}

    def language(self, path):
        return LANGUAGES.get(Path(path).suffix, 'other')

    def package(self, path):
        parent = str(Path(path).parent.as_posix())
        return parent if parent != '.' else '(root)'

    def method_id(self, path, cls, name):
        return f'method:{path}:{cls + "." if cls else ""}{name.replace("$", "dollar")}'   # a node id may not hold '$'; the name keeps it

    # ── python ────────────────────────────────────────────────────────────────

    def py_comment_after(self, lines, lineno):                                     # the trailing comment on a def or class line, which is where the house writes its notes
        line = lines[lineno - 1] if lineno - 1 < len(lines) else ''
        if '#' in line:
            return line.split('#', 1)[1].strip()
        return ''

    def py_calls(self, node):
        calls = []
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                func = child.func
                if isinstance(func, ast.Name):
                    calls.append({'name': func.id, 'via': '', 'line': child.lineno, 'kind': 'call'})
                elif isinstance(func, ast.Attribute):
                    via = func.value.id if isinstance(func.value, ast.Name) else ('self' if isinstance(func.value, ast.Name) and func.value.id == 'self' else ast.unparse(func.value)[:40])
                    calls.append({'name': func.attr, 'via': via, 'line': child.lineno, 'kind': 'call'})
        return calls

    def py_signature(self, node):
        return f'{node.name}({", ".join(a.arg for a in node.args.args)})'

    def python(self, path, text):
        try:
            tree = ast.parse(text)
        except SyntaxError as error:
            return {'error': str(error)}
        lines    = text.splitlines()
        banner   = RE_BANNER.match(text)
        doc      = '\n'.join(l.lstrip('#').strip() for l in banner.group(0).splitlines() if l.strip('# ═')) if banner else ''
        imports  = []
        for node in tree.body:
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append({'module': alias.name, 'name': alias.name, 'as': alias.asname or alias.name, 'line': node.lineno})
            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    imports.append({'module': node.module or '', 'name': alias.name, 'as': alias.asname or alias.name, 'line': node.lineno})
        classes, functions = [], []
        pending_calls = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                cls_id  = f'class:{path}:{node.name}'
                methods = []
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        mid = self.method_id(path, node.name, item.name)
                        methods.append(mid)
                        segment = '\n'.join(lines[item.lineno - 1:item.end_lineno])
                        self.methods.append({'id': mid, 'name': item.name, 'module': f'module:{path}', 'class': cls_id, 'kind': 'static' if any(isinstance(d, ast.Name) and d.id == 'staticmethod' for d in item.decorator_list) else 'method',
                                             'signature': self.py_signature(item), 'decorators': [ast.unparse(d) for d in item.decorator_list], 'doc': self.py_comment_after(lines, item.lineno),
                                             'loc': item.end_lineno - item.lineno + 1, 'fingerprint': self.sha(segment), 'calls': [], 'source': self.source(path, item.lineno, item.end_lineno, segment)})
                        pending_calls.append((mid, node.name, self.py_calls(item)))
                        self.names.setdefault(item.name, []).append(mid)
                self.classes.append({'id': cls_id, 'name': node.name, 'module': f'module:{path}', 'kind': 'class', 'bases': [ast.unparse(b) for b in node.bases], 'base_ids': [],
                                     'methods': methods, 'doc': self.py_comment_after(lines, node.lineno), 'loc': node.end_lineno - node.lineno + 1, 'fields': [],
                                     'source': self.source(path, node.lineno, node.end_lineno, '\n'.join(lines[node.lineno - 1:node.end_lineno]))})
                classes.append(cls_id)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                mid     = self.method_id(path, None, node.name)
                segment = '\n'.join(lines[node.lineno - 1:node.end_lineno])
                self.methods.append({'id': mid, 'name': node.name, 'module': f'module:{path}', 'class': None, 'kind': 'function', 'signature': self.py_signature(node),
                                     'decorators': [ast.unparse(d) for d in node.decorator_list], 'doc': self.py_comment_after(lines, node.lineno), 'loc': node.end_lineno - node.lineno + 1,
                                     'fingerprint': self.sha(segment), 'calls': [], 'source': self.source(path, node.lineno, node.end_lineno, segment)})
                pending_calls.append((mid, None, self.py_calls(node)))
                self.names.setdefault(node.name, []).append(mid)
                functions.append(mid)
        tests = [m.group(1) for m in RE_PY_TEST.finditer(text)] if path.startswith('tests/') else []
        return {'doc': doc, 'imports': imports, 'classes': classes, 'functions': functions, 'exports': [], 'pending': pending_calls, 'tests': tests, 'kind': 'unittest'}

    # ── javascript ────────────────────────────────────────────────────────────

    def javascript_all(self, paths):
        if not paths:
            return {}
        run = subprocess.run(['node', str(DERIVE_JS), str(self.root)], input='\n'.join(paths), capture_output=True, text=True, cwd=self.root)
        if run.returncode != 0:
            raise SystemExit(f'derive_js.mjs failed: {run.stderr.strip()[-400:]}')
        return json.loads(run.stdout)

    def javascript(self, path, parsed, text):
        lines = text.splitlines()
        if parsed.get('error'):
            return {'error': parsed['error']}
        classes, functions, pending = [], [], []
        for cls in parsed['classes']:
            cls_id  = f'class:{path}:{cls["name"]}'
            methods = []
            for m in cls['methods']:
                mid     = self.method_id(path, cls['name'], m['name'])
                segment = '\n'.join(lines[m['line'] - 1:m['end']])
                methods.append(mid)
                self.methods.append({'id': mid, 'name': m['name'], 'module': f'module:{path}', 'class': cls_id, 'kind': m['kind'], 'signature': f'{m["name"]}({", ".join(m.get("params", []))})',
                                     'decorators': [], 'doc': m.get('doc', ''), 'loc': m['end'] - m['line'] + 1, 'fingerprint': self.sha(segment), 'calls': [],
                                     'source': self.source(path, m['line'], m['end'], segment)})
                pending.append((mid, cls['name'], m.get('calls', [])))
                self.names.setdefault(m['name'], []).append(mid)
            self.classes.append({'id': cls_id, 'name': cls['name'], 'module': f'module:{path}', 'kind': 'class', 'bases': [cls['superClass']] if cls.get('superClass') else [], 'base_ids': [],
                                 'methods': methods, 'doc': cls.get('doc', ''), 'loc': cls['end'] - cls['line'] + 1, 'fields': [],
                                 'source': self.source(path, cls['line'], cls['end'], '\n'.join(lines[cls['line'] - 1:cls['end']]))})
            classes.append(cls_id)
        for fn in parsed['functions']:
            mid     = self.method_id(path, None, fn['name'])
            segment = '\n'.join(lines[fn['line'] - 1:fn['end']])
            self.methods.append({'id': mid, 'name': fn['name'], 'module': f'module:{path}', 'class': None, 'kind': 'function', 'signature': f'{fn["name"]}({", ".join(fn.get("params", []))})',
                                 'decorators': [], 'doc': fn.get('doc', ''), 'loc': fn['end'] - fn['line'] + 1, 'fingerprint': self.sha(segment), 'calls': [],
                                 'source': self.source(path, fn['line'], fn['end'], segment)})
            pending.append((mid, None, fn.get('calls', [])))
            self.names.setdefault(fn['name'], []).append(mid)
            functions.append(mid)
        for define in parsed.get('defines', []):
            self.surfaces.append({'id': f'surface:element:{define["element"]}', 'name': define['element'], 'kind': 'element', 'path': path, 'handler': f'class:{path}:{define["class"]}' if define.get('class') else '',
                                  'source': self.source(path, define['line'], define['line'], lines[define['line'] - 1] if define['line'] - 1 < len(lines) else '')})
        tests = RE_JS_TEST.findall(text) if path.startswith('tests/') else []
        return {'doc': parsed.get('header', ''), 'imports': parsed['imports'], 'classes': classes, 'functions': functions, 'exports': parsed.get('exports', []), 'pending': pending, 'tests': tests, 'kind': 'node-test'}

    # ── resolution: names to ids, within the set ──────────────────────────────

    def resolve_import(self, path, imp):                                          # -> module id of a file in the set, or None
        module = imp['module']
        if module.startswith('.'):
            try:
                target = (self.root / Path(path).parent / module).resolve().relative_to(self.root.resolve()).as_posix()
            except ValueError:
                return None
        elif module.startswith('/'):
            target = module.lstrip('/')
        else:
            candidates = [f for f in self.by_path if Path(f).stem == module.split('.')[-1] and f.endswith('.py')]
            return f'module:{candidates[0]}' if len(candidates) == 1 else None
        return f'module:{target}' if target in self.by_path else None

    def resolve_calls(self, pending):
        for mid, cls_name, calls in pending:
            method   = next(m for m in self.methods if m['id'] == mid)
            resolved = []
            seen     = set()
            for call in calls:
                name       = call['name']
                via        = call.get('via', '')
                module     = method['module']
                candidates = self.names.get(name, [])
                same_class = [c for c in candidates if cls_name and c.startswith(f'method:{module[7:]}:{cls_name}.')]
                same_file  = [c for c in candidates if c.startswith(f'method:{module[7:]}:')]
                target     = (same_class or same_file or (candidates if len(candidates) == 1 else []))
                if via in ('this', 'self') and same_class:
                    target = same_class
                if via in ('super()', 'super'):                                       # the base class's method, dynamic dispatch read statically
                    owner = next((c for c in self.classes if c['id'] == method.get('class')), None)
                    bases = [c for c in candidates for b in (owner['base_ids'] if owner else []) if c.startswith(f'method:{b[6:]}.')]
                    target = bases or []
                if target:
                    kind = 'internal'
                    to   = target[0]
                else:
                    kind = 'external'
                    to   = f'{via + "." if via else ""}{name}'
                key = (to, kind)
                if key in seen:
                    continue
                seen.add(key)
                entry = {'to': to, 'kind': kind, 'line': call.get('line', 0)}
                if via:
                    entry['via'] = via
                resolved.append(entry)
                if kind == 'internal' and to != mid:
                    self.edges['methods'].append({'from': mid, 'to': to, 'verb': 'calls', 'source': method['source']})
            method['calls'] = sorted(resolved, key=lambda c: (c['line'], c['to']))

    # ── the run ───────────────────────────────────────────────────────────────

    def run_derivation(self):
        paths        = self.tree.source_files()
        self.by_path = {p: (self.root / p).read_text(encoding='utf-8', errors='replace') for p in paths}
        js_paths     = [p for p in paths if self.language(p) == 'javascript' and 'vendor/' not in p]
        js_parsed    = self.javascript_all(js_paths)
        pending_all  = []
        for path in paths:
            text = self.by_path[path]
            lang = self.language(path)
            info = None
            if lang == 'python':
                info = self.python(path, text)
            elif lang == 'javascript' and path in js_parsed:
                info = self.javascript(path, js_parsed[path], text)
            lines = text.count('\n') + (0 if text.endswith('\n') else 1)
            record = {'id': f'file:{path}', 'path': path, 'language': lang, 'lines': lines, 'bytes': len(text.encode('utf-8')), 'sha256': self.sha(text), 'summary': {}}
            if info and not info.get('error'):
                record['module'] = f'module:{path}'
                record['summary'] = {'doc': info['doc'][:600], 'classes': len(info['classes']), 'functions': len(info['functions'])}
                self.modules.append({'id': f'module:{path}', 'name': Path(path).stem, 'path': path, 'package': self.package(path), 'language': lang, 'loc': lines,
                                     'imports': info['imports'], 'classes': info['classes'], 'functions': info['functions'], 'exports': info['exports'], 'doc': info['doc'][:600],
                                     'source': self.source(path, 1, lines, text)})
                pending_all += info['pending']
                for i, name in enumerate(info['tests']):
                    line = next((n + 1 for n, l in enumerate(text.splitlines()) if name in l and ('def ' in l or 'test(' in l)), 1)
                    self.tests.append({'id': f'test:{path}:{RE_SLUG.sub("-", name).strip("-")}', 'name': name, 'path': path, 'kind': info['kind'], 'imports': [imp['module'] for imp in info['imports']],
                                       'source': self.source(path, line, line, name)})
            elif lang == 'html':
                title = RE_TITLE.search(text)
                record['summary'] = {'title': title.group(1).strip() if title else '', 'elements': sorted(set(RE_ELEMENT.findall(text)))}
                url = '/' + path[:-len('index.html')] if path.endswith('index.html') else '/' + path
                self.surfaces.append({'id': f'surface:page:{url}', 'name': title.group(1).strip().split(' — ')[0] if title else url, 'kind': 'page', 'path': path, 'source': self.source(path, 1, lines, text),
                                      'properties': {'url': url, 'elements': sorted(set(RE_ELEMENT.findall(text)))}})
            elif info and info.get('error'):
                record['summary'] = {'error': info['error']}
            self.files.append(record)
        class_by_name = {}                                                        # bases first: super() calls resolve through them
        for cls in self.classes:
            class_by_name.setdefault(cls['name'], []).append(cls['id'])
        for cls in self.classes:
            for base in cls['bases']:
                ids = class_by_name.get(base, [])
                if len(ids) == 1:
                    cls['base_ids'].append(ids[0])
        self.resolve_calls(pending_all)
        for module in self.modules:                                                # import edges, where the import names a file in the set
            for imp in module['imports']:
                target = self.resolve_import(module['path'], imp)
                if target and target != module['id']:
                    self.edges['modules'].append({'from': module['id'], 'to': target, 'verb': 'imports', 'source': {'path': module['path'], 'line': imp.get('line', 1), 'end': imp.get('line', 1), 'sha256': module['source']['sha256']}})
        for cls in self.classes:
            for base_id in cls['base_ids']:
                self.edges['classes'].append({'from': cls['id'], 'to': base_id, 'verb': 'inherits', 'source': cls['source']})
            self.edges['classes'].append({'from': cls['module'], 'to': cls['id'], 'verb': 'contains', 'source': cls['source']})
            for mid in cls['methods']:
                self.edges['classes'].append({'from': cls['id'], 'to': mid, 'verb': 'contains', 'source': cls['source']})
        for test in self.tests:                                                    # a test tests the modules it imports from the set
            module_ids = {self.resolve_import(test['path'], {'module': m}) for m in test['imports']}
            for target in sorted(filter(None, module_ids)):
                self.edges['tests'].append({'from': test['id'], 'to': target, 'verb': 'tests', 'source': test['source']})
        for surface in self.surfaces:
            if surface['kind'] == 'page':
                for element in surface['properties']['elements']:
                    if any(s['id'] == f'surface:element:{element}' for s in self.surfaces):
                        self.edges['surfaces'].append({'from': surface['id'], 'to': f'surface:element:{element}', 'verb': 'exposes', 'source': surface['source']})
            if surface['kind'] == 'element' and surface.get('handler'):
                self.edges['surfaces'].append({'from': surface['id'], 'to': surface['handler'], 'verb': 'handled_by', 'source': surface['source']})
        return paths

    def layer(self, name, key, items, inputs):
        data = {'layer': name, key: sorted(items, key=lambda x: x['id']), 'edges': sorted(self.edges[name], key=lambda e: (e['from'], e['to'], e['verb'])),
                'provenance': self.tree.provenance(TOOL, inputs)}
        return data

    def same_but_commit(self, path, data):                                        # --check ignores the commit the file was derived at, which CI cannot reproduce
        if not path.exists():
            return False
        current = json.loads(path.read_text(encoding='utf-8'))
        current['provenance']['commit'] = data['provenance']['commit']
        return self.tree.dumps(current) == self.tree.dumps(data)

    def run(self):
        inputs = self.run_derivation()
        if self.tree.root != ROOT:
            inputs = inputs                                                         # a fixture root: provenance over its own files
        layers = [('files', 'files', self.files), ('modules', 'modules', self.modules), ('classes', 'classes', self.classes),
                  ('methods', 'methods', self.methods), ('tests', 'tests', self.tests), ('surfaces', 'surfaces', self.surfaces)]
        stale  = []
        for name, key, items in layers:
            data = self.layer(name, key, items, inputs)
            if name == 'modules':
                packages = {}
                for module in self.modules:
                    pkg = packages.setdefault(module['package'], {'id': f'package:{module["package"]}', 'modules': 0, 'classes': 0, 'methods': 0, 'loc': 0})
                    pkg['modules'] += 1
                    pkg['classes'] += len(module['classes'])
                    pkg['methods'] += sum(1 for m in self.methods if m['module'] == module['id'])
                    pkg['loc']     += module['loc']
                data['packages'] = sorted(packages.values(), key=lambda p: p['id'])
            target = self.out / f'{name}.json'
            if self.check:
                if not self.same_but_commit(target, data):
                    stale.append(name)
            else:
                if not self.same_but_commit(target, data):
                    self.tree.write_json(target, data)
                    stale.append(name)
        index  = {'layer': 'index', 'provenance': self.tree.provenance(TOOL, inputs),                      # small: what exists and how much, read by the UI before any layer
                  'counts': {'files': len(self.files), 'modules': len(self.modules), 'classes': len(self.classes), 'methods': len(self.methods), 'tests': len(self.tests), 'surfaces': len(self.surfaces)},
                  'paths' : sorted(f['path'] for f in self.files)}
        target = self.out / 'index.json'
        if not self.same_but_commit(target, index):
            if not self.check:
                self.tree.write_json(target, index)
            stale.append('index')
        counts = f'{len(self.files)} files, {len(self.modules)} modules, {len(self.classes)} classes, {len(self.methods)} methods, {len(self.tests)} tests, {len(self.surfaces)} surfaces'
        if self.check and stale:
            print(f'derive --check: {", ".join(stale)} out of date; run python3 review/tools/derive.py')
            return 1
        print(f'derive: {counts}{" (updated " + ", ".join(stale) + ")" if stale else " (current)"}')
        return 0


if __name__ == '__main__':
    args = sys.argv[1:]
    root = args[args.index('--root') + 1] if '--root' in args else None
    out  = args[args.index('--out') + 1] if '--out' in args else None
    sys.exit(Derive(check='--check' in args, root=root, out=out).run())
