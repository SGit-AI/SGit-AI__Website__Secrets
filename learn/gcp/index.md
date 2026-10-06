# GCP, from this site's side

> What the Google Cloud project is for and what it sees: Identity Platform and the uid, the bucket and the Security Rules, Terraform and Workload Identity Federation, the admin pages, a customer's own project; drawn from the project's point of view.

*Source: <https://secrets.sgit.ai/learn/gcp/> · site v0.1.13 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [proposed](/review/ui/#node=claim.infra.terraform) Terraform module secrets-env and the dev environment root · [proposed](/review/ui/#node=claim.infra.rules) Storage Security Rules deployed per environment · [proposed](/review/ui/#node=claim.app.sign-in) Sign in and out with Google and email/password against the chosen environment · [proposed](/review/ui/#node=claim.admin.setup-checklist) Setup checklist: every per-project resource as a row, with Fix where fixable client-side

The site is static files on GitHub Pages. Everything that remembers anything across devices is in one Google Cloud project per environment: a login service and a bucket. This page is that project seen from the project's own side: what is in it, who set it up, what each request from a browser looks like when it arrives, and what Google can and cannot do with what it holds. All of it is *proposed*: no project exists yet, and the bootstrap needs a human ([needs.md](/docs/ops/needs.md)).

<a id="gcp"></a>

## What the project is for

Two jobs, and a third that is only tooling. **Identity Platform** signs users in and hands the browser a token that names them. **A Cloud Storage bucket**, behind Security Rules, stores each user's encrypted [keyring](/keyring/index.md) where only that user's token can reach it. **Terraform**, run by GitHub Actions, creates both and can change or delete them. There is no Cloud Function, no proxy, no API of our own, and the design forbids adding one: a server that touched plaintext would be a party that could be compelled or compromised, and the whole point is that no such party exists.

There is one project per environment (`dev`, `main`, `prod`), each with its own bucket and its own users, chosen at runtime by the browser's configuration ([Environments](/environments/index.md)). A customer can run their own project in their own organisation and billing, point the public site at it, and get the same site with their own data.

<a id="diagram-gcp-view"></a>
The same diagram as text

```
Your browser (this sit  Identity Platform       The bucket, behind Sec  GitHub Actions: Terraf
 │                       │ Terraform: enable email and Google sign-in, authorised domains
 │                       │ secrets.sgit.ai and localhost                 │
 │                       │◀──────────────────────────────────────────────│
 │                       │                       │                       │
 │                       │                       │ Terraform: the bucket (versioned, CORS for
 │                       │                       │ secrets.sgit.ai), and the rules release
 │                       │                       │ from infra/rules/storage.rules
 │                       │                       │◀──────────────────────│
 │                       │                       │                       │
 │ sign in, in a popup: email and password, or Google                    │
 │──────────────────────▶│                       │                       │
 │                       │                       │                       │
 │ an ID token: uid, email, expiry               │                       │
 │◀──────────────────────│                       │                       │
 │                       │                       │                       │
 │ GET or PUT users/{uid}/keyring.json with the token; PUT carries x-goog-if-generation-match
 │──────────────────────────────────────────────▶│                       │
 │                       │                       │                       │
 │                       │                       │ ┆ rules: the caller's uid must equal {uid}
 │                       │                       │ ┆ in the path; objects have a size limit;
 │                       │                       │ ┆ nothing else is readable
 │                       │                       │                       │
 │ ciphertext and the generation number          │                       │
 │◀──────────────────────────────────────────────│                       │
 │                       │                       │                       │
 │                       │ ┆ sees: who signed in, when, from where; can disable an account or
 │                       │ ┆ sign in as anyone, and gets ciphertext for it
 │                       │                       │                       │
 │                       │                       │ ┆ sees: object names, sizes, times; can
 │                       │                       │ ┆ delete or roll back; never a plaintext
 │                       │                       │ ┆ byte                │
 │                       │                       │                       │
```

Section 4 of the brief, from the project's side. Terraform, run by GitHub Actions through Workload Identity Federation, sets the project up; the browser talks to Identity Platform to sign in and to the bucket, directly, with the login's token; the Security Rules in front of the bucket are the whole access control. Every arrow into Google carries public identifiers or ciphertext.

<a id="identity-platform"></a>
**Identity Platform**
: Google's login service, used from the browser through the vendored Firebase Auth SDK, in a popup. Email and password, or Google sign-in. The result is an ID token the page holds in memory and sends with every bucket request. The login decides which prefix of the bucket the browser may touch and nothing else: an administrator of Identity Platform can disable an account or sign in as anyone, and what they get for it is ciphertext. Identity Platform's own [passkey](/learn/passkeys/index.md#passkey) feature is not used; the unlock passkey is a plain [WebAuthn](/learn/passkeys/index.md#webauthn) credential registered by this page.

<a id="uid"></a>
**The uid**
: The login's stable identifier for a user. It names the user's prefix in the bucket, `users/{uid}/`, and it appears in the rules. It is not a secret and it is not the WebAuthn [user handle](/learn/passkeys/index.md#user-handle), which is 32 random bytes of its own, so the [authenticator](/learn/passkeys/index.md#authenticator) learns nothing about the account.

<a id="bucket"></a>
**The bucket**
: A Cloud Storage for Firebase bucket, one per environment, with uniform access, versioning on, ten noncurrent versions kept and a thirty-day soft-delete, and CORS for `https://secrets.sgit.ai` only. The browser reads and writes objects in it directly over HTTPS with the login's token; a write carries `x-goog-if-generation-match` so two devices cannot overwrite each other blindly. What it holds per user: `keyring.json` (ciphertext, a public salt, wrapped keys) and `meta.json` (public identifiers). What it sees: names, sizes, times. What it can do: delete, roll back. What it cannot do: read a plaintext byte.

<a id="rules"></a>
**The Security Rules**
: A rules file, `infra/rules/storage.rules`, deployed in front of the bucket. A signed-in user may read and write only under their own uid; object sizes are capped; nothing else is readable by anyone through the API. The rules are the whole access control of the MVP, which is why the admin pages show the deployed rules against the file in this repository and why the probe page `storage.html` (proposed) tries to read another uid's path and expects a 403.

<a id="terraform"></a>
**Terraform**
: The description of everything above, in `infra/terraform/`: one module, one root per environment. It enables the services, links the project to Firebase, registers the web app whose public identifiers go into `config/environments.json`, configures the login, makes the bucket, and releases the rules. GitHub Actions runs it: plan on a pull request, apply on push to `dev` for the dev environment. It can reconfigure or destroy; it has no path to a plaintext byte, because none exists in the project.

<a id="wif"></a>
**Workload Identity Federation**
: How the pipeline becomes someone in GCP without a stored key. A pool and a provider in the project trust GitHub's own token for exactly this repository and these branches, and let it act as the Terraform service account. No service account key exists anywhere: not in the repository, not in a GitHub secret, not on a laptop. The first project and the pool themselves are made once, by a person, with the bootstrap script, because the pipeline that depends on them cannot create them.

<a id="sees"></a>

## What Google sees, and what it cannot

| Google can | Google cannot |
|---|---|
| See who signed in, when, from where; the email on the account | See a plaintext entry, a key, the [recovery code](/learn/keys/index.md#recovery-code), the [PRF](/learn/passkeys/index.md#prf) bytes |
| Sign in as any user and fetch their objects | Open those objects: the PRF secret is in the user's authenticator, bound to this origin |
| Delete a keyring, roll it back to an older version, keep a copy | Alter it undetected: a changed byte fails authentication; a transplanted body fails on its AAD |
| See object sizes and times, and so roughly how much a user keeps and how often it changes | See how many entries, of what kind, or their names |

This is the first row of the table on the [security page](/security/index.md), from the other side. The row that matters more is the last one there: whoever serves the JavaScript can get everything, which is why that page is mostly about this repository and not about Google.

<a id="admin"></a>

## The admin pages

There is no admin role in the app. [/admin/](/admin/index.md) signs you in to Google with your own account (OAuth, scope `cloud-platform`, token in memory only) and calls GCP's REST APIs as you: if your account has IAM on the project, the checklist shows each resource as present, enabled, configured, or not, with a Fix where one is possible from a browser. An admin page can list users, deploy rules and change CORS. It cannot open a keyring, because a keyring is ciphertext and an admin's token unlocks nothing.

<a id="customer"></a>

## A customer's own project

You have a GCP organisation and a billing account. Run the bootstrap for one project, add your domain to the authorised domains, run Terraform, and paste the printed configuration into the site's Environment page, or into your fork's `config/environments.json`. The target is under thirty minutes with no support, and the admin checklist verifies each step. Your users then sign in to your login and store ciphertext in your bucket, from the same public site or your copy of it.

## Read next

[Environments](/environments/index.md): how the browser chooses a project. [Passkeys](/learn/passkeys/index.md): the thing Google never holds. [The bootstrap, as commands](/docs/ops/bootstrap.md).

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/learn/gcp/)*
