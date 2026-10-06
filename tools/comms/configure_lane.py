# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Configure__Lane
# Registers every lane in the contact file on the comms vault: the server keeps
# sha256 of each append token as the lane's anchor and sha256 of the enum key
# for the drainer. Needs SGIT_COMMS_VAULT_KEY and SG_SEND_ACCESS_TOKEN in the
# environment. Replaces the anchor list, so it always sends all lanes. Run by
# the project lead; on success it sets the contact file's status to open.
# Usage: python3 tools/comms/configure_lane.py
# ═══════════════════════════════════════════════════════════════════════════════

import sys

from comms_contact import Comms__Contact
from comms_lane    import Comms__Lane


class Configure__Lane:

    def run(self):
        contact = Comms__Contact()
        if not contact.lanes():
            raise SystemExit('the contact file names no lane; run publish_contact.py first')
        status, body = Comms__Lane(contact).configure()
        print(f'configure {contact.vault_id()}: HTTP {status} {body}')
        if status == 200:
            contact.inbox()['status']      = 'open'
            contact.inbox()['status_note'] = "Lanes registered on the vault; the reader's column sends, tools/comms/drain.py reads."
            contact.write()
            print('contact file status set to open; commit it')
            return 0
        print('not registered; if the server names other field names, change Comms__Lane.configure and run again')
        return 1


if __name__ == '__main__':
    sys.exit(Configure__Lane().run())
