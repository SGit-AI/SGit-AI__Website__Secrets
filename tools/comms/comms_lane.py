# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Comms__Lane
# The append-lane calls on SG/Send for the comms vault (sgit.ai/api/append-lanes):
# write (anyone with a lane token), list, fetch and mark-processed (the owner,
# with the enum key), configure (the owner, with the write key and the SG/Send
# token). Keys come from the vault key in SGIT_COMMS_VAULT_KEY and are never
# printed. Standard library, plus sgit_ai for the key derivation on the owner's side.
# ═══════════════════════════════════════════════════════════════════════════════

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request

from comms_contact import Comms__Contact


ENUM_LABEL = b'agent-contact/enum-key/v1'                                         # sgit.ai/docs/agent-contact: the enum key is HMAC-SHA256(write key, this label)


class Comms__Lane:

    def __init__(self, contact=None):
        self.contact = contact or Comms__Contact()
        self.base    = f'{self.contact.endpoint()}/api/vault/append'
        self.vault   = self.contact.vault_id()
        self._keys   = None

    def keys(self):                                                                # derived once from the vault key in the environment, never printed
        if self._keys is None:
            vault_key = os.environ.get('SGIT_COMMS_VAULT_KEY')
            if not vault_key:
                raise SystemExit('SGIT_COMMS_VAULT_KEY is not set; the vault key lives in the environment, never in the repository')
            from sgit_ai.crypto.Vault__Crypto import Vault__Crypto                  # imported here so a sender needs no sgit_ai
            derived    = Vault__Crypto().derive_keys_from_vault_key(vault_key)
            write_key  = derived['write_key']
            enum_key   = hmac.new(bytes.fromhex(write_key), ENUM_LABEL, hashlib.sha256).hexdigest()
            self._keys = {'write_key': write_key, 'enum_key': enum_key, 'vault_id': derived['vault_id']}
            if self.vault and self._keys['vault_id'] != self.vault:
                raise SystemExit(f'the vault key is for vault {self._keys["vault_id"]}, the contact file names {self.vault}')
        return self._keys

    def post(self, path, body, headers=None):
        request = urllib.request.Request(f'{self.base}/{path}/{self.vault}', data=json.dumps(body).encode('utf-8'), method='POST',
                                         headers={'Content-Type': 'application/json', **(headers or {})})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.status, json.loads(response.read().decode('utf-8') or '{}')
        except urllib.error.HTTPError as error:
            text = error.read().decode('utf-8', 'replace')
            try:
                return error.code, json.loads(text)
            except ValueError:
                return error.code, {'error': text[:300]}

    def owner_headers(self):
        token = os.environ.get('SG_SEND_ACCESS_TOKEN')
        if not token:
            raise SystemExit('SG_SEND_ACCESS_TOKEN is not set')
        return {'x-sgraph-vault-write-key': self.keys()['write_key'], 'x-sgraph-access-token': token}

    def enum_headers(self):
        return {'x-sgraph-vault-enum-key': self.keys()['enum_key']}

    @staticmethod
    def anchor(token):                                                             # what the server stores for a lane: sha256 of its token
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    def configure(self):                                                           # registers every lane in the contact file; replaces the anchor list, so always all of them
        tokens = list(self.contact.lanes().values())
        body   = {'anchors'       : [self.anchor(t) for t in tokens],
                  'enum_key_hash' : hashlib.sha256(self.keys()['enum_key'].encode('utf-8')).hexdigest()}
        return self.post('configure', body, self.owner_headers())

    def write(self, token, payload_b64):                                           # the sender's call: no account, no key, the token in the body
        return self.post('write', {'append_token': token, 'payload': payload_b64})

    def list(self, after=None):
        body = {'include_content': False}
        if after:
            body['after_file_id'] = after
        return self.post('list', body, self.enum_headers())

    def fetch(self, token, file_ids):
        return self.post('fetch', {'inbox': token, 'file_ids': file_ids}, self.enum_headers())

    def mark_processed(self, token, file_ids):
        return self.post('mark-processed', {'inbox': token, 'file_ids': file_ids}, self.enum_headers())
