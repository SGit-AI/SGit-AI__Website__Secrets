# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Review__Tree
# What every review tool shares: which files count as source, the hash of that
# tree, stable (byte-identical) JSON writing, and the provenance block every
# derived file carries. Determinism rule: sorted keys, sorted lists where order
# carries no meaning, no timestamps outside provenance, two-space indent, LF.
# ═══════════════════════════════════════════════════════════════════════════════

import hashlib
import json
import subprocess

from pathlib import Path


ROOT        = Path(__file__).resolve().parents[2]
REVIEW      = ROOT / 'review'
CONFIG_FILE = REVIEW / 'tools' / 'config.json'
TOOL_VERSION = '0.1'                                                             # bumped when a derived file's shape changes


class Review__Tree:

    def __init__(self, root=ROOT, config_file=CONFIG_FILE):
        self.root   = Path(root)
        self.config = json.loads(Path(config_file).read_text(encoding='utf-8'))

    # ── source discovery ──────────────────────────────────────────────────────

    def is_excluded(self, relative):
        parts = relative.split('/')
        if any(part in self.config['exclude_dirs'] for part in parts):
            return True
        return any(relative == item or relative.startswith(item.rstrip('/') + '/') for item in self.config['exclude_paths'])

    def source_files(self):                                                       # every file the derivation reads, sorted, repo-relative
        found = []
        for pattern in self.config['source_globs']:
            for path in self.root.glob(pattern):
                if not path.is_file():
                    continue
                relative = path.relative_to(self.root).as_posix()
                if not self.is_excluded(relative):
                    found.append(relative)
        return sorted(set(found))

    def file_sha256(self, relative):
        return hashlib.sha256((self.root / relative).read_bytes()).hexdigest()

    def tree_hash(self, files=None):                                              # one hash over (path, content hash) of every source file
        digest = hashlib.sha256()
        for relative in files if files is not None else self.source_files():
            digest.update(relative.encode('utf-8'))
            digest.update(b'\0')
            digest.update(self.file_sha256(relative).encode('utf-8'))
            digest.update(b'\n')
        return digest.hexdigest()

    def head_commit(self):
        try:
            return subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=self.root, capture_output=True, text=True, check=True).stdout.strip()
        except Exception:                                                         # not a git checkout: provenance says so rather than failing
            return 'unknown'

    # ── provenance and stable output ──────────────────────────────────────────

    def provenance(self, tool, inputs):                                           # inputs: list of repo-relative paths the file was derived from
        return {'tool'         : tool                                                   ,
                'tool_version' : TOOL_VERSION                                           ,
                'commit'       : self.head_commit()                                     ,
                'tree_sha256'  : self.tree_hash()                                       ,
                'inputs'       : {path: self.file_sha256(path) for path in sorted(inputs)}}

    @staticmethod
    def dumps(data):
        return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + '\n'

    def write_json(self, path, data, check=False):                                # returns True when the file is (or would be) changed
        path    = Path(path)
        text    = self.dumps(data)
        current = path.read_text(encoding='utf-8') if path.exists() else None
        if current == text:
            return False
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding='utf-8')
        return True

    @staticmethod
    def read_json(path):
        return json.loads(Path(path).read_text(encoding='utf-8'))
