# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Publish__Contact
# Fills .well-known/sgit-agents.json from the agent's key pair and the comms
# vault: the public bundle (from `sgit pki export <fingerprint>`), the vault id
# (from SGIT_COMMS_VAULT_KEY), and one fresh append token per lane named on the
# command line. Public values only; the private keys and the vault key never
# enter the repository. Run by the project lead, then commit the result.
# Usage: SGIT_COMMS_VAULT_KEY=… python3 tools/comms/publish_contact.py --fingerprint sha256:… [--lanes readers,agents]
# ═══════════════════════════════════════════════════════════════════════════════

import json
import os
import secrets
import subprocess
import sys

from datetime import datetime, timezone

from comms_contact import Comms__Contact


LANE_USES = {'readers' : "reader-message/v1 from the reader's column on this site: the reader's log events, encrypted to encrypt_to, unsigned",
             'agents'  : 'signed, encrypted agent-message/v1 from accepts_from domains'}


class Publish__Contact:

    def __init__(self, fingerprint, lanes):
        self.fingerprint = fingerprint
        self.lanes       = lanes
        self.contact     = Comms__Contact()

    def bundle(self):
        result = subprocess.run(['sgit', 'pki', 'export', self.fingerprint], capture_output=True, text=True, check=True)
        return json.loads(result.stdout)

    def vault_id(self):
        vault_key = os.environ.get('SGIT_COMMS_VAULT_KEY')
        if not vault_key:
            raise SystemExit('SGIT_COMMS_VAULT_KEY is not set')
        return vault_key.rsplit(':', 1)[1]

    def run(self):
        bundle   = self.bundle()
        identity = self.contact.identity()
        inbox    = identity['inbox']
        existing = {lane['name']: lane for lane in inbox['lanes']}
        today    = datetime.now(timezone.utc).date().isoformat()
        identity.update({'serial'              : max(identity.get('serial', 0), 1),
                         'fingerprint'         : bundle['fingerprint'],
                         'signing_fingerprint' : bundle['signing_fingerprint'],
                         'bundle'              : bundle})
        inbox.update({'vault'       : self.vault_id(),
                      'encrypt_to'  : bundle['fingerprint'],
                      'status'      : 'configuring',
                      'status_note' : 'Bundle, vault and lane tokens published; the lanes are open once tools/comms/configure_lane.py has run and a round trip (send_test.py, drain.py) has been seen.',
                      'lanes'       : [existing.get(name) or {'name': name, 'append_token': secrets.token_hex(32), 'use': LANE_USES.get(name, name), 'since': today}
                                       for name in self.lanes]})
        self.contact.data['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        self.contact.write()
        print(f'contact file written: vault {inbox["vault"]}, lanes {", ".join(self.lanes)}, encrypt to {bundle["fingerprint"]}')


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--fingerprint' not in args:
        print('usage: publish_contact.py --fingerprint sha256:… [--lanes readers,agents]')
        sys.exit(2)
    lanes = args[args.index('--lanes') + 1].split(',') if '--lanes' in args else ['readers', 'agents']
    Publish__Contact(args[args.index('--fingerprint') + 1], lanes).run()
