# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Comms__Contact
# Reads and writes .well-known/sgit-agents.json, the one source for the comms
# channel: the vault id, the endpoint, the lanes (name and public append token),
# the agent's public bundle and the key the readers encrypt to. Every other
# tool here reads it through this class; the site reads it at runtime.
# ═══════════════════════════════════════════════════════════════════════════════

import json

from pathlib import Path


ROOT         = Path(__file__).resolve().parents[2]
CONTACT_FILE = ROOT / '.well-known' / 'sgit-agents.json'
IDENTITY     = 'build-agent'


class Comms__Contact:

    def __init__(self, path=CONTACT_FILE):
        self.path = path
        self.data = json.loads(path.read_text(encoding='utf-8'))

    def identity(self):
        return self.data['identities'][IDENTITY]

    def inbox(self):
        return self.identity()['inbox']

    def endpoint(self):
        return self.inbox()['endpoint'].rstrip('/')

    def vault_id(self):
        return self.inbox()['vault']

    def status(self):
        return self.inbox()['status']

    def lanes(self):
        return {lane['name']: lane['append_token'] for lane in self.inbox()['lanes']}

    def bundle(self):
        return self.identity()['bundle']

    def write(self):
        self.path.write_text(json.dumps(self.data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
