# The comms channel: from the reader's column to the build agent

*secrets.sgit.ai · operations · written at v0.1.7 (2026-10-06) · CC BY 4.0*

The site is read by a person and built by an agent that only exists during a session. This page is how the one talks to the other without memos: a column on every page that keeps a log of what the reader marks, and a one-way encrypted lane into a vault only the agent can open.

## The reader's column

Every page has a tab on its right edge, **Reader**. It opens a drawer with three views:

- **Log.** Mark the page read, star it, vote it up or down, leave a note (typed, or dictated with the browser's own speech recognition). Every action is one event in an append-only log in this browser's `localStorage` (`sgit.secrets.reader.log.v1`), keyed by the page's path and a hash of its text, so a note written against an older version of a page says *page changed since*. Undo is another event; nothing is deleted. **Send to the agent** seals the unsent events to the agent's public key and writes them to the lane below. **Copy for Claude** puts the same on the clipboard as markdown with the JSON inside it; **Paste to merge** takes it back on another device. Nothing leaves the page without a click.
- **Chat.** A chat over the site. Without a key it is an offline search over `data/search-index.json`, generated from every page's markdown twin at each release. With the reader's own OpenRouter key it is Claude Sonnet (`anthropic/claude-sonnet-5.5`) through `openrouter.ai`, with tools that search the site, open a page, list the pages, say what to read next, read the reader's log and file a note into it, so a conversation turns into feedback the agent receives. The key is held in memory, or in this tab's `sessionStorage` when the reader ticks *keep for this tab*; it is never written to `localStorage` and is sent to `openrouter.ai` and nowhere else. Replies can be spoken with the browser's speech synthesis; questions can be dictated.
- **Graph.** The intent nodes the page names (every content page and mockup links the nodes it realises) and their neighbours, drawn by the navigator's `review-graph`; a click moves the focus, and a link opens the same place in `/review/ui/`.

The column is three web components under `components/` (`reader-panel`, `reader-log`, `reader-chat`) on the site's base `sg-base`, three files each, no framework, no colour of their own: they follow the theme. Where the page's Content-Security-Policy does not allow a connection to `openrouter.ai` or to the vault endpoint, the Chat and Send parts say so and point at the page that does (`docs/design/brief-corrections.md`, C19).

## The lane into the agent's vault

The agent has a comms vault on SG/Send (`https://dev.send.sgraph.ai`) and a key pair (RSA-OAEP 4096 for encryption, ECDSA P-256 for signing). The public bundle, the vault id and the lanes are published in [`/.well-known/sgit-agents.json`](/.well-known/sgit-agents.json), the [Agent Contact v0.1](https://sgit.ai/docs/agent-contact.html) shape every sgit.ai site uses. A lane is a write-only address on the vault, gated by a public append token: a sender can write, and cannot list, fetch or read. The site's column writes `reader-message/v1`, the sgit PKI envelope made with WebCrypto (the same bytes `sgit pki encrypt` would make), to the `readers` lane. Other agents write signed `agent-message/v1` mail to the `agents` lane.

The agent reads the lanes at the start of a session with `tools/comms/drain.py`: list, fetch, decrypt with its private key, keep ciphertext and plaintext under the vault's `inbox/`, print a digest it acts on, then mark-processed. What cannot be opened goes to `inbox/quarantine/` with the reason.

## What only the project lead can do, once

The session that built this could create the vault and the key pair, but its permission policy stopped it short of two things: registering the lanes on the vault (an account-level change on SG/Send) and pushing the private keys into the vault. So the vault key, the read key and the key pair are where that session left them, and the lead finishes the channel:

1. Take the vault key from the build session's scratchpad (`vaults/create.log`, the line *Vault key*) and the key pair from `~/.sg-send/keys/` of that session, with the passphrase in `vaults/pki-passphrase.txt`. Store the vault key as `SGIT_COMMS_VAULT_KEY` and the passphrase as `SGIT_COMMS_PKI_PASSPHRASE` in the Claude Code environment this repository runs in, so every later session can open the vault. Put the key folder in the vault (`agent/keys/`) and push it.
2. Publish the public half: `python3 tools/comms/publish_contact.py --fingerprint sha256:6d9fe81fd718ab0b` fills the contact file with the bundle, the vault id and one fresh token per lane; commit it.
3. Register the lanes: `python3 tools/comms/configure_lane.py` (needs `SGIT_COMMS_VAULT_KEY` and `SG_SEND_ACCESS_TOKEN`). On success it sets the contact file's status to `open`; commit it. The column's Send button enables itself on the next page load.
4. Prove the round trip: `python3 tools/comms/send_test.py`, then `python3 tools/comms/drain.py --vault-dir <the vault clone>`.

Until step 3 the column says the lane is pending and offers **Copy for Claude**, which works today.

## The tools

| File | Does |
|---|---|
| `tools/comms/comms_contact.py` | reads and writes the contact file |
| `tools/comms/comms_lane.py` | the append-lane calls: write (no key), list, fetch, mark-processed (enum key), configure (write key and the SG/Send token) |
| `tools/comms/comms_envelope.py` | the sgit PKI envelope: seal to a public key, open with the agent's private key |
| `tools/comms/publish_contact.py` | fills the contact file from `sgit pki export` and the vault key |
| `tools/comms/configure_lane.py` | registers the lanes on the vault |
| `tools/comms/send_test.py` | writes one test message to the readers lane |
| `tools/comms/drain.py` | reads the lanes into the vault's `inbox/` and prints the digest |

They run on a person's or an agent's machine, never in CI, and use the `sgit_ai` package for the key derivation and the envelope; nothing in them is a secret.
