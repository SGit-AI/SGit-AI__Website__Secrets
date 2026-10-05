# GCP bootstrap: exactly what a human does, from the command line

*secrets.sgit.ai · operations · written at v0.1.2 (2026-10-05) · for Dinis · section 4.3 of the brief · CC BY 4.0*

This is the whole list of what the pipeline cannot do for itself on the Google side, in the order to do it, as commands. Everything else in the GCP projects is Terraform, applied by GitHub Actions through Workload Identity Federation, with no key file anywhere. Nothing on this page is secret, and nothing you produce by following it enters the repository except public identifiers.

Status of this page: the script exists and has been dry-run against its own logic; it has **not yet been run against a real billing account**. The first real run is yours, and whatever it gets wrong goes into `docs/design/brief-corrections.md`.

## What you need before starting

| Tool | Check | Install |
|---|---|---|
| `gcloud` | `gcloud --version` and `gcloud auth login` as an account that can create projects and link billing | https://cloud.google.com/sdk/docs/install |
| `gh` | `gh auth status` as an owner of `SGit-AI` | https://cli.github.com |
| `firebase` (only if step 3 below is needed) | `firebase --version` | `npm i -g firebase-tools` |
| A billing account | `gcloud billing accounts list` shows it with `OPEN: True` | Google Cloud console, Billing (one-time; there is no CLI to create a billing account) |

Decide two values. The project id prefix: the brief proposes `sgit-secrets`, giving `sgit-secrets-tfstate`, `sgit-secrets-dev`, `sgit-secrets-main`, `sgit-secrets-prod`; project ids are global, so if one is taken choose another prefix and pass it as `SECRETS_PREFIX`. The parent: if your account is in a Google Cloud organisation, `organizations/<id>` or `folders/<id>`; a personal account omits it.

## Step 1: run the bootstrap (gcloud, about five minutes)

```
# from the repository root, on dev
export SECRETS_BILLING_ACCOUNT=0X0X0X-0X0X0X-0X0X0X      # from: gcloud billing accounts list
export SECRETS_PARENT=organizations/<org-id>             # omit for a personal account
export SECRETS_ENVS=dev                                  # main,prod are added later with the same command

./infra/bootstrap/bootstrap.sh --dry-run                 # prints every command it would run; runs none
./infra/bootstrap/bootstrap.sh                           # creates what is missing, skips what exists
./infra/bootstrap/bootstrap.sh --check                   # afterwards, or any time: reports state, changes nothing
```

What it creates, each guarded by a describe so a re-run is safe:

1. The state project `<prefix>-tfstate` with billing linked, and the bucket `gs://<prefix>-tfstate` in `europe-west2` with uniform access, public-access prevention and versioning on. One prefix per environment inside it is Terraform's.
2. Per environment: the project `<prefix>-<env>`, billing linked, the ten APIs the design needs enabled.
3. Per environment: the service account `tf-secrets@<project>.iam.gserviceaccount.com` with Editor plus the IAM, Firebase, Identity Platform and Service Usage roles Editor lacks, and object-admin on the state bucket. Editor is the brief's starting point and is narrowed later.
4. Per environment: the Workload Identity Federation pool `github` with the OIDC provider `github-actions`, limited by an attribute condition to this repository and to the GitHub environment named `<env>` (or a push to the branch `<env>`), and the binding that lets that identity act as the service account.

It ends by printing, per environment, the four public values GitHub needs and the exact `gh` commands to store them. Nothing it prints is secret.

## Step 2: store the values in GitHub (gh, one minute)

Paste the commands the script printed. They are of this shape:

```
gh api -X PUT repos/SGit-AI/SGit-AI__Website__Secrets/environments/dev >/dev/null
gh variable set PROJECT_ID                 --repo SGit-AI/SGit-AI__Website__Secrets --env dev --body 'sgit-secrets-dev'
gh variable set WORKLOAD_IDENTITY_PROVIDER --repo SGit-AI/SGit-AI__Website__Secrets --env dev --body 'projects/<project-number>/locations/global/workloadIdentityPools/github/providers/github-actions'
gh variable set SERVICE_ACCOUNT            --repo SGit-AI/SGit-AI__Website__Secrets --env dev --body 'tf-secrets@sgit-secrets-dev.iam.gserviceaccount.com'
gh variable set TFSTATE_BUCKET             --repo SGit-AI/SGit-AI__Website__Secrets --env dev --body 'sgit-secrets-tfstate'
```

They are GitHub **environment variables**, not secrets, because they are not secret. `infra.yml` (step 3 of the build) reads them from the `dev` environment.

## Step 3: Firebase, only if Terraform asks for it

Terraform adds Firebase to the project (`google_firebase_project`). The Firebase Management API refuses that call until the Firebase terms of service have been accepted once by a human account. If the first `terraform apply` fails on that resource with a terms-of-service error, run this once, as yourself, and re-run the apply:

```
firebase login
firebase projects:addfirebase sgit-secrets-dev
```

It is still the command line, and it is the only Firebase step that is yours.

## Step 4: the OAuth clients (console, the one part Google keeps there)

Google does not expose the creation of a **Web application** OAuth client, or the consent screen it hangs off, through `gcloud` or a public API for an app that external Google accounts will sign in to. This is the one place you click. Per project, once:

1. Open https://console.cloud.google.com/auth/overview?project=sgit-secrets-dev and configure the consent screen ("Google Auth Platform"): external, app name `secrets.sgit.ai`, your support email, the developer contact; no scopes beyond the defaults.
2. Create the **sign-in client**: https://console.cloud.google.com/auth/clients?project=sgit-secrets-dev, type Web application, name `secrets.sgit.ai sign-in`, authorised JavaScript origin `https://secrets.sgit.ai` (and `http://localhost:8000` on `dev` only), authorised redirect URI `https://sgit-secrets-dev.firebaseapp.com/__/auth/handler`. Copy the client id and the client secret once.
3. Create the **admin client**: same page, type Web application, name `secrets.sgit.ai admin`, authorised JavaScript origin `https://secrets.sgit.ai` (plus `http://localhost:8000` on `dev`), authorised redirect URI `https://secrets.sgit.ai/admin/oauth-return.html`. Only its client id is used; its secret stays in the project.

Then, from the command line, store the one secret and tell the session the public ids:

```
gh secret set GOOGLE_OAUTH_CLIENT_SECRET --repo SGit-AI/SGit-AI__Website__Secrets --env dev      # paste the sign-in client's secret
```

The sign-in client id and the admin client id are public and go into Terraform variables and `config/environments.json`; put them in a reply or a pull request, never the secret. The secret is used only by Google's own token exchange inside Identity Platform; the app never holds it.

## Step 5: the repository protections (gh, two minutes)

Section 9.5, done from the command line where GitHub allows it:

```
# branch protection on dev and main: PR required, one review, validate required, linear history, no force-push, no bypass
for b in dev main; do
  gh api -X PUT repos/SGit-AI/SGit-AI__Website__Secrets/branches/$b/protection \
    --input - <<'JSON'
{ "required_status_checks": { "strict": true, "contexts": ["validate"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "required_approving_review_count": 1 },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false }
JSON
done

# Actions: the default token is read-only and may not approve pull requests
gh api -X PUT repos/SGit-AI/SGit-AI__Website__Secrets/actions/permissions/workflow \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
```

Two organisation settings have no API and are console-only, once: requiring two-factor authentication with security keys for members (Organisation settings, Authentication security), and verifying `sgit.ai` as an organisation domain (Organisation settings, Verified and approved domains). The `prod` environment's required reviewer is set when `prod` exists.

Note on branch protection and this session: once `dev` requires a pull request, the session opens one per release instead of pushing. Say when you have turned it on.

## What to send back

- The output of `./infra/bootstrap/bootstrap.sh --check` after the run (public values only).
- The sign-in client id and the admin client id for `dev`.
- Whether step 3 was needed.

With those, step 3 of the build can be exercised: Terraform applies the module to `dev`, `config/environments.json` gets real `dev` values from the outputs, and `tests/auth.html` and `tests/storage.html` can be run against it.

## What this page does not cover

- `main` and `prod`: the same script with `SECRETS_ENVS=main,prod`, their own OAuth clients, and a required reviewer on the `prod` GitHub environment. Steps 7 and 8 of the build.
- A customer's own project: `docs/ops/new-environment.md`, step 7, which will be this page with the prefix and the parent as inputs.
- Narrowing the service account from Editor: after the first apply shows which permissions were actually used.
