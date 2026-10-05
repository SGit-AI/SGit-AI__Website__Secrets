# What only a human can do

*secrets.sgit.ai · operations · maintained by the build session · last updated at v0.1.0 (2026-10-05) · CC BY 4.0*

Everything on this list blocks a step of the brief and cannot be done from inside the repository. Each item says who, what, exactly, and which step waits on it. Items are removed when done and the removal is dated in `docs/design/brief-corrections.md` if anything turned out differently from the brief.

## Blocking step 1's acceptance (v0.1.0 live at secrets.sgit.ai)

1. **DNS (zone owner of sgit.ai).** Add `secrets  CNAME  sgit-ai.github.io`. Details in `docs/ops/dns.md`.
2. **GitHub Pages (repository admin).** Settings, Pages: source **GitHub Actions**; custom domain `secrets.sgit.ai`; then **Enforce HTTPS** once the certificate exists. The workflow does not enable Pages itself (that needs administration rights it must not hold); if the first `deploy` job fails at `configure-pages` with "Get Pages site failed", this is why.
3. **Re-run or re-push.** After 1 and 2, re-run the latest `deploy-pages` run on `dev` (Actions, Re-run all jobs) so `verify-live` can turn green. Nothing else about v0.1.0 changes.

## Blocking the protections (section 9.5), to be in place before step 3 lands real configuration

4. **Branch protection (organisation owner).** Apply the rules in `docs/ops/branch-protection.md` to `dev` and `main`, with `validate` as the required status check.
5. **Organisation 2FA with hardware keys (organisation owner).** Settings, Authentication security.
6. **Verified domain (organisation owner).** Add and verify `sgit.ai` under Settings, Verified and approved domains.
7. **Actions policy (organisation owner).** Allow only GitHub-authored and organisation-authored actions; default `GITHUB_TOKEN` read-only; Actions may not create or approve pull requests.

## Blocking step 3 (the dev GCP project)

8. **Billing account (GCP billing admin).** A billing account the three projects can attach to. The build session will write `infra/bootstrap/bootstrap.sh` in step 3 and needs its id passed as a variable, never committed.
9. **Project ids (GCP org admin).** Confirm `sgit-secrets-tfstate`, `sgit-secrets-dev`, `sgit-secrets-main`, `sgit-secrets-prod` are available, or choose others; the brief marks them PROPOSED.
10. **Run the bootstrap (a human with org-level IAM).** Once `infra/bootstrap/bootstrap.sh` exists: run it with `--dry-run`, then for real. It prints the values for the GitHub environment variables (`WORKLOAD_IDENTITY_PROVIDER`, `SERVICE_ACCOUNT`) per environment.
11. **Google OAuth client secret for sign-in (GCP project owner).** Create the Web application OAuth client in the `dev` project (origin `https://secrets.sgit.ai`, redirect `https://<authDomain>/__/auth/handler`) and store its secret as the GitHub environment secret `GOOGLE_OAUTH_CLIENT_SECRET` in the `dev` environment. It never enters the repository.

## Not yet needed

- `main` and `prod` projects, their OAuth clients and their environment secrets: step 7 and step 8.
- A reviewer for the `prod` environment: step 8.
- The DNS guards (registrar lock, DNSSEC, CAA): listed on `/security/` when it exists, with dates; not blocking.
