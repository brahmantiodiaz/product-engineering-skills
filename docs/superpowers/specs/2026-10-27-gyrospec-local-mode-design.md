# Gyrospec Local Mode: Design Spec

- **Date:** 2026-10-27
- **Status:** Draft, awaiting review
- **Extends:** `2026-10-25-gyrospec-design.md` (the main spec). Where the two disagree, this document wins for local mode.

## 1. Summary

Local mode lets the whole Gyrospec flow run inside a product repository with no platform: discovery, PRD, prototype, spec, sub-tickets, planning, and execution. Artifacts live in a `.gyro/` folder in that repository, gates are approved in chat and recorded in a file, and a bundled `gyro` script validates formats offline with `@gyrospec/format`.

The purpose is to use every Gyrospec skill now, while the platform (milestones M3 to M5) is still being built. When the platform is ready, the same `.gyro/` content is pushed to it without being rewritten.

## 2. Goals and success criteria

- One real feature runs end to end in a product repository: discovery, approved PRD, approved prototype (or not applicable), approved spec, sub-tickets, a plan, and at least one executed sub-ticket.
- The flow runs in Claude Code; at least one sub-ticket is planned and executed in Codex from the same `.gyro/` files.
- No step needs the platform, an npm registry, or a token.
- Every approval is an explicit human answer in chat, recorded with the revision and SHA-256 of the approved document.

## 3. Decisions

| Area | Decision |
|---|---|
| Ticket identity | A folder named by a slug (`.gyro/agreement-validation/`). The platform key (for example `OSS-12`) is assigned on the first push and stored in `ticket.json`; the folder keeps its slug |
| Gate approval | In chat: the skill shows a summary, asks for explicit approval, and only an explicit yes is recorded by `gyro approve`. Local approvals are records, not proof; after a push, platform gates are approved again on the platform (main spec 9.3) |
| Skill location | A separate bucket, `skills/gyrospec/`, shipped as its own plugin `gyrospec`. It is published through a separate marketplace repository, `gyrospec/marketplace`, not the fork's `mattpocock` marketplace, so the install name does not read as if Matt Pocock published Gyrospec. Upstream manifests and READMEs are not changed |
| Interview style | Rounds, using the upstream `grilling` skill as is: every question that can be answered now, numbered, each with a recommended answer |
| Format checks | A self-contained `gyro.mjs` bundled into the plugin (CLI plus `@gyrospec/format`, no dependencies), run with `node` |
| Language | As the main spec, section 4: skill files, CLI output, and code in English; replies follow the user's language; convention keywords are always English |

## 4. Local folder layout

In the product repository:

```
.gyro/
├── config.json              { "mode": "local", "formatVersion": 1 }
└── <slug>/
    ├── ticket.json          { "title", "size": "small" | "medium" | "large", "createdAt", "platformKey": null }
    ├── discovery.md         round log: facts, decisions, assumptions, open questions
    ├── prd.md
    ├── prototype.html
    ├── spec.md
    ├── gates.json
    ├── approved/            snapshots of every approved version: prd.1.md, prototype.1.html, spec.1.md, ...
    └── tickets/             sub-tickets: 01-<name>.md, 02-<name>.md, ...
```

- Slugs match `/^[a-z0-9]+(-[a-z0-9]+)*$/`, at most 60 characters.
- `formatVersion` is the version of the `.gyro/` layout: `config.json`, `ticket.json`, `gates.json`, `approved/`, and sub-ticket front matter. Once released these files are a contract with users' repositories. `gyro init` writes the version it supports (currently `1`). Every other command, and `gyro init` in a workspace that already has a `config.json`, refuses with a usage error (exit 2) when `formatVersion` is missing or differs, naming the version found: `.gyro/config.json has formatVersion 2; this gyro supports formatVersion 1. Update the gyrospec plugin`, or `.gyro/config.json has no formatVersion; this gyro supports formatVersion 1`. A change to any of those files' shapes raises the version.
- Everything under `.gyro/` is committed to git, so the trail travels with the code.
- A gate's revision number counts approvals: the first approval of a PRD is revision 1, the next is revision 2. Each approval stores its snapshot in `approved/`.

### 4.1 `gates.json`

```json
{
  "prd":       { "status": "approved", "revision": 2, "sha256": "…", "approvedAt": "2026-10-27T10:00:00Z", "quote": "approve PRD r2" },
  "prototype": { "status": "not_applicable", "reason": "Backend integration with no UI", "approvedAt": "…", "quote": "…" },
  "spec":      { "status": "draft", "revision": 0 }
}
```

`gates.json` stores what was approved. The status that skills act on is computed by `gyro status` from the files on disk (section 6), because files can be edited outside any skill.

### 4.2 Sub-ticket files

```md
---
title: Reject Product Order without an Approved Agreement
refs: [REQ-001, AC-001]
blocked_by: []
status: todo
pr: null
spec_revision: 1
---

What to build, how it is verified, and which spec sections it implements.
```

- `status` is one of `todo`, `in_progress`, `blocked`, `done`. `blocked` also carries `blocked_reason`.
- `blocked_by` lists other sub-ticket numbers (`"01"`) in the same folder.
- `spec_revision` is the approved spec revision the sub-ticket was cut from.

## 5. The `gyro` script

Source in `packages/cli` (TypeScript), depending on `@gyrospec/format` through `file:../format`. esbuild bundles it into one file, `skills/gyrospec/gyro/scripts/gyro.mjs`, which is committed. Skills run it as `node <plugin>/skills/gyrospec/gyro/scripts/gyro.mjs …`; the `gyro` skill (section 7) tells them how to find that path in each harness.

All commands run from the product repository root and read `.gyro/`.

| Command | Behavior |
|---|---|
| `gyro init <slug> --title "<title>" --size <small\|medium\|large>` | Creates `.gyro/config.json` (with `formatVersion`) if missing and the slug folder with `ticket.json` and an empty `gates.json` |
| `gyro check <slug> [prd\|prototype\|spec\|tickets]` | Validates one artifact, or all present artifacts when the kind is omitted. Spec and prototype references are checked against the current `prd.md`. Tickets: `refs` exist and are not `removed`, `blocked_by` points at existing sub-tickets, no cycles, `status` valid |
| `gyro status [slug]` | Prints, per gate: computed status, revision, and what changed; stale artifacts and sub-tickets; sub-ticket statuses; and the next suggested skill. Without a slug, a one-line summary per slug. `--json` prints the same as JSON for skills |
| `gyro approve <prd\|prototype\|spec> <slug> --quote "<user's words>"` | Records an approval (section 6.2). `--not-applicable "<reason>"` is accepted for the prototype only |
| `gyro ticket <slug> <nn> --status <status> [--reason "…"] [--pr <url>]` | Updates a sub-ticket's front matter |

Output conventions:

- Format errors are printed exactly as the server prints them: `line N: <message> [CODE]` (from `formatError`).
- Exit codes: `0` success, `1` refused (format errors, gate rules, stale), `2` usage error (unknown command, missing folder).
- Command names match the platform CLI (main spec 11). In platform mode (a later milestone, when `config.json` says so), `approve` starts the confirmation link flow and `push`/`pull` become available.

## 6. Gates, staleness, and approval rules

### 6.1 Computed status

For each gate, `gyro status` compares the current file with the last approved snapshot:

- No approval yet: `draft`.
- File SHA-256 equals the approved SHA-256: `approved` (or `not_applicable` for a prototype marked so).
- File changed since approval: `draft` again, and the REQ diff (`diffRequirements`) between the approved snapshot and the current PRD is shown.

Staleness follows main spec 8.3, computed from the latest approved PRD against the PRD that downstream items were approved with:

- The prototype is `stale` when a REQ it references with `data-req` changed in a later approved PRD revision.
- The spec is `stale` when a REQ named in an `Implements:` line changed in a later approved PRD revision.
- A sub-ticket is `stale` when a REQ in its `refs` changed, or when its `spec_revision` is older than the current approved spec and the spec sections implementing its refs changed, or when its `spec_revision` is not a recorded spec approval at all. An AC in `refs` counts under both the REQ it belonged to when the ticket was cut and its current REQ; an AC that moved to another REQ makes the ticket `stale`.
- The prototype and the spec are also `stale` when a later approved PRD revision added an active REQ they do not reference, because it was never reviewed there.
- A sub-ticket that fails the `gyro check` ticket rules against the approved PRD is `stale` and never ready.
- `gyro status` lists as `uncovered` every REQ the approved spec implements that no sub-ticket refers to, and routes to `/gyro-breakdown` until it is covered.
- Prose-only changes outside REQ/AC blocks never make anything stale.

### 6.2 What `gyro approve` refuses

1. Format errors in the artifact (the same checks as `gyro check`).
2. Gate order (main spec 8.2): the prototype needs an approved PRD; the spec needs an approved PRD and an approved or not-applicable prototype.
3. A PRD with any REQ that has `Criticality: blocker` and status `open` or `conflicted` (`findBlockers`).
4. A PRD that deleted a REQ present in the previous approved snapshot, or revived a removed one (`checkRevision`).
5. A missing or empty `--quote`.
6. Approving content identical to the current approval while that approval is current (nothing to approve). A stale prototype or spec whose unchanged content still fits after review can be approved again; its new `basedOn` points at the current upstream revisions.

On success it copies the file to `approved/<kind>.<revision>.<ext>` and updates `gates.json`.

## 7. Skills

All skills live in `skills/gyrospec/<name>/` with a `SKILL.md` and an `agents/openai.yaml`.

### 7.1 Principles

- Phase skills are user-invoked (`disable-model-invocation: true`, `policy.allow_implicit_invocation: false`). Each starts with `gyro status <slug> --json`, refuses with the reason when its prerequisites are missing, and ends by suggesting the next skill. None proceeds to the next phase on its own.
- A skill asks for approval with the gate, revision, and a short summary of what changed, then records only an explicit yes, passing the user's words as `--quote`. Silence, "looks fine overall", or the agent's own recommendation are not approvals.
- Skills reuse upstream model-invoked skills through the Skill tool: `grilling`, `prototype`, `tdd`, `code-review`, `domain-modeling`.
- Skills reply in the user's language and keep convention keywords in English.

### 7.2 Skill list

| Skill | Invoked by | Prerequisites | Behavior | Done when |
|---|---|---|---|---|
| `gyro` | model | none | Shared reference: the `.gyro/` layout, the format conventions (main spec 7), how to locate and run `gyro.mjs` in Claude Code and Codex, and the approval etiquette above. Phase skills call it with the Skill tool | n/a |
| `/gyro-discovery` | user | none | Asks for title, slug, and size, runs `gyro init`, then interviews in rounds with `grilling`, covering the dimensions required for the size (main spec 10.3). Problem & Outcome requires exactly one core objective, its success metrics, and the current baseline of each metric; an unknown baseline is an open question whose blocking status the user confirms. Every answer is logged in `discovery.md` as fact, decision, assumption, or open question. The user confirms which open questions are blockers | No blocker is open or conflicted; the user agrees discovery is complete. Discovery has no gate |
| `/gyro-prd` | user | Discovery complete | Writes `prd.md` from `discovery.md` only, adding no requirement that is not there. Template: `## Objective` (one core objective, one sentence), `## Success Metrics` (Metric, Baseline, Target table), `## User Journey` (process flow, Mermaid allowed), `## Scope`, then REQ blocks whose statements are user stories (`Given I am a <persona>` / `And I am on <place>` / `And <past context>` / `Then <outcome>`) and whose ACs are one line each, scenario- or rule-oriented, with negative scenarios as separate ACs. Wireframes belong to the prototype. Runs `gyro check`; summarizes; asks for approval. The REQ/AC format and `gyro check` are unchanged by this template | PRD approved |
| `/gyro-prototype` | user | PRD approved | Calls `prototype` for one HTML file with `data-screen` and `data-req` (main spec 7.3); `gyro check` reports uncovered REQs; asks for approval, or for `--not-applicable` with a reason when the feature has no UI | Prototype approved or not applicable |
| `/gyro-spec` | user | PRD approved; prototype approved or not applicable | Superpowers-style design doc (architecture, components, data flow, error handling, testing) with `**Implements:**` in each section; `gyro check`; asks for approval | Spec approved |
| `/gyro-breakdown` | user | Spec approved | Adapts upstream `to-tickets`: tracer-bullet sub-tickets in `tickets/` with `refs`, `blocked_by`, and `spec_revision`; `gyro check <slug> tickets` | Sub-tickets written and valid. No gate |
| `/gyro-writing-plans` | user | The named sub-ticket exists and is not stale | Adapts Superpowers `writing-plans`: a plan in `docs/superpowers/plans/<date>-<slug>-<nn>.md` whose header names `ticket` (slug), `sub_ticket`, and `spec_revision`; every task cites the REQ/AC it serves | Plan written |
| `/gyro-executing-plans` | user | A plan exists; its `spec_revision` is current; the sub-ticket is not stale | Adapts Superpowers `executing-plans`: sets the sub-ticket `in_progress`, works the tasks with `tdd` and `code-review`, rechecks every prerequisite (including that no gate fell back to `draft`) after interruptions and right before completion, sets `done --pr <url>` after verification, or `blocked --reason` when a human is needed | Sub-ticket done |

### 7.3 Packaging

- The fork's `.claude-plugin/marketplace.json` (marketplace `mattpocock`) is not changed. The `mattpocock-skills` plugin and its `plugin.json` are unchanged.
- A separate repository `gyrospec/marketplace` holds `.claude-plugin/marketplace.json` with marketplace name `gyrospec`, owner Gyrospec, and two plugins: `gyrospec` with source `{ "source": "git-subdir", "url": "https://github.com/gyrospec/skills.git", "path": "skills/gyrospec" }`, and `mattpocock-skills` with source `{ "source": "github", "repo": "gyrospec/skills" }` (the upstream skills the phases call). Creating that repository is a release step the user performs or approves.
- `skills/gyrospec/README.md` lists the skills, split into user-invoked and model-invoked, and explains installation: `/plugin marketplace add gyrospec/marketplace`, then install `gyrospec@gyrospec` and `mattpocock-skills@gyrospec`.
- The upstream rules in `CLAUDE.md` about promoted buckets do not apply to `skills/gyrospec/`; a short note in `CLAUDE.md` says so, so upstream conventions stay intact for Matt's buckets.
- Attribution (main spec 17) ships inside the plugin, because a `git-subdir` install and a Codex folder copy carry nothing from the repository root: `skills/gyrospec/THIRD_PARTY_NOTICES.md` for the adapted mattpocock/skills and Superpowers skills, a `NOTICE.md` in each adapted skill folder (`gyro-breakdown`, `gyro-writing-plans`, `gyro-executing-plans`), and `skills/gyrospec/gyro/scripts/THIRD_PARTY_LICENSES.txt`, generated by the bundle script, with the license of every third-party package whose code is in `gyro.mjs`. The root `THIRD_PARTY_NOTICES.md` points at these.

## 8. Error handling

| Situation | Behavior |
|---|---|
| `node` missing or older than 20 | The `gyro` skill tells the user to install Node 20 or later; no phase skill proceeds |
| `.gyro/<slug>` missing | `gyro` exits 2 with "No Gyrospec ticket named <slug>. Run /gyro-discovery first" |
| `gyro init` run outside the repository root (no `.git` folder or worktree file in the current folder) | Exits 2 naming the repository root and `/gyro-discovery`, and creates nothing |
| `.gyro/config.json` with a missing or different `formatVersion` | Exits 2 naming the version found and the supported one (section 4) |
| Skill prerequisites not met | The skill names the missing gate or the stale item and the skill that fixes it, then stops |
| Artifact edited by hand after approval | `gyro status` shows the gate as draft with the REQ diff; downstream skills refuse until it is re-approved |
| Two `gyro approve` or `gyro ticket` processes on one ticket at the same time | Each takes `.gyro/<slug>/.lock` exclusively; the second is refused naming the lock. Snapshots are never overwritten and JSON is written atomically |
| Two branches change the same `.gyro/` files | Ordinary git merge conflicts; after resolving, `gyro status` recomputes everything from the files |

## 9. Testing

1. **CLI unit tests** (`packages/cli`, Vitest) against temporary folders: `init`, `check` for every kind, every refusal in 6.2, computed status and staleness (including prose-only changes), `ticket` updates, `blocked_by` cycles, exit codes, and `--json` output.
2. **Bundle tests:** the committed `gyro.mjs` reports the same version as `packages/cli/package.json`, and running it on a fixture folder gives the same output as the unbundled CLI.
3. **Manual acceptance:** one toy feature run end to end in Claude Code following section 2, and one sub-ticket planned and executed in Codex from the same files. Results are written into the implementation plan's ledger.

## 10. Out of scope

- Platform mode: `login`, `push`, `pull`, and confirmation-link approvals (main spec M3, M4).
- Prototype hosting and preview (main spec M5); the prototype is opened locally from `prototype.html`.
- Automated skill-behavior evals (main spec 13 item 5).
- Constraint kept for later: `.gyro/` content must be pushable to the platform without rewriting it.
