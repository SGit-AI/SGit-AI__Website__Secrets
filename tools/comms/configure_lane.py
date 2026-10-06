# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Configure__Lane
# Registers every lane in the contact file on the comms vault: the server keeps
# sha256 of each append token as the lane's anchor and sha256 of the enum key
# for the drainer. The tokens come from SGIT_COMMS_LANE_TOKENS
# ('readers=<hex>,agents=<hex>'); with --new it makes fresh ones and prints them
# once, to be stored in that variable and never in the repository: the readers
# token is what the lead pastes into the column's "Append token" on the devices
# that should write (nobody else can), the agents token goes to agents by hand.
# Needs SGIT_COMMS_VAULT_KEY and SG_SEND_ACCESS_TOKEN too. Replaces the anchor
# list, so it always sends all lanes. On success it sets the contact file's
# status to open.
# Usage: python3 tools/comms/configure_lane.py [--new]
# ═══════════════════════════════════════════════════════════════════════════════

import os
import secrets
import sys

from comms_contact import Comms__Contact
from comms_lane    import Comms__Lane


class Configure__Lane:

    def run(self, new=False):
        contact = Comms__Contact()
        if not contact.lane_names():
            raise SystemExit('the contact file names no lane; run publish_contact.py first')
        if new:
            tokens = {name: secrets.token_hex(32) for name in contact.lane_names()}
            os.environ['SGIT_COMMS_LANE_TOKENS'] = ','.join(f'{name}={token}' for name, token in tokens.items())
            print('new tokens, shown once; store them as SGIT_COMMS_LANE_TOKENS and hand the readers one to the devices that should write:')
            print(f'  SGIT_COMMS_LANE_TOKENS={os.environ["SGIT_COMMS_LANE_TOKENS"]}')
        status, body = Comms__Lane(contact).configure()
        print(f'configure {contact.vault_id()}: HTTP {status} {body}')
        if status == 200:
            contact.inbox()['status']      = 'open'
            contact.inbox()['status_note'] = "Lanes registered on the vault; the reader's column sends with the append token the lead hands out, tools/comms/drain.py reads."
            contact.write()
            print('contact file status set to open; commit it')
            return 0
        print('not registered; if the server names other field names, change Comms__Lane.configure and run again')
        return 1


if __name__ == '__main__':
    sys.exit(Configure__Lane().run(new='--new' in sys.argv))
