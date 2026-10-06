# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Drain
# Reads the comms vault's lanes: list, fetch, decrypt with the agent's private
# key, keep the ciphertext and the plaintext under <vault dir>/inbox/, print a
# digest the build agent can act on, then mark-processed (final: a processed
# file cannot be fetched again, which is why the ciphertext is written first).
# What cannot be opened goes to inbox/quarantine/ with the reason. Needs
# SGIT_COMMS_VAULT_KEY, SGIT_COMMS_PKI_PASSPHRASE and the keys folder
# (SGIT_COMMS_KEYS_DIR, default ~/.sg-send/keys). Commit the vault afterwards.
# Usage: python3 tools/comms/drain.py [--vault-dir PATH] [--dry-run]
# ═══════════════════════════════════════════════════════════════════════════════

import json
import sys

from pathlib import Path

from comms_contact  import Comms__Contact
from comms_envelope import Comms__Envelope
from comms_lane     import Comms__Lane


class Drain:

    def __init__(self, vault_dir, dry_run=False):
        self.vault_dir = Path(vault_dir)
        self.dry_run   = dry_run
        self.contact   = Comms__Contact()
        self.lane      = Comms__Lane(self.contact)
        self.envelope  = Comms__Envelope()
        self.names     = {token: name for name, token in self.contact.lanes().items()}

    def folder(self, kind):
        path = self.vault_dir / 'inbox' / kind
        path.mkdir(parents=True, exist_ok=True)
        return path

    def pending(self):
        entries, after = [], None
        while True:
            status, body = self.lane.list(after)
            if status != 200:
                raise SystemExit(f'list: HTTP {status} {body}')
            entries += body.get('entries', [])
            after    = body.get('cursor')
            if not after or not body.get('entries'):
                return entries

    def open_one(self, payload):
        try:
            plaintext = self.envelope.open(self.contact.inbox()['encrypt_to'], payload)
            return json.loads(plaintext), None
        except Exception as error:                                                 # anything that fails to open is quarantined with the reason
            return None, f'{type(error).__name__}: {error}'

    def digest(self, name, file_id, message):
        lines = [f'## {name} · {file_id} · {message.get("sent", "")} · {message.get("via", "")}']
        for event in message.get('events', []):
            lines.append(f'- {event.get("t", "")} {event.get("page", "")} **{event.get("kind", "")}** {event.get("text", "")}'.rstrip())
        return '\n'.join(lines)

    def run(self):
        entries = self.pending()
        print(f'{len(entries)} pending file(s) on vault {self.contact.vault_id()}')
        digests = []
        by_lane = {}
        for entry in entries:
            by_lane.setdefault(entry['inbox'], []).append(entry['file_id'])
        for token, file_ids in by_lane.items():
            name = self.names.get(token, 'unknown-lane')
            for start in range(0, len(file_ids), 100):
                batch        = file_ids[start:start + 100]
                status, body = self.lane.fetch(token, batch)
                if status != 200:
                    print(f'fetch {name}: HTTP {status} {body}')
                    continue
                done = []
                for item in body.get('entries', body.get('files', [])):
                    file_id = item['file_id']
                    payload = item.get('payload') or item.get('content')
                    (self.folder('pending') / f'{name}__{file_id}').write_text(payload, encoding='utf-8')
                    message, reason = self.open_one(payload)
                    if message is None:
                        (self.folder('quarantine') / f'{name}__{file_id}.txt').write_text(reason, encoding='utf-8')
                        print(f'  quarantined {file_id}: {reason}')
                    else:
                        (self.folder('processed') / f'{name}__{file_id}.json').write_text(json.dumps(message, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
                        digests.append(self.digest(name, file_id, message))
                    done.append(file_id)
                if done and not self.dry_run:
                    status, body = self.lane.mark_processed(token, done)
                    if status != 200:
                        print(f'mark-processed {name}: HTTP {status} {body}')
        if digests:
            text = '# Drained\n\n' + '\n\n'.join(digests) + '\n'
            (self.vault_dir / 'inbox' / 'DIGEST.md').write_text(text, encoding='utf-8')
            print(text)
        return 0


if __name__ == '__main__':
    args      = sys.argv[1:]
    vault_dir = args[args.index('--vault-dir') + 1] if '--vault-dir' in args else '../secrets-sgit-ai-comms'
    sys.exit(Drain(vault_dir, '--dry-run' in args).run())
