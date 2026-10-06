# The team

*secrets.sgit.ai · who does what, as files · written at v0.1.3 (2026-10-06) · in the shape of the sgit.ai team section · CC BY 4.0*

Two roles fill every seat at this stage: a person and an agent. Each role is one file with the rules it enforces and the mistake behind each rule, so that a new agent can read the team page and one role and begin. The board of work is `data/steps.json` (the nine build steps of the MVP brief and the ten of the review brief), rendered on the comms page, and `docs/ops/needs.md` (the asks back to the person). Neither lives in a vault yet; if the board outgrows a file, it moves to a vault of its own and this page says where.

| Role | Held by | Decides |
|---|---|---|
| [Project lead](roles/project-lead.md) | Dinis Cruz | What ships next, what the brief means where it is ambiguous, whether an intent node is accepted, everything that needs a human account (DNS, billing, GCP, GitHub settings) |
| [Build agent](roles/build-agent.md) | A Claude Code session, one at a time | Everything else, within the rules its role file lists, recording each departure from the brief in the corrections files |

Other teams review the work and the review is published with the reply: the first is the sgit.ai site team's review brief, answered in `review/BRIEF-CORRECTIONS.md`.
