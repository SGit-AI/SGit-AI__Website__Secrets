# secrets.sgit.ai

The repository for [secrets.sgit.ai](https://secrets.sgit.ai): a static site on GitHub Pages that is also a zero-knowledge, browser-only secrets manager, backed by one GCP project per environment (Identity Platform for login, Cloud Storage for Firebase for ciphertext). The browser does every cryptographic operation; a full compromise of the cloud side yields ciphertext and login metadata, never a secret.

Everything in this repository is public. Nothing in it is secret, and a leak tripwire in the release gate checks that on every push.

- **What is real:** [docs/reality.md](docs/reality.md), generated from [data/features.json](data/features.json). If it is not listed there, it does not exist.
- **The instruction set:** [docs/design/secrets-sgit-ai__mvp-build-brief.md](docs/design/secrets-sgit-ai__mvp-build-brief.md), with [what it got wrong](docs/design/brief-corrections.md) beside it, and the four design documents that carry the reasoning beside it, starting with [the primary design](docs/design/riskmandate-gcp-key-vault-password-manager-mvp.md).
- **How a release works:** [docs/ops/release.md](docs/ops/release.md). Every push to `dev` is a release; `admin/build/version.txt` is the version; the commit subject is `site vX.Y.Z : what`; CI tags, deploys and then checks the live site.
- **What only a human can do next:** [docs/ops/needs.md](docs/ops/needs.md).
- **For agents:** [llms.txt](llms.txt) and [llms-full.txt](llms-full.txt); every HTML page has a markdown twin at the same path.

## Working on it

```
pip install pytest                        # the gate's only Python dependency; Node 22 and Python 3.11+ otherwise
python3 admin/build/gate.py --build       # regenerate, then run the whole gate
python3 admin/build/gate.py               # what CI runs
python3 -m http.server 8000               # serve the tree locally; there is no build step
```

Rules that never bend: no server-side code; plaintext only in the browser after a passkey gesture; nothing secret in the tree; no build step and no runtime script from another origin; the passkey RP ID is exactly `secrets.sgit.ai`; every claim on the site carries a status from `data/features.json`.

Content is CC BY 4.0; code is Apache-2.0 (see [LICENSE](LICENSE)).
