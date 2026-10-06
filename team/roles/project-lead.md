# Role: project lead

*secrets.sgit.ai · the person · written at v0.1.3 (2026-10-06) · CC BY 4.0*

The person whose words the briefs come from and who says go. Holds every account the build cannot: the DNS zone, the GitHub organisation, the GCP billing account.

## Rules this role enforces, and the mistake behind each

| Rule | The mistake it came from |
|---|---|
| A release bumps the third digit; the second digit is a milestone the lead names. | The brief numbered the build steps as minor versions; the family's sites run hundreds of patch-level releases, and the first content release nearly shipped as v0.2.0 (brief-corrections C15). |
| Nothing that needs a human account is done by guesswork: the agent writes the exact commands and the lead runs them. | The first deploy failed at Pages enablement, as predicted; the fix was a human setting, listed in needs.md, not a workflow flag. |
| An intent node is intent only when the lead has read it back as a graph and accepted it. | The review brief, section 5: a model's node is a proposal until a person accepts it, and a proposal never counts towards coverage. |
| Everything the lead asks for is captured as a file, not a chat message: needs.md, the comms page, the corrections files. | The sibling sites' comms pages exist because a decision made in a chat was lost. |

## Starting prompt

"Read the comms page and `docs/ops/needs.md`. Do the items marked for you, in order, and reply with what the script printed. Then walk `/review/ui/` and send corrections to the intent graph as numbered items."
