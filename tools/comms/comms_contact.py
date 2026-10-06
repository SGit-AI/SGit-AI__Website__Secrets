# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Comms__Contact
# Reads and writes .well-known/sgit-agents.json, the one source for the comms
# channel: the vault id, the endpoint, the lanes (name and use; the append tokens
# are not published: they come from SGIT_COMMS_LANE_TOKENS, 'readers=hex,agents=hex'),
# the agent's public bundle and the key the readers encrypt to. Every other
# tool here reads it through this class; the site reads it at runtime.
# ═══════════════════════════════════════════════════════════════════════════════

import json
import os

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

    def lane_names(self):
        return [lane['name'] for lane in self.inbox()['lanes']]

    def lanes(self):                                                              # name -> append token, from the environment; the contact file names the lanes and holds no token
        raw    = os.environ.get('SGIT_COMMS_LANE_TOKENS', '')
        tokens = dict(part.split('=', 1) for part in raw.split(',') if '=' in part)
        found  = {name: tokens[name] for name in self.lane_names() if name in tokens}
        missing = [name for name in self.lane_names() if name not in found]
        if missing:
            raise SystemExit(f'SGIT_COMMS_LANE_TOKENS has no token for lane(s) {", ".join(missing)}; the format is readers=<hex>,agents=<hex>')
        return found

    def bundle(self):
        return self.identity()['bundle']

    def write(self):
        self.path.write_text(json.dumps(self.data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
