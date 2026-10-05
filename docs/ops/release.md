# How a release works

*secrets.sgit.ai · operations · written at v0.1.0 (2026-10-05) · CC BY 4.0*

Every push to `dev` is a release. There is no build step: the committed tree is the deployed tree, and five small generators keep the parts that must agree in agreement. One pipeline validates, tags, deploys and then checks that the live site is serving what was pushed.

## The version

- The version lives in one file, `admin/build/version.txt`, as `X.Y.Z` with no `v`.
- Every push to `dev` bumps the minor (`0.1.0` to `0.2.0`). A patch (`0.2.1`) is for a same-day fix. A major `.0.0` is deliberate and rare.
- The release commit's subject is `site vX.Y.Z : <what>`, with the same version. CI anchors on the newest commit whose subject has that shape, not on HEAD, because a merge commit may sit on top.
- `data/versions.json` gets a new first row: version, date, title, notes. The title is the `<what>` of the subject.
- The version is repeated by the generators into every page badge, every markdown twin, `llms.txt`, `llms-full.txt`, `sitemap.xml` and the release table. `config/environments.json#siteVersion` is bumped by hand. Check 1 of the gate fails on any disagreement.

## The steps, locally

```
# 1. edit content, data/features.json and data/versions.json; bump admin/build/version.txt and config/environments.json#siteVersion
python3 admin/build/gate.py --build      # regenerate everything, then run the whole gate
git add -A
git commit -m "site vX.Y.Z : <what>"
git push -u origin dev                   # or open a PR to dev from claude/<description>-<session-id>
```

`gate.py --build` runs the generators in order (chrome, features, versions, twins, llms), then runs them again with `--check`, then `node admin/build/validate.js`, then `python3 -m pytest tests/build/ -q`, then `node --test tests/unit/**/*.test.js`. `gate.py` without `--build` runs the same list in check mode only, which is exactly what CI does.

## The steps, in CI (`.github/workflows/deploy-pages.yml`)

| Job | When | Does | On failure |
|---|---|---|---|
| `validate` | every push to `dev` or `main`, every PR to either, manual dispatch | `python3 admin/build/gate.py` | nothing is tagged or deployed |
| `tag-release` | push to `dev` only | `admin/build/tag_release.py`: version.txt equals the newest `site vX.Y.Z` subject; the version is the next minor, a patch or a major `.0.0` after the newest tag; backfills missing historical tags; pushes `refs/tags/vX.Y.Z` | no deploy |
| `deploy` | any push or dispatch, never a PR | `admin/build/assemble_site.py` copies the tree minus `.git`, `.github`, `infra`, `tests/unit`, `node_modules` into `_site/`; upload and deploy to GitHub Pages | the previous version stays live |
| `verify-live` | after deploy | `admin/build/verify_live.py` polls `https://secrets.sgit.ai/admin/build/version.txt` and the homepage badge with a cache-buster until both equal the version, for up to ten minutes | the run is red; the site may be stale |

A push to `main` deploys without tagging: `main` is promoted from `dev` and is the fallback. Both branches deploy to the one Pages site of this repository, so whichever pushed last is what `secrets.sgit.ai` serves; `main` is promoted only to a version `dev` already released.

## Green does not mean live

The sibling site sgit.ai once pushed two releases that reported success and never reached anyone, because the Pages deploy job died downloading its own action. The `verify-live` job exists for that reason: the release is not done until the origin answers with the new version. When `verify-live` is red and `deploy` is green, the usual causes are the domain not yet pointing at Pages (see `docs/ops/dns.md`), Pages not yet enabled for the repository, or a transient `429` on an action download, which a re-run fixes.

## The eight checks of the gate

See `/admin/` on the site or the header of `admin/build/validate.js`. The rule for the leak tripwire is worth repeating: the fix for a trip is always a redaction, never a wider pattern.

## Backfilling tags

`tag_release.py` tags every historical release commit that has no tag, oldest first, then pushes all the new tags. A tag that already points at its release commit is left alone. A tag that points elsewhere fails the job: tags are never moved.
