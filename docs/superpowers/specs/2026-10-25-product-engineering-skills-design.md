# Product Engineering Skills (PES): Design Spec

- **Date:** 2026-10-25
- **Status:** Approved
- **Scope:** Skills fork (mattpocock/skills), the `@pes/format` package, the `pes` CLI, and the PES SaaS platform

---

## 1. Summary

PES is a **human-driven** product engineering framework for coding agents (Claude Code and Codex). The flow is: discovery, PRD, clickable HTML prototype, spec, sub-tickets, then local planning and execution.

The system has two sides:

1. **Client side (open source, MIT):** a fork of `mattpocock/skills` containing the PES skills, the `@pes/format` package, and the `pes` CLI.
2. **SaaS platform (private):** the source of truth for PRDs, prototypes, specs, tickets, sub-tickets, and approvals. The web app is used to view, edit, comment, approve, and preview prototypes.

Plans and tasks are created and executed locally by the agent, using PES skills or Superpowers. The platform stores neither plans nor tasks. The only data sent back is sub-ticket status and PR links.

## 2. Principles

1. **Human-driven.** The AI explores, proposes, and drafts. A human decides when a phase may proceed.
2. **Approval by humans only.** Tokens held by an agent never carry approval rights.
3. **One source for format rules.** The ID parser and validator live only in `@pes/format` and are used by the CLI, the server, and the web editor.
4. **Readable by agents and humans.** Every artifact is plain markdown (prototypes are HTML).
5. **No silent changes after approval.** Approval is bound to a revision, and requirement changes mark downstream artifacts as stale.

## 3. Locked decisions

| Area | Decision |
|---|---|
| Skills foundation | Fork `mattpocock/skills`; new skills live in their own folder, `skills/pes/` |
| Platform | Built in-house (Plane is not forked). Plane is a UX reference only; no code is copied |
| Source of truth | Platform: PRD, prototype, spec, ticket, sub-ticket, approval |
| Local | Agent-owned plans and tasks. Not synced to the platform |
| Artifact authors | Agents (push via CLI) and humans (markdown editor on the web) |
| Format | Markdown with ID conventions (`REQ-`, `AC-`); prototypes use `data-req` |
| Conflicts | Optimistic revision (`base_revision`); a push based on a stale revision is rejected |
| Business model | Multi-tenant SaaS, free/beta, no billing (the schema already carries `plan` and usage limits) |
| CLI login | OAuth Device Authorization Flow (RFC 8628), implemented by the platform |
| Approval | On the web, or started from the CLI and confirmed with one click on a web page |
| Gates | Three: PRD, Prototype, Spec. Sub-tickets have no gate |
| Prototype | One HTML file with multiple screens (hash routing), inline CSS/JS, `data-req` annotations |
| Feedback from local | Sub-ticket status and PR link only |
| Stack | TypeScript throughout: Next.js, Postgres (RLS), object storage, Node CLI (npm) |
| MVP harnesses | Claude Code and Codex |
| Language | See section 4 |

## 4. Language rules

| Part | Language |
|---|---|
| `SKILL.md` content, docs, README, design specs, CLI and validator messages, code and comments | English |
| Conversation with the user | Follows the user's language |
| PRD and spec prose | Follows the user's language or the workspace setting |
| Convention keywords: `REQ-`, `AC-`, `**Status:**`, `**Criticality:**`, `**Implements:**`, and their allowed values (`decided`, `blocker`, and so on) | **Always English**, regardless of the document's language |

The `@pes/format` parser recognizes only these fixed English keywords. A PRD written in Indonesian still writes `**Status:** decided`, never a translated value. Skills instruct the agent to reply in the user's language while keeping the keywords unchanged.

## 5. Architecture

### 5.1 Repositories

```
1. product-engineering-skills      fork of mattpocock/skills, public, MIT
   ├── skills/…                    upstream skills (changed as little as possible)
   ├── skills/pes/…                PES skills
   ├── packages/format/            @pes/format
   ├── packages/cli/               @pes/cli (the `pes` command)
   └── THIRD_PARTY_NOTICES.md      attribution for mattpocock/skills and Superpowers

2. pes-platform                    private
   └── apps/web/                   Next.js (UI + API), depends on @pes/format from npm
```

New skills go in `skills/pes/` and changes to upstream skills are kept minimal, so merges from upstream rarely conflict.

### 5.2 Components

| Component | Responsibility | Depends on |
|---|---|---|
| PES skills | Guide each phase and call the CLI | CLI, upstream skills (`grilling`, `domain-modeling`, `prototype`, `to-tickets`, `tdd`, `code-review`) |
| `@pes/format` | Parse PRD/spec into a REQ/AC index, validate IDs, diff per requirement, read `data-req` from prototypes | none |
| `pes` CLI | Auth, artifact push/pull, approval, status updates | `@pes/format`, platform API |
| Platform web/API | Workspaces, members, tickets, artifacts and revisions, editor, comments, approvals, sub-ticket status | `@pes/format`, Postgres, object storage, auth provider |
| Postgres + RLS | Storage; tenant isolation enforced in the database | none |
| Object storage + usercontent domain | Store prototypes and serve them from a separate origin | none |

The `setup-matt-pocock-skills` skill gets a new tracker option, **"PES Platform"**, so upstream skills such as `to-tickets` can publish to the platform.

### 5.3 End-to-end flow

```
[local] /pes-discovery (chat) → /pes-prd → pes push prd ──────────► Ticket: PRD draft
                                   pes approve prd → click ───────► PRD approved
[local] /pes-prototype → pes push prototype ──────────────────────► Prototype draft
                                   pes approve prototype → click ─► Prototype approved
[local] /pes-spec → pes push spec ────────────────────────────────► Spec draft
                                   pes approve spec → click ──────► Spec approved
[local] /pes-breakdown → pes push subtickets ─────────────────────► Sub-tickets PROJ-12.1..n

[dev agent] /pes-writing-plans PROJ-12.3
   → pes pull → docs/superpowers/specs/<date>-proj-12-3-design.md
   → plan in docs/superpowers/plans/
[dev agent] /pes-executing-plans
   → pes ticket update PROJ-12.3 --status in_progress
   → tasks executed (tdd, code-review)
   → pes ticket update PROJ-12.3 --status done --pr <url> ──────► Sub-ticket status
```

## 6. Data model

```
Workspace (plan, limits)
├─ Member (user, role: owner | admin | editor | viewer)
├─ CliSession (user, hostname, scopes, refresh_token_hash, last_used_at, revoked_at)
└─ Project (key: PROJ)
   └─ Ticket (key: PROJ-12, title)
      ├─ Artifact (kind: prd | prototype | spec, gate_status, current_revision)
      │  └─ Revision (n, sha256, base_revision, content_ref, author_user, via: web | cli,
      │               req_index (parse result), created_at)
      ├─ Approval (artifact, revision, sha256, user, via: web | cli-link, created_at)
      ├─ SubTicket (key: PROJ-12.3, title, body, spec_revision, refs: [REQ/AC],
      │             blocked_by: [SubTicket], status, pr_url, stale)
      └─ Comment (author, anchor: {revision, req_id | line_range | prototype_screen}, body)
ApprovalRequest (artifact, revision, sha256, created_by_cli_session, expires_at, consumed_at)
```

- Every table stores `workspace_id`.
- Revision content is stored in object storage (`content_ref`). Metadata and `req_index` are stored in Postgres.

## 7. Formats and conventions

### 7.1 PRD

```md
### REQ-001 Agreement required before Product Order
A Product Order can only be created when the Agreement status is Approved.
**Status:** decided · **Criticality:** blocker

- [AC-001] Given a Draft Agreement, when the user creates a Product Order, then it is rejected with message …
- [AC-002] Given an Approved Agreement, when …, then …
```

- Allowed `Status` values: `proposed`, `decided`, `verified`, `open`, `conflicted`, `not-applicable`, `removed`.
- Allowed `Criticality` values: `blocker`, `major`, `minor`.

### 7.2 Spec

Specs follow the Superpowers design doc style: architecture, components, data flow, error handling, testing. Every section that implements requirements contains the line:

```md
**Implements:** REQ-001, REQ-003
```

### 7.3 Prototype

A prototype is one HTML file. Screens are separated by hash routing (`#/screen-name`), and elements representing requirements are marked `data-req="REQ-001"`. One element may represent several requirements (`data-req="REQ-001 REQ-004"`).

### 7.4 ID rules

These rules are enforced by `@pes/format`, both in the CLI before a push and on the server on save.

1. IDs are scoped per ticket.
2. IDs are never renumbered or reused. A deleted requirement gets status `removed` and stays in the document.
3. Rejected when any of these occur:
   - duplicate IDs;
   - an `AC-` outside a `REQ-` block;
   - an `Implements` or `data-req` that references an ID that does not exist or has status `removed`;
   - an unknown status or criticality value.
4. Error messages include line numbers, and their text is identical in the CLI and on the server.

## 8. Gates, status, and staleness

### 8.1 Statuses

| Object | Statuses |
|---|---|
| Artifact gate | `draft`, `approved`, `stale`, `not_applicable` |
| Sub-ticket | `todo`, `in_progress`, `blocked`, `done` |

### 8.2 Gate rules

1. A prototype can only be approved when the current PRD revision is `approved`.
2. A spec can only be approved when the PRD is `approved` and the prototype is `approved` or `not_applicable`.
3. Sub-tickets can only be created from an `approved` spec, and record their source `spec_revision`.
4. A PRD cannot be approved while any REQ with `Criticality: blocker` has status `open` or `conflicted`.
5. A prototype may be marked `not_applicable` (for features without UI) only by a human, with a mandatory reason, through the same approval path.

### 8.3 Stale propagation

When an `approved` artifact receives a new revision:

1. That artifact's gate returns to `draft` and needs re-approval.
2. `@pes/format` computes which REQ IDs were added, changed, or removed between the last approved revision and the new one.
3. Downstream items referencing those IDs are marked stale:
   - PRD change: the prototype gate becomes `stale` if any screen has a matching `data-req` (those screens are highlighted on the platform), the spec gate becomes `stale` if any section has a matching `Implements` (those sections are highlighted), and sub-tickets with matching `refs` get the `stale` flag.
   - Spec change: sub-tickets created from an earlier spec revision that reference REQs whose `Implements` sections changed get the `stale` flag.
4. A revision that only changes text outside REQ/AC blocks still needs re-approval but does **not** make downstream items stale.
5. `stale` clears once the downstream item is revised and re-approved. For sub-tickets, it clears when a human marks it as reviewed.

## 9. Auth and security

### 9.1 Web login

Web login uses a managed auth provider with Google, GitHub, and email magic links. The specific provider is chosen during M2 planning.

### 9.2 Device flow for the CLI

Device flow (RFC 8628) is implemented by the platform itself.

1. `pes login` requests a `device_code` and `user_code`.
2. The CLI shows the verification URL with the code and opens the browser.
3. On the web (already signed in), the user sees "pes CLI on `<hostname>` requests access to workspace X" and clicks **Allow**.
4. The CLI polls until it receives an access token (1 hour) and a refresh token (30 days, rotated on every use).
5. Tokens are stored in the OS keychain. When no keychain is available, they are stored in `~/.config/pes/credentials.json` with permission 0600.

- **CLI token scopes:** `read`, `write:artifacts`, `write:status`, `comment`. The `approve` scope is **never** granted to CLI tokens.
- CLI sessions can be listed and revoked on the web.

### 9.3 Approval started from the CLI

1. `pes approve <gate> <ticket>` creates an `ApprovalRequest` bound to the current revision and sha256, expiring in 10 minutes.
2. The CLI prints a summary (gate, revision, REQ diff since the last approval, blockers) and opens `/approve/<id>`.
3. The web page shows the same summary with **Approve** and **Reject** buttons. The page requires an active web session and CSRF protection.
4. On click, the server re-checks:
   - the revision is still current;
   - the sha256 matches;
   - the gate rules in 8.2 hold;
   - the user has role `editor` or higher.
5. The approval is recorded with `via: cli-link`. The link is single-use.
6. The CLI receives the result by polling.

### 9.4 Tenant isolation

- Every API request sets `app.workspace_id` in its transaction.
- Every table has an RLS policy on `workspace_id`.
- Membership is checked before `app.workspace_id` is set.

### 9.5 Prototype sandbox

- Prototypes are served from a separate registrable domain, for example `*.pes-usercontent.com`, with one subdomain per workspace. This domain is not a subdomain of the app domain.
- Prototypes render in `<iframe sandbox="allow-scripts">` without `allow-same-origin`.
- CSP:
  - `connect-src 'none'`;
  - scripts and styles only inline or from an allowlist of CDNs;
  - `form-action 'none'`.
- For private workspaces, files are served through short-lived signed URLs.

### 9.6 Roles

| Role | Rights |
|---|---|
| owner | Everything, including deleting the workspace |
| admin | Manage members and settings, plus all editor rights |
| editor | Create and edit tickets and artifacts, approve, manage sub-tickets |
| viewer | Read and comment |

Members are invited by invite link. The MVP does not send email.

### 9.7 Known limitations

An agent with a browser tool using the user's signed-in session (for example Claude in Chrome) can technically open an approval link and click Approve. The MVP accepts this risk.

Post-MVP mitigation: confirm approvals with a passkey (WebAuthn with user verification).

## 10. Skills

### 10.1 Principles

- Every phase is a **user-invoked** skill that ends by suggesting the next command, never proceeding on its own. This matches the upstream rule that a user-invoked skill never invokes another user-invoked skill, and it keeps the flow human-driven.
- PES skills reuse the upstream model-invoked skills `grilling`, `domain-modeling`, `tdd`, and `code-review`.
- Every skill checks its prerequisites via `pes status` before doing any work.
- Every skill name has the `pes-` prefix so it does not clash with Superpowers.
- Skills follow the language rules in section 4.

### 10.2 Skill list

| Skill | Prerequisites | Behavior | Output |
|---|---|---|---|
| `/pes-discovery` | none | Interview using `grilling`, one question per turn. At the start, the user picks a feature size (10.3). Every answer is classified as fact, decision, assumption, or open question. The user confirms criticality. AI recommendations are never treated as decisions | `.pes/<ticket>/discovery.md` |
| `/pes-prd` | Discovery with no `blocker` REQ that is `open`/`conflicted` | Writes the PRD per 7.1, then runs `pes check` and `pes push prd`. The ticket is created if it does not exist. Adds no requirement that is not in discovery | PRD draft |
| `/pes-prototype` | PRD approved | Adapts the upstream `prototype` skill: one HTML with multiple screens and `data-req`, plus a report of REQs without a screen | Prototype draft |
| `/pes-spec` | PRD approved; prototype approved or N/A | Superpowers-style design doc with `Implements:` in each section | Spec draft |
| `/pes-breakdown` | Spec approved | Adapts `to-tickets`: tracer-bullet sub-tickets with `refs` and `blocked_by` | Sub-tickets |
| `/pes-writing-plans <sub>` | Sub-ticket exists | Adapts Superpowers `writing-plans`. Runs `pes pull`, writes the spec to `docs/superpowers/specs/`, then writes the plan to `docs/superpowers/plans/` with a `ticket`, `sub_ticket`, `spec_revision` header. Every task references REQ/AC | Local plan |
| `/pes-executing-plans` | Plan exists; `spec_revision` is still current and the sub-ticket is not stale | Adapts Superpowers `executing-plans`. Updates status automatically: `in_progress` on start, `blocked` with a reason when a human is needed, and `done` with a PR link after verification | Code, PR, sub-ticket status |

Agents using plain Superpowers `writing-plans` or `executing-plans` can still work from `pes pull` output and update status manually through the CLI.

### 10.3 Discovery size

There are 10 discovery dimensions:
1. Problem & Outcome
2. Personas & Authorization
3. Scope & Boundaries
4. User Journey
5. Business Rules
6. Data & Integrations
7. Failure & Recovery
8. Acceptance Criteria
9. Constraints & Dependencies
10. Rollout & Migration

| Size | Required dimensions |
|---|---|
| Small | Problem & Outcome, Scope & Boundaries, Business Rules, Acceptance Criteria |
| Medium | Small, plus Personas & Authorization, User Journey, Data & Integrations, Failure & Recovery |
| Large | All 10 dimensions |

- Non-required dimensions may be skipped.
- A required dimension may be marked `not-applicable`, with a reason.

### 10.4 Local `.pes/` folder

```
.pes/
├── config.json          workspace + project (committed)
└── <ticket>/
    ├── discovery.md     discovery log (committed)
    └── cache/           pull results + revisions (gitignored)
```

### 10.5 Edits from both sides

1. When `pes push` is rejected because of a stale revision (409), the skill runs `pes pull`.
2. The skill merges the changes and shows the user the diff.
3. After the user accepts the merged result, the skill pushes again.

## 11. CLI command reference (MVP)

| Command | Purpose |
|---|---|
| `pes login` / `pes logout` | Device flow / revoke the session |
| `pes init` | Create `.pes/config.json` (pick workspace and project) |
| `pes check <file>` | Validate format locally |
| `pes push prd\|prototype\|spec <ticket> [file]` | Upload a new revision (with `base_revision`) |
| `pes push subtickets <ticket> <file>` | Create or update sub-tickets in one batch |
| `pes pull <ticket\|sub-ticket>` | Download artifacts. For a sub-ticket, also writes a Superpowers-style spec file |
| `pes status [ticket]` | Gate status, staleness, and sub-tickets |
| `pes approve <gate> <ticket>` | Start an approval via a confirmation link |
| `pes ticket update <sub> --status … [--reason …] [--pr …]` | Update sub-ticket status |

## 12. Error handling

| Situation | Behavior |
|---|---|
| Offline or network failure | The push fails with a clear message, with no silent queue. Every push carries a request ID so it is safe to retry |
| Expired access token | Refreshed automatically. If refresh fails, the CLI asks for `pes login` |
| Stale revision | 409 with the latest revision, then the flow in 10.5 |
| Invalid format | 422 with per-line errors, identical to `pes check` output |
| ApprovalRequest expired or revision changed | Rejected with the reason. The user re-runs `pes approve` |
| Gate rules not met | Rejected with the list of missing prerequisites or blockers |
| Stale sub-ticket during execution | `pes-executing-plans` stops and asks for the plan to be reviewed. Updating to `done` is still allowed, with a warning |
| Prototype exceeds size limit | Rejected (default 5 MB per file) |
| Cross-workspace access | 404, so resource existence does not leak |

## 13. Testing

1. **`@pes/format`:** unit tests plus golden fixtures (markdown input to index, errors, diff) shared by the CLI and server test suites.
2. **API (integration, real Postgres):**
   - cross-tenant isolation;
   - gate order;
   - PRD blockers;
   - stale propagation, including prose-only changes;
   - optimistic revision;
   - ApprovalRequest flow (expiry, single use, revision changed);
   - device flow and token scopes (a CLI token cannot approve).
3. **CLI end-to-end:** against a local platform (docker compose).
4. **Prototype security:** a prototype cannot read app cookies, fetch, or submit forms.
5. **Skill behavior evals:** scenario-based, each scenario run several times. Scenarios:
   - one question per turn;
   - refusing to write a PRD while an open blocker remains;
   - not inventing rules when the user answers "I don't know";
   - never claiming approval without server confirmation;
   - status updates at the start and end of execution;
   - stopping when a sub-ticket is stale;
   - replying in the user's language while keeping convention keywords in English.

## 14. MVP scope

### 14.1 Included

Everything described in sections 4 to 13.

### 14.2 Out of MVP

- Billing
- Passkey approval
- Real-time collaboration
- Syncing plan tasks to the platform
- Single-binary CLI
- OMP adapter
- Jira/GitHub Issues integration
- Email notifications

## 15. Milestones

Each milestone gets its own implementation plan.

| # | Milestone | Content |
|---|---|---|
| M1 | `@pes/format` | Conventions, PRD/spec/prototype parsers, validator, REQ diff, golden fixtures |
| M2 | Platform core | Web login, workspaces/members/roles/invites, projects, tickets, artifacts and revisions, markdown editor, comments, RLS |
| M3 | CLI | `login`, `init`, `check`, `push`, `pull`, `status` |
| M4 | Gates and approvals | Web approval, CLI ApprovalRequest, gate rules, stale propagation |
| M5 | Prototype hosting | Object storage, usercontent domain, sandbox, CSP, signed URLs |
| M6 | Product-phase skills | Fork setup, `pes-discovery`, `pes-prd`, `pes-prototype`, `pes-spec`, `pes-breakdown`, tracker option in setup |
| M7 | Sub-tickets and execution | Sub-tickets with `blocked_by`, `pes ticket update`, `pes-writing-plans`, `pes-executing-plans` |

## 16. MVP success criteria

One real OSS/BSS feature runs from discovery to PR, where:

- human approval is recorded at all three gates;
- sub-tickets are executed by an agent with status updated automatically;
- the flow runs in Claude Code and Codex without losing context (decisions and artifacts are read from `.pes/` and the platform, not from chat history).

## 17. Licensing and attribution

- `mattpocock/skills` is MIT licensed, and Superpowers is MIT licensed. Both are re-verified during the M6 fork work.
- Attribution for both is recorded in `THIRD_PARTY_NOTICES.md`.
- The platform uses no Plane code (AGPL-3.0).

## 18. Decisions deferred to planning

| Decision | Milestone |
|---|---|
| Web auth provider | M2 |
| Hosting, Postgres, and object storage providers | M2 |
| App domain and usercontent domain names | M2 / M5 |
| CDN allowlist for prototype CSP | M5 |
| Web markdown editor library | M2 |
