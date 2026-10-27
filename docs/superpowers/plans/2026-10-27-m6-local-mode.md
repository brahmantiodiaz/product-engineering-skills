# M6 Gyrospec Local Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `gyrospec` plugin: eight skills that run the whole Gyrospec flow in a product repository with no platform, plus a bundled offline `gyro` script (`init`, `check`, `status`, `approve`, `ticket`) built on `@gyrospec/format`.

**Architecture:** A new TypeScript package `packages/cli` holds the `gyro` logic as small modules (workspace files, sub-ticket front matter, checks, computed state, approval, ticket updates) behind a testable `main(argv, io)`. esbuild bundles it with `@gyrospec/format` into one dependency-free file committed inside the plugin. The skills are Markdown (`SKILL.md` plus `agents/openai.yaml`) in `skills/gyrospec/`, each phase skill calling the script and the upstream skills `grilling`, `prototype`, `tdd`, and `code-review`.

**Tech Stack:** TypeScript (strict), Node 20+, Vitest, esbuild 0.28, `@gyrospec/format` (via `file:../format`), Claude Code plugin manifests, Codex `agents/openai.yaml`.

**Spec:** `docs/superpowers/specs/2026-10-27-gyrospec-local-mode-design.md` (the local mode spec), which extends `docs/superpowers/specs/2026-10-25-gyrospec-design.md` (main spec: sections 4, 7, 8.2, 8.3, 10.3).

## Global Constraints

- Everything new lives in `packages/cli/`, `skills/gyrospec/`, and `THIRD_PARTY_NOTICES.md`. Upstream files change only where stated: one short paragraph in `CLAUDE.md`. The fork's `.claude-plugin/marketplace.json` is not changed (the plugin ships through the separate `gyrospec/marketplace` repository, local mode spec 7.3).
- No em-dashes anywhere (repo rule in `CLAUDE.md`). English for code, CLI output, and skill files; skills tell the agent to reply in the user's language and keep convention keywords English (main spec 4).
- Node floor for users: 20. The bundle targets `node20` and has no runtime dependencies. Developing `packages/cli` needs Node 22.12+ (Vitest 5 requires it, as it already does for `packages/format`), so `packages/cli/package.json` declares `engines.node: ">=22.12"`; that is a contributor toolchain floor, not the runtime floor of `gyro.mjs`.
- Format errors are printed exactly as `formatError` prints them: `line N: <message> [CODE]`.
- Exit codes: `0` success, `1` refused, `2` usage error.
- Slugs match `/^[a-z0-9]+(-[a-z0-9]+)*$/`, at most 60 characters. Sizes: `small`, `medium`, `large`. Sub-ticket statuses: `todo`, `in_progress`, `blocked`, `done`.
- `.gyro/` layout, `gates.json`, and sub-ticket front matter exactly as the local mode spec sections 4, 4.1, 4.2, extended only with the `history` and `basedOn` fields defined in Task 3.
- Phase skills are user-invoked (`disable-model-invocation: true` and `policy.allow_implicit_invocation: false`); `gyro` is model-invoked. Skills call other skills only through the Skill tool and only model-invoked ones (`.agents/invocation.md`).
- Commit style: `feat(cli): ...`, `feat(skills): ...`, `test(cli): ...`, `chore: ...`.

## Review Focus

1. **A PRD edited by hand after approval, then `gyro approve` run again:** the new revision is compared with the previous snapshot, so a silently deleted REQ is refused with `[ID_DELETED]`. Tested in Task 4.
2. **Prose-only edits to an approved PRD:** the PRD shows as changed and needs re-approval, but the prototype, spec, and sub-tickets do not become stale. Tested in Task 3.
3. **Sub-ticket front matter typed by a person** (extra spaces, quoted title, CRLF line endings): parses the same as the skill-written form. Tested in Task 2.
4. **`gyro` run outside a repository root or with an unknown slug:** exit 2 with a message naming `/gyro-discovery`, never a stack trace. Tested in Task 1 and Task 6 (bundle).
5. **A skill folder missing its Codex metadata, or a phase skill that is accidentally model-invoked:** caught by the skills lint test. Tested in Task 7.

---

## File structure

```
packages/cli/
├── package.json                 @gyrospec/cli 0.1.0, private, "type": "module"
├── tsconfig.json
├── scripts/bundle.mjs           esbuild -> skills/gyrospec/gyro/scripts/gyro.mjs
├── src/
│   ├── errors.ts                GyroError, refused(), usage()
│   ├── workspace.ts             paths, slug checks, ticket.json, gates.json, artifacts, snapshots
│   ├── frontmatter.ts           sub-ticket parse/serialize
│   ├── check.ts                 gyro check
│   ├── state.ts                 computed gate status, staleness, next step
│   ├── approve.ts               gyro approve
│   ├── ticket-update.ts         gyro ticket
│   ├── cli.ts                   main(argv, io): argument parsing and output
│   └── bin.ts                   process entry used by the bundle
└── test/                        one test file per module, plus bundle.test.ts and skills.test.ts
skills/gyrospec/
├── .claude-plugin/plugin.json
├── README.md
├── gyro/ (SKILL.md, agents/openai.yaml, scripts/gyro.mjs)
├── gyro-discovery/  gyro-prd/  gyro-prototype/  gyro-spec/
└── gyro-breakdown/  gyro-writing-plans/  gyro-executing-plans/
THIRD_PARTY_NOTICES.md
```

All `packages/cli` commands run from `packages/cli/`.

---

### Task 1: CLI package, workspace module, and `gyro init`

**Files:**
- Create: `packages/cli/package.json`, `tsconfig.json`, `.gitignore` (`node_modules/`, `dist/`), `src/errors.ts`, `src/workspace.ts`, `src/cli.ts`, `src/bin.ts`
- Test: `packages/cli/test/init.test.ts`, `packages/cli/test/helpers.ts`

**Interfaces:**
- Produces:
  ```ts
  // errors.ts
  export class GyroError extends Error { constructor(readonly exitCode: 1 | 2, readonly lines: string[]) }
  export function refused(...lines: string[]): GyroError;   // exit 1
  export function usage(...lines: string[]): GyroError;     // exit 2
  // workspace.ts
  export type Size = "small" | "medium" | "large";
  export type GateKind = "prd" | "prototype" | "spec";
  export const ARTIFACT_FILES: Record<GateKind, string>;    // prd.md, prototype.html, spec.md
  export interface TicketMeta { title: string; size: Size; createdAt: string; platformKey: string | null }
  export function sha256(text: string): string;              // hex
  export class Workspace {
    constructor(root: string);                               // the product repo root (cwd)
    readonly gyroDir: string;                                // <root>/.gyro
    slugDir(slug: string): string;                           // validates the slug (usage error) and that the folder exists (usage error: "No Gyrospec ticket named <slug>. Run /gyro-discovery first")
    listSlugs(): string[];                                   // sorted
    readTicket(slug: string): TicketMeta;
    readArtifact(slug: string, kind: GateKind): string | null;
    readGates(slug: string): Gates;                          // Gates from Task 3; Task 1 writes the empty form
    writeGates(slug: string, gates: Gates): void;            // pretty JSON, 2 spaces, trailing newline
    snapshotPath(slug: string, kind: GateKind, revision: number): string;   // approved/<kind>.<n>.<ext>
  }
  export function initTicket(ws: Workspace, slug: string, input: { title: string; size: Size }, now?: Date): void;
  // cli.ts
  export interface Io { cwd: string; out(line: string): void; err(line: string): void }
  export function main(argv: string[], io: Io): Promise<number>;   // returns the exit code; GyroError lines go to io.err
  ```
- `package.json`: name `@gyrospec/cli`, version `0.1.0`, `private: true`, `type: module`, `engines.node: ">=22.12"` (contributor toolchain; see Global Constraints), dependencies `"@gyrospec/format": "file:../format"`, devDependencies `typescript`, `vitest`, `@types/node`, `esbuild@^0.28`. Scripts: `"prepare": "npm --prefix ../format ci && npm --prefix ../format run build"` (a clean checkout needs only `npm ci` in `packages/cli`: npm links `file:../format` without installing its dependencies); `"pretest"`, `"pretypecheck"`, and `"prebundle"`: `"npm --prefix ../format run build"`; `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"bundle": "node scripts/bundle.mjs"`.
- `gyro init` refuses to run outside a repository root, before creating anything: when `<cwd>/.git` (a folder, or a file in a git worktree) is missing, usage error `Run gyro from the product repository root (the folder that holds .git). Run /gyro-discovery first` (Review Focus 4).
- `gyro init <slug> --title "<title>" --size <size>` creates `.gyro/config.json` (`{ "mode": "local", "formatVersion": 1 }`) if missing, then `.gyro/<slug>/ticket.json`, an empty `gates.json` (every gate `{ "status": "draft", "revision": 0, "history": [] }`), and empty `approved/` and `tickets/` folders. An existing slug folder is refused: `Ticket <slug> already exists`. The slug folder is claimed with a non-recursive `mkdir` (its `EEXIST` becomes that refusal), so of two concurrent inits only one writes the ticket files.
- `Workspace.assertFormat()` (called by `slugDir`, `listSlugs`, and `initTicket`) refuses a `config.json` whose `formatVersion` is missing or not `1` with a usage error naming it (local mode spec 4): `.gyro/config.json has formatVersion 2; this gyro supports formatVersion 1. Update the gyrospec plugin`, or `.gyro/config.json has no formatVersion; this gyro supports formatVersion 1`. Tested for `status <slug>`, `status`, `check`, and `init`.

- [ ] **Step 1: Write the failing tests** (`helpers.ts` provides `tempRepo(): string` under `os.tmpdir()` and `run(cwd, ...argv): Promise<{ code, out: string[], err: string[] }>` calling `main`)
  - `init` creates the files above with `{ title: "Agreement validation", size: "medium", platformKey: null }` and an ISO `createdAt`;
  - `init` twice gives exit 1 and `Ticket agreement-validation already exists`;
  - slugs `Agreement`, `a--b`, `-a`, and a 61-character slug give exit 2;
  - `--size huge` and a missing `--title` give exit 2;
  - `status unknown-slug` gives exit 2 and the line `No Gyrospec ticket named unknown-slug. Run /gyro-discovery first` (Review Focus 4; `status` is a stub returning that error until Task 3);
  - an unknown command gives exit 2 and a usage line listing `init, check, status, approve, ticket`.
- [ ] **Step 2: Run** `npm install && npx vitest run test/init.test.ts`: FAIL (modules missing).
- [ ] **Step 3: Implement** the files above. The argument parser is hand-written: positional arguments plus `--flag value` pairs; boolean `--json`; anything else is a usage error.
- [ ] **Step 4: Run** `npx vitest run test/init.test.ts && npm run typecheck`: PASS.
- [ ] **Step 5: Commit** `feat(cli): add gyro init and the .gyro workspace`

---

### Task 2: Sub-ticket front matter and `gyro check`

**Files:**
- Create: `packages/cli/src/frontmatter.ts`, `packages/cli/src/check.ts`
- Modify: `packages/cli/src/cli.ts`
- Test: `packages/cli/test/frontmatter.test.ts`, `packages/cli/test/check.test.ts`

**Interfaces:**
- Consumes: `Workspace` (Task 1), `@gyrospec/format`.
- Produces:
  ```ts
  // frontmatter.ts
  export type TicketStatus = "todo" | "in_progress" | "blocked" | "done";
  export interface SubTicket {
    number: string; file: string;                 // "01", "tickets/01-agreement-check.md"
    title: string; refs: string[]; blockedBy: string[]; status: TicketStatus;
    blockedReason: string | null; pr: string | null; specRevision: number; body: string;
  }
  export function parseSubTicket(file: string, text: string): SubTicket;    // refused("<file>: <problem>") on bad input
  export function serializeSubTicket(t: SubTicket): string;
  export function readSubTickets(ws: Workspace, slug: string): SubTicket[]; // files tickets/NN-*.md, sorted by number
  // check.ts
  export type CheckKind = "prd" | "prototype" | "spec" | "tickets";
  export interface CheckResult { kind: CheckKind; file: string; errors: string[]; notes: string[] }
  export function check(ws: Workspace, slug: string, kind?: CheckKind): CheckResult[];
  ```

**Rules:**
- Front matter is the block between the first two `---` lines. Keys, in serialization order: `title`, `refs`, `blocked_by`, `status`, `blocked_reason` (only when set), `pr`, `spec_revision`. Lists use flow form `[a, b]` (empty `[]`); `null` is the literal `null`; a title is written unquoted unless it contains `:` or starts with `[`, `"`, or `#`, in which case it is JSON-quoted. Parsing accepts both quoted and unquoted strings, extra spaces around `:` and `,`, and CRLF.
- The file number is the leading `NN` of the file name (`01-agreement-check.md`). `blocked_by` items are numbers as strings; `"1"` normalizes to `"01"`. Two files with the same number (two branches each adding one) make `readSubTickets` refuse: `tickets: number 01 is used by tickets/01-a.md and tickets/01-b.md`, so `check`, `status`, and `ticket` never act on whichever sorts first.
- `check` without a kind checks every artifact present (`prd.md`, `prototype.html`, `spec.md`, `tickets/`) and reports nothing for missing ones. `check <slug> <kind>` for a missing file is refused: `prd.md not found in .gyro/<slug>`.
- PRD: `parsePrd(text).errors`. Spec: `parseSpec` errors plus `validateReferences` against the current `prd.md` (empty index when absent). Prototype: `parsePrototype` errors plus `validateReferences`; `notes` gets `Uncovered requirements: REQ-004, REQ-007` when `uncoveredRequirements` is non-empty. All errors via `formatError`, ordered by line.
- Tickets, each error prefixed with the file path: `refs REQ-009 does not exist in the PRD`, `refs REQ-002 is removed in the PRD` (AC IDs are checked against their REQ's acceptance criteria), `blocked_by 07 is not a sub-ticket`, `status "doing" is not one of todo, in_progress, blocked, done`, `blocked needs blocked_reason`, and one `tickets: blocked_by forms a cycle 01 -> 02 -> 01` per cycle found. Cycle detection visits each sub-ticket once (depth-first with finished nodes remembered), so a wide acyclic graph such as 40 tickets each blocked by the previous two checks in well under a second.
- CLI output: per result, `<file>: OK` or `<file>: N problems` followed by the error lines, then the notes. Exit 1 when any result has errors.

- [ ] **Step 1: Write the failing tests**
  - `frontmatter.test.ts`: round-trip of the spec 4.2 example; a hand-typed variant with `title:  "Reject: Product Order"`, `refs: [ REQ-001 ,AC-001 ]`, CRLF line endings, and `blocked_by: [1]` parses to the same values with `title` `Reject: Product Order` and `blockedBy` `["01"]` (Review Focus 3); a missing `---` block and a non-numeric `spec_revision` are refused with the file name in the message.
  - `check.test.ts`: a valid PRD prints `prd.md: OK` and exit 0; a PRD with a duplicate REQ prints `line N: Duplicate ID REQ-001, first defined on line 1 [DUPLICATE_ID]` and exit 1; a spec with `**Implements:** REQ-009` reports `[UNKNOWN_REFERENCE]`; a prototype missing a `data-req` for REQ-002 is OK with the note `Uncovered requirements: REQ-002`; tickets with refs to an unknown REQ, a removed REQ, an unknown `blocked_by`, a bad status, and a 01->02->01 cycle each produce their message; `check <slug> spec` with no `spec.md` exits 1 with `spec.md not found in .gyro/<slug>`.
- [ ] **Step 2: Run, verify FAIL. Step 3: Implement. Step 4: Run** `npx vitest run test/frontmatter.test.ts test/check.test.ts && npm run typecheck`: PASS.
- [ ] **Step 5: Commit** `feat(cli): add gyro check for PRD, prototype, spec, and sub-tickets`

---

### Task 3: Computed state and `gyro status`

**Files:**
- Create: `packages/cli/src/state.ts`
- Modify: `packages/cli/src/workspace.ts` (gate types), `packages/cli/src/cli.ts`
- Test: `packages/cli/test/state.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2, `diffRequirements`, `parsePrd`, `parseSpec`, `parsePrototype` from `@gyrospec/format`.
- Produces:
  ```ts
  // workspace.ts (gates.json shape: spec 4.1 plus history and basedOn)
  export interface Approval {
    revision: number; sha256: string | null; approvedAt: string; quote: string;
    notApplicable: string | null;                   // reason, prototype only
    basedOn: { prd?: number; prototype?: number };  // revisions this approval built on
  }
  export interface GateRecord {
    status: "draft" | "approved" | "not_applicable"; revision: number;
    sha256?: string; approvedAt?: string; quote?: string; reason?: string; basedOn?: Approval["basedOn"];
    history: Approval[];                            // every approval, oldest first; top-level fields mirror the last one
  }
  export type Gates = Record<GateKind, GateRecord>;
  // state.ts
  export interface GateState {
    status: "draft" | "approved" | "not_applicable" | "stale";
    revision: number;                               // last approved revision, 0 when never approved
    changedSince: number | null;                    // set when the file differs from approval `revision`
    reqDiff: RequirementDiff | null;                // PRD only, current file vs last approved snapshot
    staleBecause: string[];                         // e.g. "REQ-002 changed in PRD r2"
  }
  export interface TicketState extends SubTicket { stale: boolean; staleBecause: string[]; ready: boolean }
  export interface FeatureState {
    slug: string; title: string; size: Size;
    gates: Record<GateKind, GateState>;
    tickets: TicketState[];
    next: string;                                   // a skill invocation or a sentence
  }
  export function computeState(ws: Workspace, slug: string): FeatureState;
  export function changedReqs(before: string, after: string): Set<string>;   // REQ IDs changed or removed between two PRD texts
  ```

**Rules (local mode spec 6.1):**
- A gate never approved is `draft`. A gate whose file SHA-256 differs from its last approval is `draft` with `changedSince` set (PRD also gets `reqDiff`). A prototype approved as not applicable stays `not_applicable` regardless of the file.
- Staleness uses approved snapshots only. Let `P` be the current approved PRD revision.
  - Prototype approval based on PRD `b < P`: stale for each `data-req` ID in `changedReqs(prd.b, prd.P)`.
  - Spec approval based on PRD `b < P`: stale for each `Implements` ID in `changedReqs(prd.b, prd.P)`.
  - Sub-ticket whose `spec_revision` `s` matches no spec approval in `history`: stale with `spec_revision <s> is not an approved spec revision`, so it is never `ready` (it has no baseline to compare).
  - Sub-ticket with `spec_revision` `s`: let `b` be spec approval `s`'s `basedOn.prd`. Stale for each REQ in its refs (an AC ref maps to both its REQ in PRD `b` and its REQ in PRD `P`) that is in `changedReqs(prd.b, prd.P)`, and for each AC ref whose REQ differs between the two (`AC-001 moved from REQ-001 to REQ-003 in PRD r2`); and, when `s` is older than the current approved spec revision, stale when the text of any spec section implementing its refs differs between `spec.s` and the current approved spec snapshot. A section's text is its heading line through the line before the next heading of the same or higher level; a preamble section (`**Implements:**` before any heading, line 0) ends at the first heading of any level.
  - Prototype and spec are also stale for each active REQ added between PRD `b` and `P` that they do not reference (`REQ-003 added in PRD r2`): a new requirement was never reviewed there. Re-approving unchanged content (Task 4 rule 7) moves `basedOn` forward and clears it.
  - A sub-ticket with any `gyro check tickets` problem (judged against the approved PRD `P`, through the shared `ticketProblems` in `check.ts`) is stale with that problem as its reason, so it is never `ready`.
  - `uncovered`: REQs named in an `**Implements:**` line of the approved spec, not removed, and referenced by no sub-ticket (AC refs count for their REQ). Non-empty `uncovered` routes `next` to `/gyro-breakdown <slug>` (checked with the stale-ticket rule), and the text output adds `  uncovered  REQ-003 (no sub-ticket refers to it)` before `next`.
  - `changedReqs` uses `diffRequirements(...).changed` plus `.removed`. Prose outside REQ/AC blocks never counts (Review Focus 2).
  - `staleBecause` lines: `REQ-002 changed in PRD r2`, `spec section "Order validation" changed in spec r3`.
- `ready`: status `todo`, not stale, and every `blocked_by` ticket is `done`.
- `next`, first match: no approved PRD and `discovery.md` missing or empty: `/gyro-discovery <slug>`; PRD not approved: `/gyro-prd <slug>`; prototype not approved/not applicable or stale: `/gyro-prototype <slug>`; spec not approved or stale: `/gyro-spec <slug>`; no sub-tickets, or any stale sub-ticket: `/gyro-breakdown <slug>`; first ready sub-ticket: `/gyro-writing-plans <slug> <nn>`; a sub-ticket `in_progress`: `/gyro-executing-plans <slug> <nn>`; all done: `All sub-tickets are done.`; otherwise `Waiting on blocked sub-tickets: <nn>, ...`.
- `gyro status <slug>` prints:
  ```
  <slug>  <title> (<size>)
    prd        approved r2
    prototype  stale r1: REQ-002 changed in PRD r2
    spec       draft (changed since r1)
    tickets    01 done, 02 in_progress, 03 todo (stale)
    next       /gyro-prototype <slug>
  ```
  (`next` follows the ordered rules above: the stale prototype is fixed before the spec.)
  `--json` prints `JSON.stringify(state, null, 2)`. `gyro status` with no slug prints one line per slug: `<slug>  prd r2, prototype r1, spec draft  next: <next>`; with no `.gyro/` folder it exits 2 with `No Gyrospec workspace here. Run /gyro-discovery first`.

- [ ] **Step 1: Write the failing tests** (build fixtures by writing files and `gates.json` directly, including snapshots under `approved/`)
  - a fresh ticket: all gates `draft`, `next` `/gyro-discovery <slug>`; with a non-empty `discovery.md`: `/gyro-prd <slug>`;
  - PRD r1 approved and unchanged: `approved`, `next` `/gyro-prototype <slug>`; edit REQ-002's statement in `prd.md`: `draft`, `changedSince` 1, `reqDiff.changed` `["REQ-002"]`;
  - PRD r2 approved with REQ-002 changed; prototype approved on PRD r1 with `data-req="REQ-002"`: prototype `stale`, `staleBecause` `["REQ-002 changed in PRD r2"]`; a prototype referencing only REQ-001 is not stale;
  - PRD r2 differs from r1 only in prose outside REQ blocks: prototype and spec approved on r1 are not stale (Review Focus 2);
  - sub-ticket refs `AC-002` (under REQ-002) with spec r1 based on PRD r1, after PRD r2 changed REQ-002: stale;
  - spec r2 changes the text of the section implementing REQ-001; a sub-ticket cut from spec r1 with refs REQ-001 is stale with `spec section "<heading>" changed in spec r2`; one with refs only to an unchanged section is not;
  - `ready` and `next` across: 01 done, 02 todo blocked by 01 gives `/gyro-writing-plans <slug> 02`; all done gives `All sub-tickets are done.`;
  - the text output for the example above matches line by line, and `--json` parses back to the same state.
- [ ] **Step 2: Run, verify FAIL. Step 3: Implement. Step 4: Run** `npx vitest run test/state.test.ts && npm run typecheck`: PASS.
- [ ] **Step 5: Commit** `feat(cli): compute gate status, staleness, and the next step`

---

### Task 4: `gyro approve`

**Files:**
- Create: `packages/cli/src/approve.ts`
- Modify: `packages/cli/src/cli.ts`
- Test: `packages/cli/test/approve.test.ts`

**Interfaces:**
- Consumes: `computeState` (Task 3), `check` (Task 2), `findBlockers`, `checkRevision`, `formatError` from `@gyrospec/format`.
- Produces:
  ```ts
  export function approve(ws: Workspace, slug: string, gate: GateKind,
    input: { quote: string; notApplicable?: string; now?: Date }): { gate: GateKind; revision: number };
  ```

**Rules (local mode spec 6.2), checked in this order, each a `refused(...)`:**
1. Empty or missing quote: `--quote must carry the user's own words of approval`.
2. `--not-applicable` on a gate other than the prototype: `Only the prototype can be marked not applicable`. An empty reason (checked after rule 3): `--not-applicable requires a reason`.
3. Gate order: prototype needs PRD `approved` (`Approve the PRD first`); spec needs PRD `approved` and prototype `approved` or `not_applicable`, not stale (`Approve the prototype first, or mark it not applicable`). A PRD with `changedSince` set counts as not approved.
4. Artifact file missing (unless not applicable): `prd.md not found in .gyro/<slug>`.
5. Format errors: the `check` errors for that artifact, as printed by `gyro check`. `check(ws, slug, kind, texts)` validates the text `approve` already read, so the bytes checked are the bytes hashed and snapshotted.
6. PRD only: `findBlockers` non-empty: `Blocking requirements are still open: REQ-003, REQ-005`; and `checkRevision(previous approved snapshot, current)` errors, as `formatError` lines (Review Focus 1).
7. SHA-256 equal to the current approval while the gate is computed `approved` (not stale): `Nothing to approve: <file> is unchanged since r<n>`. Unchanged content of a stale prototype or spec can be approved again after review; the new revision's `basedOn` moves to the current upstream revisions, which clears the staleness.

Everything after rules 1 and 2 runs under `Workspace.withLock(slug)`: an exclusive `.gyro/<slug>/.lock` (created with `wx`, removed in `finally`); when it exists, refused `Another gyro command is changing .gyro/<slug>. If none is running, delete .gyro/<slug>/.lock and retry`. `gyro ticket` takes the same lock. All JSON writes go through a temporary file and a rename.

On success: `revision = previous + 1`, copy the file to `approved/<kind>.<revision>.<ext>` with flag `wx` (not for not applicable; an existing file is refused with `approved/<file> already exists; gates.json does not record it. Restore gates.json from git before approving`), push an `Approval` onto `history` with `basedOn` `{ prd }` for the prototype and `{ prd, prototype }` for the spec, mirror it at the top level, write `gates.json`, and print `Approved <gate> r<revision> for <slug>` (or `Marked prototype not applicable for <slug>`).

- [ ] **Step 1: Write the failing tests**
  - approving a valid PRD writes `approved/prd.1.md`, `gates.json.prd` `{ status: "approved", revision: 1, quote: "approve PRD", history: [ ... one entry ... ] }`, and prints `Approved prd r1 for <slug>`;
  - each refusal 1 to 7 has a test asserting its message and exit 1, and that `gates.json` and `approved/` are unchanged;
  - after approving r1, deleting REQ-002 from `prd.md` and approving again is refused with a line ending in `[ID_DELETED]` (Review Focus 1);
  - a prototype marked not applicable records `notApplicable` and `reason`, writes no snapshot, and then lets the spec be approved with `basedOn` `{ prd: 1, prototype: 1 }`.
- [ ] **Step 2: Run, verify FAIL. Step 3: Implement. Step 4: Run** `npx vitest run test/approve.test.ts && npm run typecheck`: PASS.
- [ ] **Step 5: Commit** `feat(cli): record local gate approvals with snapshots`

---

### Task 5: `gyro ticket`

**Files:**
- Create: `packages/cli/src/ticket-update.ts`
- Modify: `packages/cli/src/cli.ts`
- Test: `packages/cli/test/ticket.test.ts`

**Interfaces:**
- Consumes: `readSubTickets`, `serializeSubTicket` (Task 2).
- Produces:
  ```ts
  export function updateTicket(ws: Workspace, slug: string, number: string,
    input: { status: TicketStatus; reason?: string; pr?: string }): SubTicket;
  ```

**Rules:** unknown number: usage error `No sub-ticket <nn> in .gyro/<slug>/tickets`. `blocked` requires `--reason` (refused `--reason is required with --status blocked`) and stores it in `blocked_reason`; any other status clears `blocked_reason`. `--pr` must start with `http://` or `https://` (usage error). `done` keeps an existing `pr` when `--pr` is omitted. The body is preserved byte for byte. Prints `<nn> <status>`.

- [ ] **Step 1: Failing tests:** `todo -> in_progress -> blocked --reason "Need DB access" -> in_progress -> done --pr https://github.com/acme/app/pull/7` round-trips the file with the body unchanged and `blocked_reason` cleared at the end; each refusal above; number `1` resolves to `01`.
- [ ] **Step 2: Run, verify FAIL. Step 3: Implement. Step 4: Run** `npx vitest run test/ticket.test.ts && npm run typecheck`: PASS.
- [ ] **Step 5: Commit** `feat(cli): update sub-ticket status`

---

### Task 6: Bundle into the plugin

**Files:**
- Create: `packages/cli/scripts/bundle.mjs`, `skills/gyrospec/gyro/scripts/gyro.mjs` (generated), `packages/cli/test/bundle.test.ts`
- Modify: `packages/cli/src/bin.ts` (version flag)

**Interfaces:**
- Consumes: `main` (Task 1).
- Produces: `node skills/gyrospec/gyro/scripts/gyro.mjs <command> ...` with the same behavior as `main`; `--version` prints `gyro 0.1.0`.

- [ ] **Step 1: Write `scripts/bundle.mjs`:** esbuild `entryPoints: ["src/bin.ts"]`, `bundle: true`, `platform: "node"`, `format: "esm"`, `target: "node20"`, `outfile` (default `../../skills/gyrospec/gyro/scripts/gyro.mjs`, overridable by `--outfile`), `banner.js` = `#!/usr/bin/env node\n// Generated by packages/cli/scripts/bundle.mjs from @gyrospec/cli <version>. Do not edit.`, `define: { __GYRO_VERSION__: JSON.stringify(version) }`, `legalComments: "none"`, no minification (the plugin directory's security scan holds code it cannot read; `gyro.mjs` is the one file exempt from the no-em-dash rule, so dependency comments may stay), `metafile: true`. The bundle test checks it stays readable: more than 1000 lines, and at most one line over 500 characters (the `entities` decode table literal). Because legal comments are dropped, the script also writes `THIRD_PARTY_LICENSES.txt` beside the outfile: one section per third-party package with `bytesInOutput > 0` (name, version, license, and its LICENSE file text), sorted by name, skipping `@gyrospec/*`. The bundle test regenerates both files and compares bytes.
- [ ] **Step 2: Write the failing tests:** bundling to a temp file produces bytes identical to the committed `gyro.mjs` (so a stale bundle fails CI); `node gyro.mjs --version` prints `gyro 0.1.0`; in a temp repo, `node gyro.mjs init demo --title Demo --size small` then `node gyro.mjs status demo --json` succeeds and matches `main`'s JSON; `node gyro.mjs status nope` exits 2 with the `/gyro-discovery` message and no stack trace (Review Focus 4); the bundle contains no `require("@gyrospec` or `from "@gyrospec` strings.
- [ ] **Step 3: Run** the tests: FAIL (no bundle yet). **Step 4:** `npm run bundle`, then run `npx vitest run` (whole package): PASS.
- [ ] **Step 5: Commit** `feat(cli): bundle gyro into the gyrospec plugin`

---

### Task 7: Plugin packaging and the skills lint

**Files:**
- Create: `skills/gyrospec/.claude-plugin/plugin.json`, `skills/gyrospec/README.md`, `THIRD_PARTY_NOTICES.md`, `packages/cli/test/skills.test.ts`
- Modify: `CLAUDE.md` (one paragraph). The fork's `.claude-plugin/marketplace.json` is not touched.

**Interfaces:**
- Produces: the plugin shell later tasks fill, and a lint every skill must pass.

- [ ] **Step 1: Manifests.** `plugin.json`: `name: "gyrospec"`, `version: "0.1.0"`, description `Human-driven product engineering: discovery, PRD, prototype, spec, sub-tickets, and planned execution, with gates you approve.`, `license: "MIT"`, `repository: "https://github.com/gyrospec/skills"`, `author: { name: "Gyrospec", url: "https://github.com/gyrospec" }` (strict validation warns without it), `skills` listing the eight folders (`./gyro`, `./gyro-discovery`, `./gyro-prd`, `./gyro-prototype`, `./gyro-spec`, `./gyro-breakdown`, `./gyro-writing-plans`, `./gyro-executing-plans`). No entry in the fork's marketplace: the `gyrospec/marketplace` manifest is specified in local mode spec 7.3 and created as a release step with the user.
- [ ] **Step 2: Docs.** `skills/gyrospec/README.md`: one paragraph on the flow; skills grouped as user-invoked and model-invoked with one line each; installation for Claude Code (`/plugin marketplace add gyrospec/marketplace`, then install `gyrospec@gyrospec` and `mattpocock-skills@gyrospec`) and for Codex (copy or symlink each `skills/gyrospec/<skill>` folder, and the upstream folders by their full paths `skills/productivity/grilling`, `skills/engineering/prototype`, `skills/engineering/tdd`, `skills/engineering/code-review`, `skills/engineering/domain-modeling`, and `skills/engineering/codebase-design` (called by `tdd`), into `~/.agents/skills`; the skills lint follows Skill-tool calls transitively from the five direct dependencies so no reachable upstream skill is missing); Node 20+ required. `CLAUDE.md` paragraph: `skills/gyrospec/` is the Gyrospec plugin; the promoted-bucket, docs-page, and ask-matt rules above apply to Matt's buckets only; Gyrospec skills follow `.agents/invocation.md` and its own README. Notices ship inside the plugin (local mode spec 7.3): `skills/gyrospec/THIRD_PARTY_NOTICES.md` with the MIT notices for mattpocock/skills (adapted `to-tickets`) and obra/superpowers (adapted `writing-plans`, `executing-plans`), copyright lines copied from each project's LICENSE; a `NOTICE.md` with the matching notice in `gyro-breakdown`, `gyro-writing-plans`, and `gyro-executing-plans`; the root `THIRD_PARTY_NOTICES.md` points at them. The skills lint checks each file carries its copyright line.
- [ ] **Step 3: Write `skills.test.ts`** (it reads the repo from `packages/cli/../../`): for each folder in the plugin's `skills` list **that exists on disk** (Task 10 adds the completeness check): `SKILL.md` exists with front matter `name` equal to the folder name and a non-empty `description`; `agents/openai.yaml` exists with `interface.display_name` and `interface.short_description`; `gyro` has no `disable-model-invocation` and no `policy` block; every other skill has `disable-model-invocation: true` and `policy.allow_implicit_invocation: false` (Review Focus 5); no file under `skills/gyrospec/` (except `gyro.mjs`) contains an em-dash; every phase skill's `SKILL.md` contains `gyro status` and names the skill that follows it in the flow (discovery -> prd -> prototype -> spec -> breakdown -> writing-plans -> executing-plans); the README names an existing `skills/<bucket>/<name>` folder for each upstream skill the phases call; the README installs from `gyrospec/marketplace` with no `@mattpocock` install name, and the fork's marketplace lists only `mattpocock-skills`.
- [ ] **Step 4: Run** `npx vitest run test/skills.test.ts`: PASS (no skill folders yet, so only the lint plumbing runs; prove it bites by adding a throwaway `skills/gyrospec/gyro-prd/SKILL.md` without `disable-model-invocation`, watching it fail, and deleting it). `claude plugin validate skills/gyrospec` is expected to report only the missing skill folders until Task 10.
- [ ] **Step 5: Commit** `chore: add the gyrospec plugin shell, notices, and skills lint`

---

### Task 8: The `gyro` reference skill

**Files:**
- Create: `skills/gyrospec/gyro/SKILL.md`, `skills/gyrospec/gyro/agents/openai.yaml`

**Content (model-invoked; description model-facing: "Shared reference for Gyrospec skills: the .gyro folder, the PRD/spec/prototype format conventions, running the gyro script, and how approvals are asked for and recorded. Use when a Gyrospec skill needs it, or when the user asks about Gyrospec files or approvals."):**
- **Running the script:** `node <this skill's directory>/scripts/gyro.mjs <command>` from the product repository root; phase skills reach it as `node <their own skill directory>/../gyro/scripts/gyro.mjs`. Check `node --version` is 20 or later first; if not, tell the user to install Node 20+ and stop.
- **Layout:** the `.gyro/` tree and file roles (local mode spec 4), and that everything under `.gyro/` is committed.
- **Formats:** the PRD block (`### REQ-NNN Title`, statement, `**Status:** … · **Criticality:** …`, `- [AC-NNN] …`), allowed statuses and criticalities, spec `**Implements:**` lines, prototype `data-screen` and `data-req`, the ID rules (never renumber or reuse; deleted means `**Status:** removed`), and that keywords stay English in any language.
- **Approvals:** show gate, next revision, and a short summary of what changed (`gyro status <slug>` gives the REQ diff); ask a yes/no question; record only an explicit yes with `gyro approve <gate> <slug> --quote "<the user's words>"`; never treat silence, partial praise, or your own recommendation as approval; when `gyro approve` refuses, show its lines verbatim and fix the cause.
- **Status:** `gyro status <slug> --json` before every phase; respect `next`; never edit `gates.json` or `approved/` by hand.
- **Language:** reply in the user's language; keep convention keywords and CLI commands as they are.
- `openai.yaml`: `display_name: "Gyrospec"`, `short_description: "Gyrospec files, formats, and approvals"`, no policy block.

- [ ] **Step 1: Write both files.** **Step 2: Run** `npx vitest run test/skills.test.ts` (in `packages/cli`): the `gyro` checks pass; the other skills still fail. **Step 3: Commit** `feat(skills): add the gyro reference skill`

---

### Task 9: Product-phase skills

**Files:**
- Create: `skills/gyrospec/<skill>/SKILL.md` and `agents/openai.yaml` for `gyro-discovery`, `gyro-prd`, `gyro-prototype`, `gyro-spec`, `gyro-breakdown`

**Shared skeleton (every phase skill):** front matter with `disable-model-invocation: true` and a human-facing one-line description; first step "Call the Skill tool with `gyro`"; then `gyro status <slug> --json` and stop with the reason when the prerequisite in the table below is not met; then the behavior; final step "Tell the user the next step is `/<next-skill> <slug>`" and stop. Each `openai.yaml` sets `policy.allow_implicit_invocation: false`.

| Skill | Prerequisite (from `status --json`) | Behavior to write | Next |
|---|---|---|---|
| `gyro-discovery` | none (argument may be empty) | Ask title, slug, size if not given; `gyro init`. Call the Skill tool with `grilling` to interview in rounds over the dimensions required for the size (main spec 10.3 table, copied into the skill; Problem & Outcome requires one core objective, success metrics, and each metric's current baseline, an unknown baseline being an open question whose blocking status the user confirms); log each answer in `discovery.md` under Facts, Decisions, Assumptions, Open questions; ask the user to mark which open questions block the PRD; finish when none blocks and the user agrees discovery is complete. Call the Skill tool with `domain-modeling` when terms are ambiguous | `/gyro-prd` |
| `gyro-prd` | `discovery.md` exists and non-empty | Write `prd.md` from `discovery.md` only (no new requirements; open questions become `open` REQs) using the template in local mode spec 7.2 (Objective, Success Metrics table with Baseline, User Journey, Scope, then user-story REQs with one-line ACs including separate negative scenarios); `gyro check <slug> prd` until clean; summarize REQs by criticality; ask for approval (gyro skill etiquette); on yes `gyro approve prd` | `/gyro-prototype` |
| `gyro-prototype` | PRD `approved` | Ask whether the feature has a UI; if not, ask for a reason and on approval `gyro approve prototype <slug> --not-applicable "<reason>" --quote ...`. Otherwise call the Skill tool with `prototype` (UI branch) constrained to one self-contained `prototype.html` with hash routing, one `data-screen` per screen, and `data-req` on elements per REQ; `gyro check <slug> prototype`; resolve uncovered REQs or confirm with the user why they have no screen; tell the user to open the file in a browser; ask for approval | `/gyro-spec` |
| `gyro-spec` | PRD `approved`; prototype `approved` or `not_applicable`, not stale | Superpowers-style design doc in `spec.md` (architecture, components, data flow, error handling, testing) with `**Implements:**` under every section that implements requirements; read the codebase first; `gyro check <slug> spec`; ask for approval | `/gyro-breakdown` |
| `gyro-breakdown` | spec `approved`, not stale | Adapt upstream `to-tickets` steps 3 to 4 (vertical slices, blocking edges, quiz the user); write `tickets/NN-<name>.md` with the spec 4.2 front matter (`status: todo`, `spec_revision` = current spec revision); replace stale sub-tickets by editing their refs and body, keeping their numbers; for a stale `done` ticket, decide with the user whether the shipped work still holds before advancing its `spec_revision`, and otherwise reopen it or add a follow-up ticket; add tickets for `uncovered` REQs; `gyro check <slug> tickets` | `/gyro-writing-plans <slug> <first ready nn>` |

- [ ] **Step 1: Write the five skills.** **Step 2: Run** `npx vitest run test/skills.test.ts`: the five pass. **Step 3: Commit** `feat(skills): add discovery, PRD, prototype, spec, and breakdown skills`

---

### Task 10: Planning and execution skills

**Files:**
- Create: `skills/gyrospec/gyro-writing-plans/SKILL.md` + `agents/openai.yaml`, `skills/gyrospec/gyro-executing-plans/SKILL.md` + `agents/openai.yaml`

**`gyro-writing-plans <slug> <nn>`** (prerequisite: the sub-ticket exists, is not stale, and is `todo`, and `gyro check <slug> tickets` is clean; `gyro-executing-plans` requires the same clean check): read the sub-ticket, the approved `spec.md`, the PRD REQs in its refs, and the codebase; write `docs/superpowers/plans/<YYYY-MM-DD>-<slug>-<nn>.md` following the Superpowers plan format (header with Goal, Architecture, Tech Stack, Spec; Global Constraints; Review Focus; bite-sized TDD tasks with exact files, interfaces, tests, and commands), adding to the header `**Ticket:** <slug>`, `**Sub-ticket:** <nn>`, `**Spec revision:** <n>`, and making every task cite the REQ/AC IDs it serves. Ends by asking the user to review the plan, then: next `/gyro-executing-plans <slug> <nn>`. Revision case: a sub-ticket that is `in_progress` or `blocked`, has a plan with an older `Spec revision`, and is no longer stale after `/gyro-breakdown` moved its `spec_revision` forward gets its plan revised in place: keep `**Execution start:**`, `**Out of scope:**`, and the checked completed tasks with their evidence; set `Spec revision` to the current revision; reopen (uncheck, with a reason) completed tasks the spec change invalidates; rewrite only remaining and reopened tasks; leave the sub-ticket status alone; show the user what stayed valid and what reopened, and wait for their review.

**`gyro-executing-plans <slug> <nn>`** (prerequisite: a plan file for the sub-ticket exists; its `Spec revision` equals the current approved spec revision; the sub-ticket is not stale): fix the review baseline once per plan (on a resume reuse the plan's `**Execution start:** <sha>` line, show the user changes the completed tasks do not account for, and record the ones that are not this plan's under `**Out of scope:**`; otherwise require a clean tree, asking the user to commit or set aside other WIP, and write that line under the plan header); `gyro ticket <slug> <nn> --status in_progress`; work the tasks in order with TDD (call the Skill tool with `tdd`), running every verification command and comparing to its expected output; on a step that needs a human, `gyro ticket ... --status blocked --reason "<why>"` and stop; after any interruption and immediately before marking the ticket done, recheck every prerequisite (all three gates current, since a hand-edited PRD or spec shows `draft` without a revision change; ticket not stale; `blocked_by` done; plan `Spec revision` current), and on a failure set `blocked` with the failed prerequisite and name the fixing phase; after the last task call the Skill tool with `code-review`, giving it the `**Execution start:**` commit as the fixed point, the approved spec snapshot plus sub-ticket and plan as the spec source (local mode has no issue tracker), and, because `code-review` diffs committed work only, `git diff <start>` plus new untracked files when the work is not all committed, telling it that an empty committed diff is expected so it skips its non-empty check and reviews that working-tree scope on both axes, with the `**Out of scope:**` list excluded; fix its Critical and Important findings with a failing test first; then ask the user for the PR URL (or create the PR if they ask) and run `gyro ticket ... --status done --pr <url>`. Next: `gyro status <slug>`'s `next`.

- [ ] **Step 1: Write both skills** (adapted from Superpowers `writing-plans` and `executing-plans`; their text is MIT, attributed in `skills/gyrospec/THIRD_PARTY_NOTICES.md` and each folder's `NOTICE.md`), and add to `skills.test.ts` the test `every skill listed in plugin.json exists`. **Step 2: Run** `npx vitest run` in `packages/cli` (whole package, including `skills.test.ts`): all PASS. Run `claude plugin validate skills/gyrospec --strict`: passes. `claude plugin validate . --strict` already fails at the base commit on an upstream warning (`CLAUDE.md at the plugin root is not loaded`); require only that it reports nothing new. **Step 3: Commit** `feat(skills): add planning and execution skills`

---

### Task 11: Install and acceptance run (with the user)

**Files:**
- Create: `docs/superpowers/plans/2026-10-27-m6-acceptance.md` (results log)

- [ ] **Step 1: Install in Claude Code** from this checkout, before the `gyrospec/marketplace` repository exists: start sessions with `claude --plugin-dir <this repo>/skills/gyrospec --plugin-dir <this repo>` so both `gyrospec` and `mattpocock-skills` load from the working tree. Verify the eight Gyrospec skills appear. Once the user has created `gyrospec/marketplace` (local mode spec 7.3) and this branch is on `gyrospec/skills` `main`, repeat with `/plugin marketplace add gyrospec/marketplace`, `/plugin install gyrospec@gyrospec`, `/plugin install mattpocock-skills@gyrospec`.
- [ ] **Step 2: Install for Codex:** symlink (or copy on Windows without symlink rights) each `skills/gyrospec/<skill>` and the upstream `grilling`, `prototype`, `tdd`, `code-review`, `domain-modeling` folders into `~/.agents/skills`. Verify `codex` lists the Gyrospec skills.
- [ ] **Step 3: STOP and run the acceptance feature with the user** in a throwaway product repository chosen by the user: `/gyro-discovery` through `/gyro-executing-plans` for one sub-ticket in Claude Code (the user answers the interview and gives every approval), then `/gyro-writing-plans` and `/gyro-executing-plans` for a second sub-ticket in Codex. This needs the user's answers and approvals at each gate; do not simulate them.
- [ ] **Step 4: Record results** in the acceptance log: each phase, its outcome, `gyro status` after it, every deviation, and the defects found (each becomes a follow-up). The milestone passes when local mode spec section 2 holds.
- [ ] **Step 5: Commit** `docs: record the M6 acceptance run`
