---
name: gyro-writing-plans
description: Write a requirement-linked TDD implementation plan for a ready Gyrospec sub-ticket.
disable-model-invocation: true
---

# Writing plans

1. Call the Skill tool with "gyro". Follow its Node 20+ check, script path, and language rules. Reply in the user's language and keep convention keywords English. This workflow adapts Superpowers writing-plans; attribution is in the plugin repository's `THIRD_PARTY_NOTICES.md`.
2. Require arguments `<slug> <nn>`. Normalize a number such as `1` to `01`, then run `gyro status <slug> --json` before work. The named sub-ticket must exist, be `todo`, not stale, and have all `blocked_by` tickets done (`ready: true`), unless it is the revision case below. Require the current approved spec and its upstream gates to be unchanged and not stale, and require that `gyro check <slug> tickets` is clean; on any problem, show its lines and suggest `/gyro-breakdown <slug>`.

   **Revising an existing plan.** A sub-ticket that is `in_progress` or `blocked` and already has a plan file whose `Spec revision` is older than the current approved spec (after `/gyro-breakdown` reviewed it and moved its `spec_revision` forward, so it is no longer stale) gets its plan revised, not rewritten. Keep the plan's `**Execution start:**` and `**Out of scope:**` lines and the checked completed tasks with their evidence. Set `Spec revision` to the current revision, compare the old and new approved spec snapshots for the sections the sub-ticket implements, and mark each completed task that the change invalidates as unchecked with a one-line reason. Rewrite only the remaining and invalidated tasks against the new spec. Do not change the sub-ticket's status. If a prerequisite fails, name the missing gate, dependency, or stale cause, suggest the correcting phase or reported `next`, and stop. Never repair gates or snapshots by hand.
3. Read `.gyro/<slug>/tickets/NN-<name>.md`, the approved spec snapshot at the current revision, the approved PRD requirement blocks named in refs (map AC refs to their parent REQ), and relevant code and tests. Inspect the repository's instructions, glossary, ADRs, and tool commands. Compare the live `spec.md` to status; do not plan from an unapproved edit. Surface any unresolved decision to the user and stop if it changes approved scope.
4. Write `docs/superpowers/plans/<YYYY-MM-DD>-<slug>-<nn>.md`. Make the plan usable by an agent starting with no chat history. Use this header, filled with actual values and local paths:

```markdown
# <Sub-ticket title> Implementation Plan

**Goal:** <Observable outcome>
**Architecture:** <Smallest design consistent with the approved spec>
**Tech Stack:** <Actual tools and versions in this codebase>
**Spec:** .gyro/<slug>/approved/spec.<n>.md
**Ticket:** <slug>
**Sub-ticket:** <nn>
**Spec revision:** <n>

## Global Constraints

<Invariants, approval boundaries, compatibility, and repo rules>

## Review Focus

<Specific failure modes and evidence a reviewer should inspect>
```

5. Break the slice into bite-sized tasks in dependency order. Each task names the REQ/AC IDs it serves and the exact files to create, modify, and test. Define consumed and produced interfaces where tasks meet. Give concrete data, input/output examples, expected errors, and exact verification commands so the executor does not have to make product decisions. Keep all tasks within this sub-ticket's approved behavior; avoid unrelated improvements or speculative abstractions.
6. Give each task explicit TDD steps: write a focused failing test, run its exact command and expect the stated failure, implement the smallest behavior, rerun and expect the stated success, then run the appropriate typecheck or project checks. Use checkboxes for progress. Include final integration verification and how it proves the referenced acceptance criteria. Preserve WIP and follow the user's git and publication instructions; a plan is not authorization to commit, deploy, or open a PR.
7. Review the plan for complete acceptance coverage, correct paths, runnable commands, task boundaries, and consistency with the approved spec revision. Run `gyro status <slug> --json` again; if the source changed or the ticket became stale, stop and identify the required review instead of presenting the plan as current.
8. Show the plan path and ask the user to review it. For a revised plan, also show which completed tasks stay valid and which were reopened, and wait for the user's review before suggesting execution resumes. Tell the user the next step is `/gyro-executing-plans <slug> <nn>` and stop. Do not invoke execution or change the sub-ticket status merely because a plan was written.
