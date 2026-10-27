---
name: gyro
description: "Shared reference for Gyrospec skills: the .gyro folder, the PRD/spec/prototype format conventions, running the gyro script, and how approvals are asked for and recorded. Use when a Gyrospec skill needs it, or when the user asks about Gyrospec files or approvals."
---

# Gyrospec reference

Reply in the user's language. Keep convention keywords, allowed values, and CLI commands in English, even when PRD and spec prose use another language.

## Run the offline script

Check `node --version` first. If Node is missing or its major version is below 20, tell the user to install Node 20+ and stop. No npm installation, network, token, or platform is needed to run this bundle.

Resolve this skill's actual directory from the loaded skill location in Claude Code or Codex. From the product repository root run:

```text
node <this skill's directory>/scripts/gyro.mjs <command>
```

Phase skills use `node <their own skill directory>/../gyro/scripts/gyro.mjs <command>`. Quote the resolved script path if it contains spaces. In the command examples below, `gyro` means that full Node invocation. Do not assume a globally installed binary or use the plugin checkout as the product repository.

```text
gyro init <slug> --title "<title>" --size <small|medium|large>
gyro status <slug> --json
gyro check <slug> [prd|prototype|spec|tickets]
gyro approve <prd|prototype|spec> <slug> --quote "<user's words>"
gyro approve prototype <slug> --not-applicable "<reason>" --quote "<user's words>"
gyro ticket <slug> <nn> --status <todo|in_progress|blocked|done> [--reason "<why>"] [--pr <url>]
```

Exit 0 means success, 1 means refused, and 2 means usage error. Show refusal lines verbatim and fix the cause. Format errors retain `line N: <message> [CODE]` exactly.

## Local files

Everything under `.gyro/` belongs in the product repository's git history. Commit only when the user's working instructions authorize it.

```text
.gyro/
  config.json                 { "mode": "local", "formatVersion": 1 }
  <slug>/
    ticket.json               title, size, createdAt, platformKey: null
    discovery.md              Facts, Decisions, Assumptions, Open questions
    prd.md
    prototype.html
    spec.md
    gates.json                approval records, history, and basedOn revisions
    approved/
      prd.1.md                immutable approval snapshots
      prototype.1.html
      spec.1.md
    tickets/
      01-<name>.md
```

`formatVersion` is the `.gyro/` layout version. When `gyro` refuses a workspace because its `formatVersion` is newer or unknown, tell the user to update the gyrospec plugin; never edit `config.json` to get past it.

Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$` and have at most 60 characters. Sizes are `small`, `medium`, or `large`. `platformKey` remains null in local mode.

## Formats

A PRD opens with `## Objective` (one core objective), `## Success Metrics` (a Metric | Baseline | Target table), `## User Journey`, and `## Scope`; `/gyro-prd` holds the full template. Then the requirement blocks, each statement written as a user story:

```markdown
### REQ-001 Agreement required before Product Order
Given I am a sales admin
And I am on the Product Order form
And the customer's Agreement is still Draft
Then I cannot create the Product Order
**Status:** decided · **Criticality:** blocker

- [AC-001] Given a Draft Agreement, when I create a Product Order, then it is rejected with the reason shown
- [AC-002] Given an Approved Agreement, when I create a Product Order, then it is created
```

Allowed Status values: `proposed`, `decided`, `verified`, `open`, `conflicted`, `not-applicable`, `removed`. Allowed Criticality values: `blocker`, `major`, `minor`. IDs are scoped to the ticket. Never renumber or reuse an ID. Retain deleted requirements as blocks with `**Status:** removed`. AC IDs belong inside their requirement's block. Do not invent decisions to close an open question. An `open` or `conflicted` blocker prevents approval.

Specs cover architecture, components, data flow, error handling, and testing. Every implementing section has a line such as `**Implements:** REQ-001, REQ-003`.

A prototype is one self-contained HTML file with inline assets, hash routes such as `#/orders`, one unique `data-screen="orders"` wrapper per screen, and `data-req="REQ-001 REQ-003"` on elements representing requirements. Screen names match routes. References must exist and cannot point to removed requirements. Review `Uncovered requirements` notes with the human.

Sub-ticket example:

```markdown
---
title: Reject Product Order without an Approved Agreement
refs: [REQ-001, AC-001]
blocked_by: []
status: todo
pr: null
spec_revision: 1
---

Describe the complete behavior, verification, and implementing spec sections.
```

Statuses: `todo`, `in_progress`, `blocked`, `done`. A blocked ticket also has `blocked_reason`. `blocked_by` contains ticket numbers such as `01`. `spec_revision` is the approved source revision. Keep numbers when reviewing stale tickets; update their source revision only after reviewing their refs and body against the current approved spec.

## Status and approvals

`gyro approve` and `gyro ticket` hold `.gyro/<slug>/.lock` while they write. If one refuses because the lock exists, check that no other gyro command is running before deleting it, and never commit a `.lock` file.

Run `gyro status <slug> --json` before every phase. Respect `next`; show missing prerequisites or stale causes and suggest the fixing skill, then stop. Each phase is human-invoked. Suggest the next phase without invoking it. Never edit `gates.json` or `approved/` by hand. Current artifact edits require reapproval; staleness is computed from approved snapshots and referenced requirements or implementing spec sections. Prose-only PRD changes need reapproval but do not stale downstream items.

Before approval, show the gate, next approval revision (current revision plus one), a summary of changes, REQ diff from `gyro status`, and any blockers. For a prototype without UI, obtain a nonempty reason and show it in the summary. Ask a direct yes/no approval question. Only after an explicit yes run `gyro approve <gate> <slug> --quote "<the user's words>"`, adding `--not-applicable "<reason>"` for that prototype branch. Pass the actual answer as one argument using the shell's safe quoting rules. Silence, partial praise such as "looks fine overall", and your own recommendation are never approval. If the answer is ambiguous, ask for explicit approval and wait.

After the command succeeds, verify status. If it refuses, show its lines verbatim, fix the cause, and ask again when the approved content or summary changes. Local approvals are records, not proof of a human identity; platform mode will require new approvals on the platform.
