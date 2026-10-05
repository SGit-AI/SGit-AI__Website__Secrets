#!/usr/bin/env bash
# ── bootstrap.sh — the one-time GCP bootstrap for secrets.sgit.ai, run by a human ──
#
# Creates what the pipeline cannot create for itself (section 4.3 of the brief):
# the Terraform state project and bucket, one project per environment with
# billing linked and the APIs enabled, the Terraform service account in each,
# and the Workload Identity Federation pool and provider that let GitHub
# Actions act as that service account with no key file. Everything after this
# is Terraform. Idempotent: every create is guarded by a describe, so it can be
# re-run after a failure or to add an environment.
#
#   ./infra/bootstrap/bootstrap.sh --dry-run     print every command, run none
#   ./infra/bootstrap/bootstrap.sh --check       report what exists, change nothing
#   ./infra/bootstrap/bootstrap.sh               create what is missing, then print
#                                                the GitHub values and gh commands
#
# Inputs, as environment variables (none is ever committed):
#   SECRETS_BILLING_ACCOUNT   required   e.g. 0X0X0X-0X0X0X-0X0X0X (gcloud billing accounts list)
#   SECRETS_PARENT            optional   organizations/<id> or folders/<id>; omit for a personal account
#   SECRETS_ENVS              optional   comma list, default "dev"; add main,prod later
#   SECRETS_PREFIX            optional   project id prefix, default "sgit-secrets" (section 4.1, PROPOSED)
#   SECRETS_REGION            optional   default "europe-west2"
#   SECRETS_GITHUB_REPO       optional   default "SGit-AI/SGit-AI__Website__Secrets"
#
# Nothing this script prints is secret: project ids, project numbers, service
# account emails and the WIF provider path are public identifiers.

set -euo pipefail

MODE="apply"
case "${1:-}" in
  --dry-run) MODE="dry-run" ;;
  --check)   MODE="check" ;;
  "")        ;;
  *) echo "usage: $0 [--dry-run|--check]" >&2; exit 2 ;;
esac

PREFIX="${SECRETS_PREFIX:-sgit-secrets}"
ENVS="${SECRETS_ENVS:-dev}"
REGION="${SECRETS_REGION:-europe-west2}"
GITHUB_REPO="${SECRETS_GITHUB_REPO:-SGit-AI/SGit-AI__Website__Secrets}"
PARENT="${SECRETS_PARENT:-}"
TFSTATE_PROJECT="${PREFIX}-tfstate"
TFSTATE_BUCKET="${PREFIX}-tfstate"
POOL="github"
PROVIDER="github-actions"
SA_NAME="tf-secrets"

# APIs every environment project needs (section 4.2, item 1)
ENV_APIS=(
  identitytoolkit.googleapis.com
  firebase.googleapis.com
  firebasestorage.googleapis.com
  storage.googleapis.com
  firebaserules.googleapis.com
  cloudresourcemanager.googleapis.com
  serviceusage.googleapis.com
  iam.googleapis.com
  iamcredentials.googleapis.com
  sts.googleapis.com
)

# Roles the Terraform service account holds on its own project (section 4.2, item 9:
# Editor, narrowed later; plus what Editor does not cover and Terraform needs)
SA_ROLES=(
  roles/editor
  roles/resourcemanager.projectIamAdmin
  roles/iam.serviceAccountAdmin
  roles/iam.workloadIdentityPoolAdmin
  roles/firebase.admin
  roles/identityplatform.admin
  roles/serviceusage.serviceUsageAdmin
)

# ── helpers ───────────────────────────────────────────────────────────────────

say()  { printf '%s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }
ok()   { printf '   \e[32m✓\e[0m %s\n' "$*"; }
miss() { printf '   \e[33m·\e[0m %s\n' "$*"; }
die()  { printf '\e[31mbootstrap: %s\e[0m\n' "$*" >&2; exit 1; }

shown() { printf '   $'; printf ' %q' "$@"; printf '\n'; }                      # a pasteable rendering of a command

run() {                                                                          # run, or print, one mutating command
  if [[ "$MODE" == "dry-run" ]]; then shown "$@"; return 0; fi
  if [[ "$MODE" == "check"   ]]; then return 0; fi
  shown "$@"
  "$@"
}

project_number() { gcloud projects describe "$1" --format='value(projectNumber)' 2>/dev/null || echo "<project-number>"; }

exists() { "$@" >/dev/null 2>&1; }                                               # a describe that succeeds means the resource exists

parent_flag() {
  case "$PARENT" in
    organizations/*) printf -- '--organization=%s' "${PARENT#organizations/}" ;;
    folders/*)       printf -- '--folder=%s'       "${PARENT#folders/}" ;;
    "")              ;;
    *) die "SECRETS_PARENT must be organizations/<id> or folders/<id>, got '$PARENT'" ;;
  esac
}

# ── preconditions ─────────────────────────────────────────────────────────────

head_ "preconditions (mode: $MODE)"
command -v gcloud >/dev/null || die "gcloud is not installed: https://cloud.google.com/sdk/docs/install"
ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
[[ -n "$ACCOUNT" ]] || die "no active gcloud account; run: gcloud auth login"
ok "gcloud as $ACCOUNT"
[[ -n "${SECRETS_BILLING_ACCOUNT:-}" ]] || die "SECRETS_BILLING_ACCOUNT is not set; pick one from: gcloud billing accounts list"
if exists gcloud billing accounts describe "$SECRETS_BILLING_ACCOUNT"; then
  ok "billing account $SECRETS_BILLING_ACCOUNT is reachable"
else
  die "billing account $SECRETS_BILLING_ACCOUNT is not reachable by $ACCOUNT"
fi
say "   prefix=$PREFIX envs=$ENVS region=$REGION parent=${PARENT:-(none)} repo=$GITHUB_REPO"

# ── the state project and bucket ──────────────────────────────────────────────

head_ "state project $TFSTATE_PROJECT"
if exists gcloud projects describe "$TFSTATE_PROJECT"; then
  ok "project exists"
else
  miss "project missing"
  run gcloud projects create "$TFSTATE_PROJECT" --name="secrets.sgit.ai tfstate" $(parent_flag)
fi
if [[ "$MODE" != "check" ]]; then
  run gcloud billing projects link "$TFSTATE_PROJECT" --billing-account="$SECRETS_BILLING_ACCOUNT"
  run gcloud services enable storage.googleapis.com --project="$TFSTATE_PROJECT"
fi
if exists gcloud storage buckets describe "gs://$TFSTATE_BUCKET"; then
  ok "bucket gs://$TFSTATE_BUCKET exists"
else
  miss "bucket gs://$TFSTATE_BUCKET missing"
  run gcloud storage buckets create "gs://$TFSTATE_BUCKET" --project="$TFSTATE_PROJECT" --location="$REGION" \
      --uniform-bucket-level-access --public-access-prevention
  run gcloud storage buckets update "gs://$TFSTATE_BUCKET" --versioning
fi

# ── one project per environment ───────────────────────────────────────────────
# (no associative arrays: the macOS default bash is 3.2)

for ENV in ${ENVS//,/ }; do
  PROJECT="${PREFIX}-${ENV}"
  SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

  head_ "environment $ENV: project $PROJECT"
  if exists gcloud projects describe "$PROJECT"; then
    ok "project exists"
  else
    miss "project missing"
    run gcloud projects create "$PROJECT" --name="secrets.sgit.ai $ENV" $(parent_flag)
  fi
  if [[ "$MODE" != "check" ]]; then
    run gcloud billing projects link "$PROJECT" --billing-account="$SECRETS_BILLING_ACCOUNT"
    run gcloud services enable "${ENV_APIS[@]}" --project="$PROJECT"
  else
    ENABLED="$(gcloud services list --enabled --project="$PROJECT" --format='value(config.name)' 2>/dev/null || true)"
    for API in "${ENV_APIS[@]}"; do
      if grep -qx "$API" <<<"$ENABLED"; then ok "$API"; else miss "$API not enabled"; fi
    done
  fi

  NUMBER="$(project_number "$PROJECT")"

  head_ "environment $ENV: Terraform service account $SA"
  if exists gcloud iam service-accounts describe "$SA" --project="$PROJECT"; then
    ok "service account exists"
  else
    miss "service account missing"
    run gcloud iam service-accounts create "$SA_NAME" --project="$PROJECT" --display-name="Terraform for secrets.sgit.ai ($ENV)"
  fi
  for ROLE in "${SA_ROLES[@]}"; do
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$ROLE" --condition=None --quiet
  done
  run gcloud storage buckets add-iam-policy-binding "gs://$TFSTATE_BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin

  head_ "environment $ENV: Workload Identity Federation"
  if exists gcloud iam workload-identity-pools describe "$POOL" --project="$PROJECT" --location=global; then
    ok "pool $POOL exists"
  else
    miss "pool $POOL missing"
    run gcloud iam workload-identity-pools create "$POOL" --project="$PROJECT" --location=global --display-name="GitHub Actions"
  fi
  CONDITION="assertion.repository == '${GITHUB_REPO}' && (assertion.environment == '${ENV}' || assertion.ref == 'refs/heads/${ENV}')"
  if exists gcloud iam workload-identity-pools providers describe "$PROVIDER" --project="$PROJECT" --location=global --workload-identity-pool="$POOL"; then
    ok "provider $PROVIDER exists"
  else
    miss "provider $PROVIDER missing"
    run gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project="$PROJECT" --location=global \
        --workload-identity-pool="$POOL" --display-name="GitHub Actions OIDC" \
        --issuer-uri="https://token.actions.githubusercontent.com" \
        --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.environment=assertion.environment" \
        --attribute-condition="$CONDITION"
  fi
  run gcloud iam service-accounts add-iam-policy-binding "$SA" --project="$PROJECT" --role=roles/iam.workloadIdentityUser \
      --member="principalSet://iam.googleapis.com/projects/${NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}"
done

# ── what goes into GitHub ─────────────────────────────────────────────────────

head_ "GitHub environment values (public identifiers; nothing here is secret)"
for ENV in ${ENVS//,/ }; do
  PROJECT="${PREFIX}-${ENV}"
  NUMBER="$(project_number "$PROJECT")"
  WIP="projects/${NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
  SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
  say ""
  say "   environment: $ENV"
  say "   PROJECT_ID=$PROJECT"
  say "   WORKLOAD_IDENTITY_PROVIDER=$WIP"
  say "   SERVICE_ACCOUNT=$SA"
  say "   TFSTATE_BUCKET=$TFSTATE_BUCKET"
  say ""
  say "   gh api -X PUT repos/${GITHUB_REPO}/environments/${ENV} >/dev/null"
  say "   gh variable set PROJECT_ID                 --repo ${GITHUB_REPO} --env ${ENV} --body '${PROJECT}'"
  say "   gh variable set WORKLOAD_IDENTITY_PROVIDER --repo ${GITHUB_REPO} --env ${ENV} --body '${WIP}'"
  say "   gh variable set SERVICE_ACCOUNT            --repo ${GITHUB_REPO} --env ${ENV} --body '${SA}'"
  say "   gh variable set TFSTATE_BUCKET             --repo ${GITHUB_REPO} --env ${ENV} --body '${TFSTATE_BUCKET}'"
done
say ""
say "   Then the one value this script cannot make, the sign-in OAuth client secret (docs/ops/bootstrap.md, step 4):"
say "   gh secret set GOOGLE_OAUTH_CLIENT_SECRET --repo ${GITHUB_REPO} --env dev     # paste it; it never enters the repository"
say ""
[[ "$MODE" == "check" ]] && say "check complete: nothing was changed." || say "bootstrap complete (mode: $MODE)."
