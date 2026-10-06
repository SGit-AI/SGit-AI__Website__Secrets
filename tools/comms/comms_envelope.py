# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Comms__Envelope
# The sgit PKI envelope (v2: RSA-OAEP SHA-256 wraps an AES-256-GCM key, 12-byte
# IV, no additional data), as the sgit CLI writes it and as the reader's column
# writes it with WebCrypto: base64 of the JSON {v, w, i, c[, f, s]}. The lane
# payload is base64 of that again. Decryption needs the agent's private key:
# agent/keys/<fingerprint>/ in the comms vault (or ~/.sg-send/keys), passphrase
# in SGIT_COMMS_PKI_PASSPHRASE.
# ═══════════════════════════════════════════════════════════════════════════════

import base64
import json
import os

from pathlib import Path


class Comms__Envelope:

    def __init__(self, keys_dir=None):
        self.keys_dir = Path(keys_dir or os.environ.get('SGIT_COMMS_KEYS_DIR') or Path.home() / '.sg-send' / 'keys')

    def crypto(self):
        from sgit_ai.crypto.PKI__Crypto import PKI__Crypto
        return PKI__Crypto()

    def public_key(self, pem):
        return self.crypto().import_public_key_pem(pem)

    def private_key(self, fingerprint):
        folder     = self.keys_dir / fingerprint.replace(':', '_')
        passphrase = os.environ.get('SGIT_COMMS_PKI_PASSPHRASE')
        pem        = (folder / 'private_key.pem').read_text(encoding='utf-8')
        return self.crypto().import_private_key_pem(pem, passphrase)

    def seal(self, recipient_pem, plaintext):                                      # -> the lane payload: base64(base64(json))
        encoded = self.crypto().hybrid_encrypt(self.public_key(recipient_pem), plaintext)
        return base64.b64encode(encoded.encode('utf-8')).decode('ascii')

    def open(self, fingerprint, payload_b64):                                      # the lane payload -> the plaintext string (a reader-message is JSON)
        encoded = base64.b64decode(payload_b64).decode('ascii')
        return self.crypto().hybrid_decrypt(self.private_key(fingerprint), encoded)['plaintext']

    @staticmethod
    def peek(payload_b64):                                                         # the envelope's public fields, without a key
        return {k: v for k, v in json.loads(base64.b64decode(base64.b64decode(payload_b64))).items() if k in ('v', 'f')}
