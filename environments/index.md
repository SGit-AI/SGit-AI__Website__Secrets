# Environments

> One site, one GCP project per environment: dev, main, prod, and a customer's own. How the browser picks an environment, what config/environments.json holds and why none of it is secret, and the setup guide for running your own project. Proposed.

*Source: <https://secrets.sgit.ai/environments/> · site v0.1.13 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [proposed](/review/ui/#node=claim.infra.bootstrap) Bootstrap script for the tfstate project, env projects, Terraform service account and WIF pool · [proposed](/review/ui/#node=claim.infra.terraform) Terraform module secrets-env and the dev environment root · [proposed](/review/ui/#node=claim.infra.environments-config) config/environments.json with real dev values from Terraform outputs · [proposed](/review/ui/#node=claim.app.environment-page) Environment page: pick a built-in environment, enter a custom one, import, export, reset

One site serves every environment. An environment is one [GCP project](/learn/gcp/index.md#gcp) holding an [Identity Platform](/learn/gcp/index.md#identity-platform) configuration and one [bucket](/learn/gcp/index.md#bucket); the project is the unit that is created and destroyed. The browser picks the environment at runtime, with `prod` as the default on `secrets.sgit.ai`, and shows which one is active in the app header at all times, so nobody enters a real secret into `dev` by mistake.

## The environments

| Environment | Purpose | GCP project id (proposed) | Who uses it |
|---|---|---|---|
| `dev` | Daily development, disposable | `sgit-secrets-dev` | Builders, and the end-to-end tests |
| `main` | Staging; what the `main` branch is tested against | `sgit-secrets-main` | Review |
| `prod` | The public default | `sgit-secrets-prod` | Everyone |
| `<customer>` | A customer's own project, in their organisation and billing | Theirs | Them |

The project ids are proposed until the bootstrap confirms they are available. None exists yet.

## What a project contains

[Terraform](/learn/gcp/index.md#terraform) in `infra/terraform/` will create, per project: the services; the Firebase project link and web app registration; Identity Platform with email/password and Google sign-in, authorised domains `secrets.sgit.ai` and `localhost`; a second OAuth client for the admin pages; the bucket with uniform access, versioning, thirty days of soft-delete retention and CORS for this origin; the [Security Rules](/learn/gcp/index.md#rules) release; IAM for the Terraform service account and the admins group; and the [Workload Identity Federation](/learn/gcp/index.md#wif) pool that lets GitHub Actions apply all of it without a key file. The first project and the pool are created once by a human with a short script, `infra/bootstrap/bootstrap.sh`, after which everything is Terraform. The exact procedure, as commands, is [docs/ops/bootstrap.md](/docs/ops/bootstrap.md).

## config/environments.json

The site ships one file naming every built-in environment. Every value in it is a **public identifier**: a Firebase web API key is not a secret, it is restricted by HTTP referrer, and the project id, auth domain, bucket name, app id and admin OAuth client id are all visible to any user of the app anyway. The file is generated from Terraform outputs by the pipeline and validated by the gate; a block whose values do not match the Terraform state it came from will fail the build. The leak tripwire allows the `AIza…` shape in this file only, so a key pasted anywhere else is caught.

```

{
  "version": 1,
  "siteVersion": "…",
  "default": "prod",
  "environments": {
    "prod": {
      "label":              "secrets.sgit.ai (production)",
      "projectId":          "sgit-secrets-prod",
      "apiKey":             "AIza… (public web API key, restricted by referrer)",
      "authDomain":         "sgit-secrets-prod.firebaseapp.com",
      "storageBucket":      "sgit-secrets-prod.firebasestorage.app",
      "appId":              "1:…:web:…",
      "adminOauthClientId": "….apps.googleusercontent.com",
      "tenantId":           null,
      "region":             "europe-west2",
      "signInMethod":       "popup"
    }
  }
}

```

The current file is [live on this site](/config/environments.json); at this version every environment in it is a placeholder.

## How the browser chooses

- The app reads the active configuration from `localStorage['sgit.secrets.config.v1']` if present, else from the file's `default`.
- `?env=dev` in the URL selects a built-in environment for that load and persists it.
- The Environment page will let a user pick a built-in environment, enter a custom one (every field above), export it as JSON, import one, and reset.
- Changing environment signs the user out and clears every key from memory.
- Nothing secret is ever stored in localStorage; the only other keys are user-interface conveniences, and the gate checks every write against the allow-list in `app/config/storage-keys.js`.

## Running your own

The target, from the brief: a customer with a GCP organisation and a billing account goes from nothing to a green setup checklist in under thirty minutes with no support. The guide, `docs/ops/new-environment.md`, arrives with step 7 and will say:

1. Run the bootstrap for one project.
2. Add your domain to the authorised domains.
3. Run Terraform.
4. Paste the printed configuration into the site's Environment page, or into your fork's `config/environments.json`.

The admin pages' setup checklist will verify each step against the live project. A customer can use the public site pointed at their own project, or fork the repository; either way the site never holds anything of theirs but public identifiers.

## Notes to verify

- Where Identity Platform stores user records, for customers with data-residency requirements. The bucket's location is chosen per project; Identity Platform is global.
- Whether the tenant claim is available to Storage Security Rules, for projects that turn on multi-tenancy.
- Pricing reference: Identity Platform basic sign-in is free to 50,000 monthly active users; SAML and OIDC federation are free only to 50.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/environments/)*
