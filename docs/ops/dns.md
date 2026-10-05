# DNS for secrets.sgit.ai

*secrets.sgit.ai · operations · written at v0.1.0 (2026-10-05) · for the owner of the sgit.ai zone · CC BY 4.0*

The site is served by GitHub Pages from the repository `SGit-AI/SGit-AI__Website__Secrets`. The repository already carries `CNAME` with the one line `secrets.sgit.ai`. Two things are needed from the zone owner and the repository admin, in this order.

## 1. The DNS record

In the `sgit.ai` zone add one record:

| Name | Type | Value | TTL |
|---|---|---|---|
| `secrets` | `CNAME` | `sgit-ai.github.io` | 3600 or the zone default |

Do not use an `A` record to the Pages IP addresses for this host; the `CNAME` to the organisation's Pages host is what GitHub recommends for a subdomain and what lets GitHub rotate addresses.

## 2. GitHub Pages on the repository

In the repository, Settings, Pages:

1. Source: **GitHub Actions** (not "deploy from a branch"). The workflow `deploy-pages.yml` publishes the artifact.
2. Custom domain: `secrets.sgit.ai`. Save. GitHub checks the DNS record and then provisions the certificate, which can take up to an hour after the record propagates.
3. Tick **Enforce HTTPS** once the certificate is issued.

## 3. What then happens by itself

The next run of `deploy-pages.yml` on `dev` (or a manual dispatch of it) deploys, and its `verify-live` job turns green when `https://secrets.sgit.ai/admin/build/version.txt` serves the released version. Until the record and the Pages settings exist, `verify-live` is red by design.

## Guards the security page will list, dated

These are the zone owner's decisions and are listed on `/security/` once it exists, with the date they were checked:

- Registrar lock on `sgit.ai`.
- DNSSEC on the zone.
- A `CAA` record limiting certificate issuance (GitHub Pages uses Let's Encrypt: `0 issue "letsencrypt.org"`).
- The `sgit.ai` domain verified in the GitHub organisation (Settings, Verified and approved domains), which stops another account claiming a dangling `*.sgit.ai` subdomain on Pages.
