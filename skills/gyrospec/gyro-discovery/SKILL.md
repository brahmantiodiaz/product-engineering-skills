---
name: gyro-discovery
description: Interview in rounds and record a feature's facts, decisions, assumptions, and open questions.
disable-model-invocation: true
---

# Discovery

1. Call the Skill tool with "gyro". Use its script resolution, Node 20+ check, language rules, and approval etiquette throughout. Reply in the user's language and keep convention keywords English.
2. If a slug is supplied, run `gyro status <slug> --json` before work. Resume its discovery log if the ticket exists. If no slug is given, run `gyro status --json` to inspect existing tickets, then ask for missing title, slug, and size. A missing workspace or new slug gives exit 2 naming `/gyro-discovery`; this is expected during first discovery: confirm the product repository root and missing inputs, run `gyro init <slug> --title "<title>" --size <size>`, then run `gyro status <slug> --json`. Do not overwrite an existing ticket or restart a completed phase automatically. If `next` points past discovery, explain the current state and limit any requested discovery revision to the user's scope.
3. Read any existing `.gyro/<slug>/discovery.md` and the repository glossary to preserve context across sessions. When domain terms are ambiguous, Call the Skill tool with "domain-modeling" to challenge terms and resolve examples with the user. Keep unresolved meanings as open questions.
4. Call the Skill tool with "grilling". Interview in rounds: ask every question answerable now, numbered, each with a recommended answer clearly labeled as a recommendation. Cover the dimensions required by the selected size. Do not infer agreement with recommendations or turn "I don't know" into a decision.

| Size | Required dimensions |
|---|---|
| Small | Problem & Outcome, Scope & Boundaries, Business Rules, Acceptance Criteria |
| Medium | Small, plus Personas & Authorization, User Journey, Data & Integrations, Failure & Recovery |
| Large | All 10 dimensions |

The ten dimensions are:

1. Problem & Outcome: the pain, and exactly one core objective in one sentence; its success metrics; and the current baseline of each metric (the value today, with where it comes from). When several objectives come up, ask the user to choose the core one. An unknown baseline is recorded as an open question, and the user confirms whether it blocks the PRD.
2. Personas & Authorization: actors, permissions, ownership, and access boundaries.
3. Scope & Boundaries: included behavior, exclusions, and neighboring responsibilities.
4. User Journey: entry points, steps, alternate paths, and completion.
5. Business Rules: invariants, transitions, validations, and exceptions.
6. Data & Integrations: sources, contracts, storage, and external dependencies.
7. Failure & Recovery: expected failures, retries, partial progress, and recovery.
8. Acceptance Criteria: observable examples of success and rejection.
9. Constraints & Dependencies: technical, operational, timing, and prerequisite constraints.
10. Rollout & Migration: compatibility, migration, release, and rollback.

Non-required dimensions may be skipped. A required dimension may be `not-applicable` only with a recorded reason confirmed by the user.

5. After each round append every answer to `.gyro/<slug>/discovery.md`, organized under `Facts`, `Decisions`, `Assumptions`, and `Open questions`. Preserve the question, answer, dimension, and round so context survives a fresh session. Separate user decisions from recommendations and assumptions. Record contradictions rather than resolving them silently. Ask the user to confirm criticality (`blocker`, `major`, `minor`) and which unresolved questions block the PRD. Mark each open question's blocking status explicitly.
6. Continue rounds until every required dimension is covered or confirmed `not-applicable`, no blocker remains open or conflicted, and the user explicitly agrees discovery is complete. Record that agreement in the discovery log. Discovery has no approval gate; do not run `gyro approve` for it. If a blocker cannot be resolved, name it and stop with discovery still incomplete.
7. Run `gyro status <slug> --json`. Tell the user the next step is `/gyro-prd <slug>` and stop. Do not invoke it.
