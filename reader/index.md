# The reader's page

> Where the reader's column talks to the outside: chat with the site through your own OpenRouter key, and send your log to the build agent's vault. The only page whose policy allows a connection beyond this site and Google's sign-in hosts.

*Source: <https://secrets.sgit.ai/reader/> · site v0.1.12 (2026-10-06) · this file is generated from the same content as the page, so the two cannot drift. Every page on this site has a `.md` twin; internal links below point at them.*

---

Status, from [/shipped/](/shipped/index.md): [shipped v0.1.7](/review/ui/#node=claim.site.reader-column) The reader's column on every page: mark read, star, vote, note (typed or dictated), an append-only log in this browser keyed by page and content hash, Copy for Claude and Paste to merge, the graph of what the page names · [shipped v0.1.7](/review/ui/#node=claim.site.reader-chat) A chat over the site: offline search on every page; Claude Sonnet through OpenRouter with tools that read the site and file feedback, on /reader/ with the reader's own key · [proposed](/review/ui/#node=claim.site.agent-contact) The build agent's contact file at /.well-known/sgit-agents.json and the readers lane into its comms vault, so Send to the agent reaches it

Every page has the reader's column: the log of what you marked and noted, and the graph of what the page names. Two things need a connection beyond this site, and the site's policy forbids that on every page but this one: the chat through `openrouter.ai` with your own key, and **Send to the agent**, which writes your sealed log to the build agent's vault on `dev.send.sgraph.ai`. Open the column here (the tab on the right) to do either; your log is the same one, kept in this browser.

## What this page may connect to, and why

| Host | Carries | Only when |
|---|---|---|
| `openrouter.ai` | your question, the pages the tools read for it, and your key in the request header | you have entered a key and press Send in the chat |
| `dev.send.sgraph.ai` | your log's unsent events, sealed to the agent's public key; the server stores ciphertext it cannot open | you press Send to the agent, and the agent's lane is open |

Every other page keeps the brief's exact policy, which allows this site and Google's sign-in hosts and nothing else; this page's head declares the two additions, and the gate fails if any other page does ([brief-corrections C19](/docs/design/brief-corrections.md)). How the channel works end to end, and what the project lead does once to open the lane: [docs/ops/comms.md](/docs/ops/comms.md).

## Your key

The chat uses `anthropic/claude-sonnet-5.5` through OpenRouter. Make a key with a spend limit at openrouter.ai; the column keeps it in memory for this page, or in this tab's session storage if you tick *keep for this tab*. It is never written to local storage and never sent anywhere but openrouter.ai. **Forget** drops it.

## Without a key

The chat still works as an offline search over every page, and **Copy for Claude** in the log puts your feedback on the clipboard as markdown with the JSON inside, to paste into a Claude session or into another device's column.

---

*[Site index for agents](/llms.txt) · [What is real](/docs/reality.md) · [HTML version](https://secrets.sgit.ai/reader/)*
