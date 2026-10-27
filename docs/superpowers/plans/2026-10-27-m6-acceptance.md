# M6 acceptance run

Plan: `2026-10-27-m6-local-mode.md`, Task 11. Branch `worktree-m6-local-mode` at `8e7fb31`. The milestone passes when local mode spec section 2 holds.

## Setup

| Step | Result |
|---|---|
| Product repository | `C:\Users\brahm\Documents\gyro-acceptance`, new repository, initial commit `3e653a6` (README, `package.json`, `src/index.js`) |
| Claude Code install | Not marketplace yet (`gyrospec/marketplace` does not exist). Sessions start with `--plugin-dir` for `skills/gyrospec` and for the repository root, so `gyrospec` and `mattpocock-skills` load from the worktree. Skill listing in a new session: pending |
| Codex install | 14 folders copied into `~/.agents/skills`: the eight `gyro*` skills plus `grilling`, `prototype`, `tdd`, `code-review`, `domain-modeling`, `codebase-design`. No name collided with an existing skill. `node ~/.agents/skills/gyro/scripts/gyro.mjs --version` prints `gyro 0.1.0`. Skill listing in Codex: pending |
| Script from the product root | `gyro status` exits 2 with `No Gyrospec workspace here. Run /gyro-discovery first` |

## Phases (Claude Code)

| Phase | Outcome | `gyro status` after | Deviations and defects |
|---|---|---|---|
| `/gyro-discovery` | Done in 6 rounds (0 to 5), agreed complete by the user in round 5 ("ya"). All four small-size dimensions covered: one core objective, M1 to M3 with M3 baseline 0% and M1/M2 baselines open (`major`, non-blocking, confirmed by the user), scope in/out, business rules, KP-1 to KP-21 | `prd draft ... next: /gyro-prd billing` | D1 resolved in the PRD phase: the user chose bilingual headings (`## Objective (Tujuan)`), recorded in `discovery.md`. Minor: the round 1 decision line still says headings are Indonesian only; the later bilingual decision supersedes it without editing it |
| (history) `/gyro-discovery` first session | Session `acfccf38`. `gyro init billing --size small` OK, `formatVersion: 1` written. Round 0 (title, slug, size) and a language round logged in `discovery.md`; round 1 questions Q1 to Q4 asked, not yet answered | `billing  prd draft, prototype draft, spec draft  next: /gyro-prd billing` | D1: the user chose Indonesian for skill-level conventions too (section headings, dimension names, Given/When/Then); parser keywords stay English. Deviates from the `gyro-prd` rule "Section headings stay in English"; logged by the skill as a non-blocking open question. D2 (defect): `next` says `/gyro-prd` as soon as `discovery.md` is non-empty, although discovery is not complete; `gyro-prd` itself refuses without the recorded agreement, but status misleads |
| `/gyro-prd` | Approved r1 (quote "ya", 2026-10-27T17:02Z), snapshot `approved/prd.1.md`. 16 REQs, 53 ACs. Template followed: Objective (one sentence), Success Metrics table with Baseline (`unknown` for M1/M2 pointing at REQ-015/016), Mermaid user journey with alternate paths, Scope in/out, then user-story REQs (`Dengan saya adalah penagih / Dan saya berada di ... / Maka ...`). ACs one line each, scenario and rule forms, negatives as separate ACs. `gyro check billing`: `prd.md: OK`. Worked numbers checked by hand (AC-013, AC-014, AC-026): correct | `prd approved r1, prototype draft, spec draft, next: /gyro-prototype billing` | D3 (minor): REQ-015/016 (open baselines) use a persona "pemilik produk" that discovery never named; the skill says to add nothing beyond discovery. D4 (note): open baseline REQs are measurement tasks, not product behavior; expect `gyro check prototype` to list them as uncovered and the user to confirm they have no screen. `.gyro/` is not committed yet (no commit authorization given) |
| `/gyro-prototype` | | | |
| `/gyro-spec` | | | |
| `/gyro-breakdown` | | | |
| `/gyro-writing-plans` (sub-ticket 1) | | | |
| `/gyro-executing-plans` (sub-ticket 1) | | | |

## Phases (Codex)

| Phase | Outcome | `gyro status` after | Deviations and defects |
|---|---|---|---|
| `/gyro-writing-plans` (sub-ticket 2) | | | |
| `/gyro-executing-plans` (sub-ticket 2) | | | |

## Follow-ups

1. D2: `gyro status` should not route to `/gyro-prd` until discovery is marked complete (for example a recorded completion marker in `discovery.md` that the status reads).
2. D1: decide whether skill-level headings may follow the user's language. If yes, `gyro-prd` and `gyro-discovery` and the spec language rule change; if no, the skills should say so when the user asks.
3. The setup instructions gave a bash command (`&&`, `/c/...` paths) to a Windows PowerShell 5.1 terminal; Task 11 and README commands need a PowerShell form.
