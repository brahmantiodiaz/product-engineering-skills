---
name: gyro-spec
description: Design the implementation against approved requirements and request spec approval.
disable-model-invocation: true
---

# Spec

1. Call the Skill tool with "gyro". Follow its Node 20+ check, script path, language, and approval rules. Reply in the user's language and retain English convention keywords.
2. Run `gyro status <slug> --json`. Require PRD `approved` and prototype `approved` or `not_applicable`, neither changed nor stale. If missing, show the exact gate or stale cause, suggest `/gyro-prd <slug>` or `/gyro-prototype <slug>` as appropriate, and stop. Respect `next`; do not execute another phase.
3. Read the approved PRD snapshot, approved prototype snapshot (or N/A reason), discovery, glossary, relevant ADRs, and current codebase before designing. Inspect existing architecture, interfaces, persistence, tests, and integration points. Explain any conflict between approved behavior and existing constraints; ask the human to resolve product decisions rather than silently redesigning them.
4. Write `.gyro/<slug>/spec.md` as a Superpowers-style design document. Describe architecture and boundaries, components and responsibilities, exact interface/data shapes where they settle decisions, data flow and state transitions, errors and recovery, testing and verification. Include compatibility and migration concerns where required by discovery. Prefer the smallest design that satisfies the approved requirements; record tradeoffs and exclusions explicitly.
5. Under every section that implements requirements, add `**Implements:** REQ-001, REQ-003` using its actual IDs. Map every implemented requirement to the appropriate sections and reference relevant ACs in the testing strategy. Avoid vague references that prevent later section-level staleness checks. Preserve clear heading boundaries so a section's text can be compared across approvals.
6. Run `gyro check <slug> spec` until clean, showing any errors verbatim. Review the design with the user and incorporate corrections. Run `gyro status <slug> --json`, show gate `spec`, next revision, and a short change summary, then ask a direct yes/no approval question. Only an explicit yes permits `gyro approve spec <slug> --quote "<the user's words>"`. If refused, show all lines verbatim and fix the cause; seek new approval when the content changes.
7. Verify `gyro status <slug> --json`. Once the spec is approved, tell the user the next step is `/gyro-breakdown <slug>` and stop. Do not invoke it.
