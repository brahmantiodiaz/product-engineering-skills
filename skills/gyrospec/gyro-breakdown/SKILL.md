---
name: gyro-breakdown
description: Break an approved spec into reviewed vertical sub-tickets with dependency edges.
disable-model-invocation: true
---

# Breakdown

1. Call the Skill tool with "gyro". Follow its Node 20+ check, script path, formats, and language rules. Reply in the user's language; keep convention keywords English.
2. Run `gyro status <slug> --json`. Require the spec to be `approved`, unchanged, and not stale, with current approved upstream gates. Otherwise name the missing gate or stale cause, suggest the correcting phase (usually `/gyro-spec <slug>`), and stop. Read the current approved spec snapshot, its PRD, glossary, relevant code, and existing sub-tickets.
3. Adapt the tracer-bullet breakdown discipline: draft narrow but complete vertical slices through every necessary layer, including verification. Each completed ticket must be independently demoable or verifiable and fit one fresh context window. Do any necessary prefactoring first. Avoid splitting into schema-only, API-only, and UI-only tickets that cannot demonstrate behavior alone.
4. Give each ticket only the blocking edges that actually gate its work. For a wide mechanical refactor whose blast radius prevents green vertical slices, use expand, migrate in bounded batches, then contract. If even batches cannot stay green, describe the shared integration branch and final integrate-and-verify ticket explicitly. Keep the graph acyclic and list blockers first.
5. Present a numbered proposed breakdown with title, blocked-by numbers, end-to-end deliverable, referenced REQ/AC IDs, and verification for each ticket. Quiz the user: is the granularity too coarse or fine, are blocking edges correct, and should tickets merge or split? Iterate until the user agrees to the breakdown. Do not call the user-invoked `to-tickets` skill or publish to an external tracker.
6. Write one `.gyro/<slug>/tickets/NN-<name>.md` per agreed slice, starting at `01` in dependency order. Use this front matter:

```markdown
---
title: Reject Product Order without an Approved Agreement
refs: [REQ-001, AC-001]
blocked_by: []
status: todo
pr: null
spec_revision: 1
---

Describe the end-to-end behavior, its verification, and the approved spec sections it implements.
```

Set `spec_revision` to the actual current approved revision. Use only existing, non-removed REQ/AC IDs. `blocked_by` contains the other file numbers, such as `[01]`. Avoid implementation snippets or file paths in the body unless a prototype snippet records a decision more precisely than prose; keep it trimmed and attributed to the prototype.

7. When existing sub-tickets are stale, review each against the current approved spec with the user. Update its refs, body, and `spec_revision` to the reviewed revision while keeping its number. Do not delete and recreate it or silently reset completed work, PR links, or execution status. New tickets start `todo`; preserve existing statuses unless the user explicitly agrees to change them. Reconcile any changed dependencies with already completed work.

   For a stale `done` ticket, decide with the user whether the shipped work still satisfies the changed requirements and spec sections before moving its `spec_revision` forward, because advancing it clears the staleness. If it does, record why in the body and keep `done`. If more work is needed, either reopen it (`gyro ticket <slug> <nn> --status todo` after the user agrees, keeping its PR link as evidence of what shipped) or write a follow-up ticket for the new behavior that is `blocked_by` nothing it does not need; never leave a stale `done` ticket looking current.

   When `gyro status` lists `uncovered` requirements (implemented by the approved spec, referenced by no sub-ticket), add tickets for them or extend an existing `todo` ticket's refs with the user's agreement.
8. Run `gyro check <slug> tickets`, show errors verbatim, fix invalid references, statuses, dependencies, or cycles, and repeat until clean. Run `gyro status <slug> --json` to confirm stale flags clear and identify the first ready ticket. There is no approval gate for the ticket files themselves.
9. Tell the user the next step is `/gyro-writing-plans <slug> <first ready nn>` and stop. If no ticket is ready, show the computed `next` and its reason instead. Do not invoke the next phase.
