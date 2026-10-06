# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Send__Test
# Proves the readers lane end to end from the command line: seals a
# reader-message/v1 with one test event to the agent's public key, exactly as
# the reader's column does, and writes it to the lane. Then drain.py should
# show it. Needs nothing secret: the contact file has everything a sender needs.
# Usage: python3 tools/comms/send_test.py [--lane readers] [--text "…"]
# ═══════════════════════════════════════════════════════════════════════════════

import json
import sys

from datetime import datetime, timezone

from comms_contact  import Comms__Contact
from comms_envelope import Comms__Envelope
from comms_lane     import Comms__Lane


class Send__Test:

    def __init__(self, lane='readers', text='a test note from send_test.py'):
        self.lane = lane
        self.text = text

    def run(self):
        contact = Comms__Contact()
        tokens  = contact.lanes()
        if self.lane not in tokens or not contact.bundle():
            raise SystemExit('the contact file has no bundle or no such lane; run publish_contact.py first')
        now     = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        message = {'schema' : 'reader-message/v1', 'site' : contact.data['site'], 'sent' : now, 'via' : 'tools/comms/send_test.py',
                   'events' : [{'id': 'test-' + now, 't': now, 'page': '/', 'hash': '', 'kind': 'note', 'text': self.text}]}
        payload = Comms__Envelope().seal(contact.bundle()['encrypt'], json.dumps(message))
        status, body = Comms__Lane(contact).write(tokens[self.lane], payload)
        print(f'write to lane {self.lane}: HTTP {status} {body}')
        return 0 if status == 200 else 1


if __name__ == '__main__':
    args = sys.argv[1:]
    lane = args[args.index('--lane') + 1] if '--lane' in args else 'readers'
    text = args[args.index('--text') + 1] if '--text' in args else 'a test note from send_test.py'
    sys.exit(Send__Test(lane, text).run())
