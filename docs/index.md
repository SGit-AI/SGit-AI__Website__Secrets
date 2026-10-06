# Documents

> Every document this site carries, readable as a rendered page with the raw markdown one click away: the brief and its corrections, the four design documents, the operations notes, and the reality document generated on each release.

*Source: <https://secrets.sgit.ai/docs/> · site v0.1.11 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

The documents this site was built from and the notes it is run by, published whole. Each is a markdown file in the repository, which is the source of truth, and a page rendered from it on every release, which is presentation. The rendered page links the raw file at the top; the raw file is what a reader checks the site against.

- [Design documents](/docs/design/index.md): [the MVP build brief](/docs/design/secrets-sgit-ai__mvp-build-brief.md) (the instruction set), [what it got wrong](/docs/design/brief-corrections.md), and the four documents that carry the reasoning.
- [Operations](/docs/ops/index.md): [how a release works](/docs/ops/release.md), [what only a human can do](/docs/ops/needs.md), [the GCP bootstrap as commands](/docs/ops/bootstrap.md), [the DNS record](/docs/ops/dns.md), [the repository protections](/docs/ops/branch-protection.md).
- [Reality](/docs/reality.md): what is built, by status, generated from `data/features.json`. The same data renders [/shipped/](/shipped/index.md).

## Why publish the brief at all

A reader who wants to check whether this site is faithful to what it was asked to build should not have to reconstruct the brief from the site. Publishing the commission, and the corrections beside it, makes the site checkable against something other than its own claims. That is the same argument the reality document makes, pointed at this site.

## For agents

[llms.txt](/llms.txt) lists every page and document with a one-line description; [llms-full.txt](/llms-full.txt) is all of them in one fetch. Every HTML page has a markdown twin at the same path with the extension swapped, and links inside the markdown point at markdown.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/docs/)*
