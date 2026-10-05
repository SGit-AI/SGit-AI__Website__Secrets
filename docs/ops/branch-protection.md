# Repository protections

*secrets.sgit.ai · operations · written at v0.1.0 (2026-10-05) · section 9.5 of the brief · CC BY 4.0*

Whoever controls this repository controls the code every user's browser runs, and the code is the boundary of the whole design (section 3.4 of the brief). These settings are the guard on that boundary. They are set by an organisation owner, listed here so they can be checked, and repeated on `/security/` once that page exists. None of them is in place yet unless `docs/ops/needs.md` says so.

## Branches `dev` and `main`

Settings, Branches (or Rules, Rulesets), one rule for each of `dev` and `main`:

| Setting | Value | Why |
|---|---|---|
| Require a pull request before merging | on, 1 approving review | no direct pushes; work lands from `claude/*` or feature branches |
| Dismiss stale approvals on new commits | on | an approval covers the diff it saw |
| Require status checks to pass | on, required check: `validate` | the gate decides, not a person |
| Require branches to be up to date before merging | on | the gate ran against what will be merged |
| Require linear history | on | one release, one commit shape; no merge-of-merge |
| Block force pushes | on | tags and history are the release record |
| Restrict deletions | on | |
| Do not allow bypassing the above settings | on, including administrators | the protection is for the admins too |

The first release, `v0.1.0`, was pushed directly to `dev` before any rule existed, because the gate that the rules require did not exist until that commit. From the next release on, every change to `dev` arrives by pull request.

## Organisation

- Two-factor authentication required for every member, with hardware security keys (Settings, Authentication security). Passkeys and security keys only; no SMS.
- `sgit.ai` verified as an organisation domain (Settings, Verified and approved domains).
- Actions: allow only actions from GitHub and from this organisation, pinned by commit SHA; `GITHUB_TOKEN` default permission read-only; "Allow GitHub Actions to create and approve pull requests" off.

## Actions and environments

- Every third-party action in `.github/workflows/` is pinned to a commit SHA with its tag in a comment. `deploy-pages.yml` already does this.
- `permissions:` is minimal per job: `contents: read` by default; `contents: write` only in `tag-release`; `pages: write` and `id-token: write` only in `deploy`.
- Environments (Settings, Environments): `github-pages` (created by the first deploy); `dev`, `main` and `prod` for Terraform from step 3, each holding `WORKLOAD_IDENTITY_PROVIDER` and `SERVICE_ACCOUNT` as variables and `GOOGLE_OAUTH_CLIENT_SECRET` as a secret. `prod` requires a reviewer.
- No JSON service-account key, anywhere, ever. Authentication to GCP is Workload Identity Federation.

## What a compromise of this repository would still get

Everything, for the users who load the malicious page while it is served. The protections above lower the odds and raise the number of people who must collude; they do not change the model. The site says so in plain words.
