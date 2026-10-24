# M1 `@pes/format` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `@pes/format` package, which parses PRDs, specs, and prototypes into REQ/AC indexes, validates the ID rules, and computes per-requirement diffs, with error text identical for every consumer.

**Architecture:** A pure TypeScript ESM library with no Node built-ins in `src/`, so the CLI, the server, and the browser editor can all use it. Markdown is scanned line by line (fence-aware). Prototype HTML is scanned with `htmlparser2`. Golden fixtures in `fixtures/` ship with the package so the CLI (M3) and the platform (M2) run the same cases.

**Tech Stack:** TypeScript (strict), Node 24, npm, Vitest, htmlparser2.

**Spec:** `docs/superpowers/specs/2026-10-25-product-engineering-skills-design.md` (sections 4, 5.2, 7, 8.2 item 4, 8.3, 12 row "Invalid format", 13 item 1)

## Global Constraints

- Package location: `packages/format/` in the `product-engineering-skills` repo. The package stands alone (its own `package.json` and `package-lock.json`). The upstream root `package.json` is **not** changed in M1.
- Package name `@pes/format`, version `0.1.0`, `"private": true` (npm publishing is decided in M3).
- `"type": "module"`. Build output goes to `dist/` (ESM plus `.d.ts`).
- `src/` must not import Node built-ins (`node:*`, `fs`, `crypto`, `path`). Tests may.
- The only runtime dependency is `htmlparser2`.
- ID format: `REQ-` or `AC-` followed by at least 3 digits, uppercase (`/^(REQ|AC)-\d{3,}$/`).
- Allowed statuses: `proposed`, `decided`, `verified`, `open`, `conflicted`, `not-applicable`, `removed`.
- Allowed criticality values: `blocker`, `major`, `minor`.
- Convention keywords (`REQ-`, `AC-`, `**Status:**`, `**Criticality:**`, `**Implements:**`, `data-req`, `data-screen`, and the allowed values) are matched in English only, whatever the document's language (spec section 4).
- Line numbers start at 1. Line `0` means "the whole document".
- Error text is produced **only** by `formatError` (Task 1). Consumers never build messages themselves. All messages are English.
- No em-dashes in prose, code comments, or README (repo `CLAUDE.md` rule).
- Commit style: `feat(format): ...` / `test(format): ...`.

## Review Focus

1. **CRLF and BOM input** (files from Windows editors): parse results, line numbers, and fingerprints must equal the LF version exactly. Tested in Task 2 and Task 3.
2. **REQ-like headings or lines inside code fences** (examples in a PRD): ignored, never treated as a new requirement or a duplicate. Tested in Task 2 and Task 3.
3. **An empty document or a PRD with no REQ at all:** an empty index with no errors and no crash. Tested in Task 3.
4. **Messy `**Implements:**` writing** such as `REQ-001,REQ-003.` or extra spaces: every ID is still read. Tested in Task 5.
5. **`data-req` with extra whitespace, single quotes, or an uppercase attribute name:** read the same way. Tested in Task 6.

---

## File structure

```
packages/format/
├── package.json
├── package-lock.json
├── tsconfig.json              strict, noEmit (typecheck + tests)
├── tsconfig.build.json        emits dist/ from src/ only
├── .gitignore                 dist/, node_modules/
├── .gitattributes             keeps CRLF fixtures byte-exact
├── README.md
├── src/
│   ├── index.ts               public exports
│   ├── errors.ts              ErrorCode, FormatError, createError, formatError
│   ├── markdown.ts            scanLines (internal)
│   ├── prd.ts                 parsePrd, Requirement/PrdIndex types
│   ├── revision.ts            checkRevision, diffRequirements, findBlockers
│   ├── spec.ts                parseSpec, validateReferences
│   └── prototype.ts           parsePrototype, uncoveredRequirements
├── test/
│   ├── errors.test.ts
│   ├── markdown.test.ts
│   ├── prd.test.ts
│   ├── revision.test.ts
│   ├── spec.test.ts
│   ├── prototype.test.ts
│   └── fixtures.test.ts       golden fixture runner
└── fixtures/
    ├── prd/<case>/input.md + expected.json
    ├── diff/<case>/prev.md + next.md + expected.json
    ├── spec/<case>/prd.md + input.md + expected.json
    └── prototype/<case>/prd.md + input.html + expected.json
```

Every command below runs from `packages/format/`.

---

### Task 1: Package scaffold and error model

**Files:**
- Create: `packages/format/package.json`, `tsconfig.json`, `tsconfig.build.json`, `.gitignore`, `src/errors.ts`, `src/index.ts`
- Test: `packages/format/test/errors.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ErrorCode =
    | "DUPLICATE_ID" | "AC_OUTSIDE_REQ" | "MISSING_STATUS" | "MISSING_CRITICALITY"
    | "UNKNOWN_STATUS" | "UNKNOWN_CRITICALITY" | "UNKNOWN_REFERENCE" | "REFERENCE_TO_REMOVED"
    | "ID_DELETED" | "ID_REUSED" | "EMPTY_IMPLEMENTS" | "INVALID_DATA_REQ" | "DUPLICATE_SCREEN";
  export interface FormatError { code: ErrorCode; line: number; message: string }
  export function createError(code: ErrorCode, line: number, params: Record<string, string | number>): FormatError;
  export function formatError(error: FormatError): string;
  ```

- [ ] **Step 1: Create `package.json`**

  Fields: `name: "@pes/format"`, `version: "0.1.0"`, `private: true`, `type: "module"`, `license: "MIT"`, `main: "./dist/index.js"`, `types: "./dist/index.d.ts"`, `exports: { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }, "./fixtures/*": "./fixtures/*" }`, `files: ["dist", "fixtures"]`, scripts `test: "vitest run"`, `typecheck: "tsc --noEmit"`, `build: "tsc -p tsconfig.build.json"`.

- [ ] **Step 2: Install dependencies**

  Run: `npm install htmlparser2 && npm install --save-dev typescript vitest @types/node`
  Expected: `package-lock.json` is created, no errors.

- [ ] **Step 3: Create `tsconfig.json` and `tsconfig.build.json`**

  `tsconfig.json`: `strict: true`, `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `noEmit: true`, `noUncheckedIndexedAccess: true`, `lib: ["ES2022"]` (no `DOM`, so accidental browser API use in `src/` fails the typecheck), `include: ["src", "test"]`. `tsconfig.build.json` extends it with `noEmit: false`, `declaration: true`, `outDir: "dist"`, `include: ["src"]`, `types: []`. `.gitignore` holds `dist/` and `node_modules/`.

- [ ] **Step 4: Write the failing test**

  ```ts
  import { describe, it, expect } from "vitest";
  import { createError, formatError } from "../src/errors.js";

  describe("createError", () => {
    it("fills the DUPLICATE_ID template", () => {
      expect(createError("DUPLICATE_ID", 12, { id: "REQ-001", firstLine: 3 })).toEqual({
        code: "DUPLICATE_ID", line: 12, message: "Duplicate ID REQ-001, first defined on line 3",
      });
    });
  });

  describe("formatError", () => {
    it("prefixes the line number and appends the code", () => {
      const e = createError("MISSING_STATUS", 7, { id: "REQ-002" });
      expect(formatError(e)).toBe("line 7: REQ-002 has no **Status:** field [MISSING_STATUS]");
    });
    it("uses 'document' for line 0", () => {
      const e = createError("ID_DELETED", 0, { id: "REQ-004" });
      expect(formatError(e)).toBe(
        "document: REQ-004 was deleted; mark it **Status:** removed instead [ID_DELETED]",
      );
    });
  });
  ```

- [ ] **Step 5: Run the test to verify it fails**

  Run: `npx vitest run test/errors.test.ts`
  Expected: FAIL because `../src/errors.js` does not exist.

- [ ] **Step 6: Implement `src/errors.ts`**

  Message templates (exact text, `{x}` is filled from `params`):

  | Code | Template |
  |---|---|
  | DUPLICATE_ID | `Duplicate ID {id}, first defined on line {firstLine}` |
  | AC_OUTSIDE_REQ | `{id} is not inside a REQ block` |
  | MISSING_STATUS | `{id} has no **Status:** field` |
  | MISSING_CRITICALITY | `{id} has no **Criticality:** field` |
  | UNKNOWN_STATUS | `{id} has unknown status "{value}"; allowed: proposed, decided, verified, open, conflicted, not-applicable, removed` |
  | UNKNOWN_CRITICALITY | `{id} has unknown criticality "{value}"; allowed: blocker, major, minor` |
  | UNKNOWN_REFERENCE | `{id} does not exist in the PRD` |
  | REFERENCE_TO_REMOVED | `{id} is removed in the PRD` |
  | ID_DELETED | `{id} was deleted; mark it **Status:** removed instead` |
  | ID_REUSED | `{id} was removed and cannot be reused` |
  | EMPTY_IMPLEMENTS | `**Implements:** lists no REQ IDs` |
  | INVALID_DATA_REQ | `"{value}" in data-req is not a REQ ID` |
  | DUPLICATE_SCREEN | `Duplicate screen "{name}", first defined on line {firstLine}` |

  `formatError` returns `line {line}: {message} [{code}]`, or `document: {message} [{code}]` when `line === 0`. `src/index.ts` re-exports `errors.ts`.

- [ ] **Step 7: Run the test and the typecheck**

  Run: `npx vitest run test/errors.test.ts && npm run typecheck`
  Expected: PASS, typecheck clean.

- [ ] **Step 8: Commit**

  ```bash
  git add packages/format
  git commit -m "feat(format): scaffold @pes/format with error model"
  ```

---

### Task 2: Markdown line scanner

**Files:**
- Create: `packages/format/src/markdown.ts`
- Test: `packages/format/test/markdown.test.ts`

**Interfaces:**
- Produces (internal, not exported from `index.ts`):
  ```ts
  export interface ScannedLine {
    number: number;            // 1-based
    text: string;              // without the line ending
    inFence: boolean;          // true for the opening, inner, and closing fence lines
    heading: { level: number; text: string } | null;  // always null when inFence
  }
  export function scanLines(source: string): ScannedLine[];
  ```

- [ ] **Step 1: Write the failing test**

  ```ts
  import { describe, it, expect } from "vitest";
  import { scanLines } from "../src/markdown.js";

  describe("scanLines", () => {
    it("detects ATX headings with level and trimmed text", () => {
      const [l] = scanLines("### REQ-001 Title  ##");
      expect(l!.heading).toEqual({ level: 3, text: "REQ-001 Title" });
    });
    it("marks fenced lines and ignores headings inside ``` and ~~~ fences", () => {
      const lines = scanLines("a\n```\n### REQ-009 x\n```\n~~~\n# y\n~~~\nb");
      expect(lines.map((l) => l.inFence)).toEqual([false, true, true, true, true, true, true, false]);
      expect(lines.filter((l) => l.inFence).every((l) => l.heading === null)).toBe(true);
    });
    it("treats CRLF, lone CR, and a leading BOM like LF", () => {
      const lf = scanLines("# A\nx\n## B");
      expect(scanLines("﻿# A\r\nx\r\n## B")).toEqual(lf);
      expect(scanLines("# A\rx\r## B")).toEqual(lf);
    });
    it("numbers lines from 1 and returns one line for empty input", () => {
      expect(scanLines("")).toEqual([{ number: 1, text: "", inFence: false, heading: null }]);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx vitest run test/markdown.test.ts`
  Expected: FAIL because `scanLines` does not exist.

- [ ] **Step 3: Implement `scanLines` in `src/markdown.ts`**

  Strip a leading BOM, then split on `/\r\n|\r|\n/`. A fence opens on a line matching `/^ {0,3}(```|~~~)/` and closes on the next line starting with the same marker (``` closes only ```, ~~~ closes only ~~~). Headings match `/^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/`, outside fences only.

- [ ] **Step 4: Run the test to verify it passes**

  Run: `npx vitest run test/markdown.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/format/src/markdown.ts packages/format/test/markdown.test.ts
  git commit -m "feat(format): add fence-aware markdown line scanner"
  ```

---

### Task 3: PRD parser

**Files:**
- Create: `packages/format/src/prd.ts`
- Modify: `packages/format/src/index.ts` (export `parsePrd` and its types)
- Test: `packages/format/test/prd.test.ts`

**Interfaces:**
- Consumes: `scanLines` (Task 2), `createError` (Task 1).
- Produces:
  ```ts
  export type RequirementStatus = "proposed" | "decided" | "verified" | "open" | "conflicted" | "not-applicable" | "removed";
  export type Criticality = "blocker" | "major" | "minor";
  export interface AcceptanceCriterion { id: string; text: string; line: number }
  export interface Requirement {
    id: string; title: string; line: number;
    status: RequirementStatus | null; criticality: Criticality | null;
    statement: string;
    acceptanceCriteria: AcceptanceCriterion[];
    fingerprint: string;
  }
  export interface PrdIndex { requirements: Requirement[]; errors: FormatError[] }
  export function parsePrd(source: string): PrdIndex;
  ```

**Parse rules:**
- A REQ heading is a heading whose text matches `/^(REQ-\d{3,})\b\s*(.*)$/`. The second group is the `title`.
- A REQ block ends at the next heading whose level is `<=` the REQ heading's level, or at the next REQ heading.
- Inside a block, for lines outside fences (fenced lines are ignored entirely):
  - `**Status:**` is read with `/\*\*Status:\*\*\s*([A-Za-z-]+)/`.
  - `**Criticality:**` is read with `/\*\*Criticality:\*\*\s*([A-Za-z-]+)/`. Both may sit on the same line.
  - AC lines match `/^\s*[-*]\s+\[(AC-\d{3,})\]\s*(.*)$/`.
  - Every other non-empty, non-heading line goes into `statement`.
- `statement` is the trimmed statement lines joined with one space, with runs of whitespace collapsed. `title` and AC text are trimmed and collapsed the same way.
- `fingerprint = JSON.stringify([title, statement, status, criticality, acceptanceCriteria.map(a => [a.id, a.text])])`.
- An unknown status or criticality value yields `UNKNOWN_*` and the field is `null`. A missing field yields `MISSING_*`, reported on the REQ heading line.
- An AC line outside any REQ block yields `AC_OUTSIDE_REQ` and belongs to no requirement.
- REQ and AC IDs share one namespace for duplicate checks. A second occurrence yields `DUPLICATE_ID` (with `firstLine`) and is left out of the index. A duplicate REQ block is skipped entirely, so its contents produce no other errors.
- `errors` are ordered by line (stable sort). On the same line, the status error comes before the criticality error.

- [ ] **Step 1: Write the failing test**

  ```ts
  import { describe, it, expect } from "vitest";
  import { parsePrd } from "../src/prd.js";

  const PRD = [
    "# PRD",                                                          // 1
    "### REQ-001 Agreement required before Product Order",            // 2
    "A Product Order can only be created",                            // 3
    "when its Agreement is Approved.",                                // 4
    "**Status:** decided · **Criticality:** blocker",                 // 5
    "- [AC-001] Given a Draft Agreement, then it is rejected",        // 6
    "- [AC-002] Given an Approved Agreement, then it is accepted",    // 7
    "### REQ-002 Second",                                             // 8
    "**Status:** open · **Criticality:** minor",                      // 9
  ].join("\n");

  describe("parsePrd", () => {
    it("indexes requirements, fields, and acceptance criteria with lines", () => {
      const { requirements, errors } = parsePrd(PRD);
      expect(errors).toEqual([]);
      expect(requirements.map((r) => r.id)).toEqual(["REQ-001", "REQ-002"]);
      const r = requirements[0]!;
      expect(r).toMatchObject({
        title: "Agreement required before Product Order", line: 2,
        status: "decided", criticality: "blocker",
        statement: "A Product Order can only be created when its Agreement is Approved.",
      });
      expect(r.acceptanceCriteria).toEqual([
        { id: "AC-001", text: "Given a Draft Agreement, then it is rejected", line: 6 },
        { id: "AC-002", text: "Given an Approved Agreement, then it is accepted", line: 7 },
      ]);
    });

    it("gives CRLF and LF input the same index", () => {
      expect(parsePrd(PRD.replace(/\n/g, "\r\n"))).toEqual(parsePrd(PRD));
    });

    it("keeps the fingerprint stable across whitespace-only changes", () => {
      const spaced = PRD.replace("can only be created", "can   only be created  ");
      expect(parsePrd(spaced).requirements[0]!.fingerprint).toBe(parsePrd(PRD).requirements[0]!.fingerprint);
    });

    it("ignores REQ headings inside code fences", () => {
      const src = PRD + "\n```\n### REQ-001 example\n```";
      expect(parsePrd(src)).toEqual(parsePrd(PRD));
    });

    it("returns an empty index for empty input and a PRD without REQs", () => {
      expect(parsePrd("")).toEqual({ requirements: [], errors: [] });
      expect(parsePrd("# Title\nprose only")).toEqual({ requirements: [], errors: [] });
    });

    it("reads English keywords inside a non-English PRD", () => {
      const id = parsePrd("### REQ-001 Agreement wajib\nProduct Order ditolak.\n**Status:** decided · **Criticality:** major");
      expect(id.errors).toEqual([]);
      expect(id.requirements[0]!.status).toBe("decided");
    });

    it("reports rule violations with codes and lines", () => {
      const src = [
        "- [AC-009] stray",                          // 1 AC_OUTSIDE_REQ
        "### REQ-001 A",                             // 2
        "**Status:** maybe · **Criticality:** huge", // 3 UNKNOWN_STATUS, UNKNOWN_CRITICALITY
        "### REQ-002 B",                             // 4 MISSING_STATUS, MISSING_CRITICALITY
        "### REQ-001 C",                             // 5 DUPLICATE_ID
        "**Status:** open · **Criticality:** minor", // 6 skipped with the duplicate block
      ].join("\n");
      const { errors, requirements } = parsePrd(src);
      expect(errors.map((e) => [e.code, e.line])).toEqual([
        ["AC_OUTSIDE_REQ", 1],
        ["UNKNOWN_STATUS", 3], ["UNKNOWN_CRITICALITY", 3],
        ["MISSING_STATUS", 4], ["MISSING_CRITICALITY", 4],
        ["DUPLICATE_ID", 5],
      ]);
      expect(requirements.map((r) => r.id)).toEqual(["REQ-001", "REQ-002"]);
      expect(requirements[0]!.status).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx vitest run test/prd.test.ts`
  Expected: FAIL because `parsePrd` does not exist.

- [ ] **Step 3: Implement `parsePrd(source: string): PrdIndex` in `src/prd.ts` following the parse rules above, and export it from `src/index.ts`**

- [ ] **Step 4: Run the test and the typecheck**

  Run: `npx vitest run test/prd.test.ts && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/format/src packages/format/test/prd.test.ts
  git commit -m "feat(format): parse PRD requirements and acceptance criteria"
  ```

---

### Task 4: Revision rules, diff, and blockers

**Files:**
- Create: `packages/format/src/revision.ts`
- Modify: `packages/format/src/index.ts`
- Test: `packages/format/test/revision.test.ts`

**Interfaces:**
- Consumes: `PrdIndex`, `Requirement` (Task 3), `createError` (Task 1).
- Produces:
  ```ts
  export interface RequirementDiff { added: string[]; changed: string[]; removed: string[] }
  export function checkRevision(previous: PrdIndex, next: PrdIndex): FormatError[];
  export function diffRequirements(previous: PrdIndex, next: PrdIndex): RequirementDiff;
  export function findBlockers(prd: PrdIndex): Requirement[];
  ```

**Rules:**
- `checkRevision`:
  - Every REQ in `previous` that is missing from `next` yields `ID_DELETED` on line 0.
  - A REQ that is `removed` in `previous` but not `removed` in `next` yields `ID_REUSED` on that REQ's line in `next`.
  - Only REQ IDs are checked. Removing an AC already shows up as a fingerprint change.
- `diffRequirements`:
  - `added`: REQs in `next` but not in `previous`, whose status is not `removed`.
  - `removed`: REQs not `removed` in `previous` that are `removed` or missing in `next`.
  - `changed`: REQs present in both, `removed` in neither, with different fingerprints.
  - Order follows appearance in `next`. Missing REQs follow `previous` order and come last.
- `findBlockers`: REQs with `criticality === "blocker"` and status `open` or `conflicted` (spec 8.2 item 4).

- [ ] **Step 1: Write the failing test**

  ```ts
  import { describe, it, expect } from "vitest";
  import { parsePrd } from "../src/prd.js";
  import { checkRevision, diffRequirements, findBlockers } from "../src/revision.js";

  const req = (id: string, body: string, status = "decided", crit = "major") =>
    `### ${id} Title ${id}\n${body}\n**Status:** ${status} · **Criticality:** ${crit}`;
  const prd = (...blocks: string[]) => parsePrd(["# PRD", ...blocks].join("\n"));

  describe("diffRequirements", () => {
    it("classifies added, changed, and removed requirements", () => {
      const prev = prd(req("REQ-001", "a"), req("REQ-002", "b"), req("REQ-003", "c"));
      const next = prd(req("REQ-001", "a"), req("REQ-002", "b changed"), req("REQ-003", "c", "removed"), req("REQ-004", "d"));
      expect(diffRequirements(prev, next)).toEqual({ added: ["REQ-004"], changed: ["REQ-002"], removed: ["REQ-003"] });
    });
    it("returns an empty diff when only prose outside REQ blocks changes", () => {
      const prev = parsePrd(`# PRD\nOld intro\n${req("REQ-001", "a")}`);
      const next = parsePrd(`# PRD\nA much longer new intro\n${req("REQ-001", "a")}`);
      expect(diffRequirements(prev, next)).toEqual({ added: [], changed: [], removed: [] });
    });
  });

  describe("checkRevision", () => {
    it("rejects deleting a REQ instead of marking it removed", () => {
      const errs = checkRevision(prd(req("REQ-001", "a"), req("REQ-002", "b")), prd(req("REQ-001", "a")));
      expect(errs.map((e) => [e.code, e.line, e.message])).toEqual([
        ["ID_DELETED", 0, "REQ-002 was deleted; mark it **Status:** removed instead"],
      ]);
    });
    it("rejects reviving a removed REQ", () => {
      const errs = checkRevision(prd(req("REQ-001", "a", "removed")), prd(req("REQ-001", "new meaning")));
      expect(errs.map((e) => [e.code, e.line])).toEqual([["ID_REUSED", 2]]);
    });
  });

  describe("findBlockers", () => {
    it("returns open or conflicted blockers only", () => {
      const p = prd(req("REQ-001", "a", "open", "blocker"), req("REQ-002", "b", "conflicted", "blocker"),
        req("REQ-003", "c", "decided", "blocker"), req("REQ-004", "d", "open", "major"));
      expect(findBlockers(p).map((r) => r.id)).toEqual(["REQ-001", "REQ-002"]);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx vitest run test/revision.test.ts`
  Expected: FAIL because `../src/revision.js` does not exist.

- [ ] **Step 3: Implement the three functions in `src/revision.ts` following the rules above, and export them from `src/index.ts`**

- [ ] **Step 4: Run the test to verify it passes**

  Run: `npx vitest run test/revision.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/format/src packages/format/test/revision.test.ts
  git commit -m "feat(format): add revision rules, requirement diff, and blockers"
  ```

---

### Task 5: Spec parser and reference validation

**Files:**
- Create: `packages/format/src/spec.ts`
- Modify: `packages/format/src/index.ts`
- Test: `packages/format/test/spec.test.ts`

**Interfaces:**
- Consumes: `scanLines` (Task 2), `PrdIndex` (Task 3), `createError` (Task 1).
- Produces:
  ```ts
  export interface Reference { id: string; line: number }
  export interface SpecSection { heading: string; line: number; implements: Reference[] }
  export interface SpecIndex { sections: SpecSection[]; errors: FormatError[] }
  export function parseSpec(source: string): SpecIndex;
  export function validateReferences(prd: PrdIndex, references: Reference[]): FormatError[];
  ```

**Rules:**
- Every heading outside a fence opens a new `SpecSection` with `heading` = the heading text and `line` = its line.
- A line outside a fence matching `/\*\*Implements:\*\*(.*)$/` adds references to the latest section. IDs are taken with `/REQ-\d{3,}/g` from the rest of the line.
- References before the first heading go into a `{ heading: "", line: 0 }` section, created only when it has content.
- Sections without `Implements` still appear in `sections` with `implements: []`.
- An `**Implements:**` line with no ID yields `EMPTY_IMPLEMENTS`.
- `validateReferences`:
  - An ID that does not exist in the PRD yields `UNKNOWN_REFERENCE`.
  - An ID whose PRD status is `removed` yields `REFERENCE_TO_REMOVED`.
  - Errors use the reference's `line`, in input order.

- [ ] **Step 1: Write the failing test**

  ```ts
  import { describe, it, expect } from "vitest";
  import { parsePrd } from "../src/prd.js";
  import { parseSpec, validateReferences } from "../src/spec.js";

  const PRD = parsePrd([
    "### REQ-001 A", "**Status:** decided · **Criticality:** major",
    "### REQ-002 B", "**Status:** removed · **Criticality:** minor",
    "### REQ-003 C", "**Status:** decided · **Criticality:** minor",
  ].join("\n"));

  describe("parseSpec", () => {
    it("collects Implements references per section, tolerating messy separators", () => {
      const spec = parseSpec(["# Spec", "## Order API", "**Implements:** REQ-001,REQ-003.", "## Notes"].join("\n"));
      expect(spec.errors).toEqual([]);
      expect(spec.sections).toEqual([
        { heading: "Spec", line: 1, implements: [] },
        { heading: "Order API", line: 2, implements: [{ id: "REQ-001", line: 3 }, { id: "REQ-003", line: 3 }] },
        { heading: "Notes", line: 4, implements: [] },
      ]);
    });
    it("ignores Implements lines inside code fences", () => {
      expect(parseSpec("## A\n```\n**Implements:** REQ-999\n```").sections[0]!.implements).toEqual([]);
    });
    it("reports an Implements line without IDs", () => {
      expect(parseSpec("## A\n**Implements:** later").errors.map((e) => [e.code, e.line])).toEqual([["EMPTY_IMPLEMENTS", 2]]);
    });
  });

  describe("validateReferences", () => {
    it("flags unknown and removed references", () => {
      const refs = [{ id: "REQ-001", line: 3 }, { id: "REQ-002", line: 4 }, { id: "REQ-404", line: 5 }];
      expect(validateReferences(PRD, refs).map((e) => [e.code, e.line])).toEqual([
        ["REFERENCE_TO_REMOVED", 4], ["UNKNOWN_REFERENCE", 5],
      ]);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx vitest run test/spec.test.ts`
  Expected: FAIL because `../src/spec.js` does not exist.

- [ ] **Step 3: Implement `parseSpec` and `validateReferences` in `src/spec.ts`, and export them from `src/index.ts`**

- [ ] **Step 4: Run the test to verify it passes**

  Run: `npx vitest run test/spec.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/format/src packages/format/test/spec.test.ts
  git commit -m "feat(format): parse spec Implements references and validate them"
  ```

---

### Task 6: Prototype parser and requirement coverage

**Files:**
- Create: `packages/format/src/prototype.ts`
- Modify: `packages/format/src/index.ts`
- Test: `packages/format/test/prototype.test.ts`

**Interfaces:**
- Consumes: `Reference` (Task 5), `PrdIndex` (Task 3), `createError` (Task 1), `htmlparser2`.
- Produces:
  ```ts
  export interface PrototypeScreen { name: string; line: number; reqIds: string[] }
  export interface PrototypeReference extends Reference { screen: string | null }
  export interface PrototypeIndex { screens: PrototypeScreen[]; references: PrototypeReference[]; errors: FormatError[] }
  export function parsePrototype(html: string): PrototypeIndex;
  export function uncoveredRequirements(prd: PrdIndex, prototype: PrototypeIndex): string[];
  ```

**Rules:**
- Normalize line endings like `scanLines`, then turn each tag's `startIndex` into a line number through a line-offset table.
- An element with `data-screen` opens a screen whose `name` is the trimmed attribute value. The screen closes on that element's `onclosetag`. Keep a stack of open elements so a `data-req` inside nested markup is recorded against the nearest enclosing screen.
- A repeated screen name yields `DUPLICATE_SCREEN` (with `firstLine`), and the second screen is left out of `screens`.
- A `data-req` value is split on `/\s+/`. Tokens matching `/^REQ-\d{3,}$/` become references. Any other token yields `INVALID_DATA_REQ`.
- Each screen's `reqIds` are unique, in order of appearance. References outside any screen have `screen: null`.
- `uncoveredRequirements`: REQ IDs whose status is neither `removed` nor `not-applicable` and that never appear in `references`, in PRD order.

- [ ] **Step 1: Write the failing test**

  ```ts
  import { describe, it, expect } from "vitest";
  import { parsePrd } from "../src/prd.js";
  import { parsePrototype, uncoveredRequirements } from "../src/prototype.js";

  const HTML = [
    "<!doctype html><html><body>",                                   // 1
    '<section data-screen="order-form">',                            // 2
    '  <button data-req="REQ-001   REQ-003">Create</button>',        // 3
    "  <img src=x.png>",                                             // 4
    "  <p DATA-REQ='REQ-001'>x</p>",                                 // 5
    "</section>",                                                    // 6
    '<footer data-req="REQ-002 req-7"></footer>',                    // 7
    '<div data-screen="order-form"></div>',                          // 8
    "</body></html>",
  ].join("\r\n");

  describe("parsePrototype", () => {
    it("maps data-req to screens with lines, tolerating spacing, quotes, and case", () => {
      const p = parsePrototype(HTML);
      expect(p.screens).toEqual([{ name: "order-form", line: 2, reqIds: ["REQ-001", "REQ-003"] }]);
      expect(p.references).toEqual([
        { id: "REQ-001", line: 3, screen: "order-form" },
        { id: "REQ-003", line: 3, screen: "order-form" },
        { id: "REQ-001", line: 5, screen: "order-form" },
        { id: "REQ-002", line: 7, screen: null },
      ]);
    });
    it("reports invalid tokens and duplicate screens", () => {
      expect(parsePrototype(HTML).errors.map((e) => [e.code, e.line])).toEqual([
        ["INVALID_DATA_REQ", 7], ["DUPLICATE_SCREEN", 8],
      ]);
    });
  });

  describe("uncoveredRequirements", () => {
    it("lists active requirements without any data-req", () => {
      const prd = parsePrd([
        "### REQ-001 A", "**Status:** decided · **Criticality:** major",
        "### REQ-004 D", "**Status:** decided · **Criticality:** major",
        "### REQ-005 E", "**Status:** not-applicable · **Criticality:** minor",
        "### REQ-006 F", "**Status:** removed · **Criticality:** minor",
      ].join("\n"));
      expect(uncoveredRequirements(prd, parsePrototype(HTML))).toEqual(["REQ-004"]);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx vitest run test/prototype.test.ts`
  Expected: FAIL because `../src/prototype.js` does not exist.

- [ ] **Step 3: Implement `parsePrototype` and `uncoveredRequirements` in `src/prototype.ts` with `htmlparser2`'s `Parser` (`onopentag`, `onclosetag`, and `parser.startIndex`), and export them from `src/index.ts`**

- [ ] **Step 4: Run the test to verify it passes**

  Run: `npx vitest run test/prototype.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/format/src packages/format/test/prototype.test.ts
  git commit -m "feat(format): parse prototype screens and data-req coverage"
  ```

---

### Task 7: Golden fixtures, public API, and build

**Files:**
- Create: `packages/format/fixtures/**`, `packages/format/.gitattributes`, `packages/format/test/fixtures.test.ts`, `packages/format/README.md`
- Modify: `packages/format/src/index.ts` (complete the exports)

**Interfaces:**
- Consumes: every public function from Tasks 1, 3, 4, 5, and 6.
- Produces: the fixture contract for M2 and M3. Each case is one folder, and `expected.json` per kind is:
  - `prd/<case>/`: `input.md` → `{ "ids": string[], "errors": string[] }`
  - `diff/<case>/`: `prev.md`, `next.md` → `{ "diff": RequirementDiff, "errors": string[] }` (`errors` from `checkRevision`)
  - `spec/<case>/`: `prd.md`, `input.md` → `{ "sections": { "heading": string, "implements": string[] }[], "errors": string[] }` (`errors` = `parseSpec` errors + `validateReferences`)
  - `prototype/<case>/`: `prd.md`, `input.html` → `{ "screens": PrototypeScreen[], "uncovered": string[], "errors": string[] }` (`errors` = `parsePrototype` errors + `validateReferences`)

  `ids` lists REQ and AC IDs in document order. `errors` are always `formatError` output ordered by line, so the fixtures also lock the message text.

- [ ] **Step 1: Create the fixtures**

  At least one case per error code and one valid case per kind:
  - `prd/valid-basic`, `prd/crlf-bom` (saved with CRLF and a BOM; `.gitattributes` gets `fixtures/**/crlf-*/** -text` so git keeps the bytes), `prd/fenced-example`, `prd/non-english-prose`, `prd/duplicate-id`, `prd/ac-outside-req`, `prd/missing-fields`, `prd/unknown-values`
  - `diff/prose-only`, `diff/added-changed-removed`, `diff/deleted-id`, `diff/reused-id`
  - `spec/valid`, `spec/unknown-and-removed`, `spec/empty-implements`
  - `prototype/valid`, `prototype/invalid-token`, `prototype/duplicate-screen`

- [ ] **Step 2: Write the runner `test/fixtures.test.ts`**

  Read every folder under `fixtures/<kind>/` with `node:fs`. For each case, register `it("<kind>/<case>")` that runs the public functions from `../src/index.js` and compares the result with `expected.json` using `toEqual`.

- [ ] **Step 3: Run the whole suite**

  Run: `npm test`
  Expected: PASS, including one test per fixture folder. If a case fails, change `expected.json` only when the code already follows the rules in Tasks 3 to 6. Otherwise fix the code.

- [ ] **Step 4: Build and inspect the package contents**

  Run: `npm run build && npm pack --dry-run`
  Expected: the build is clean. The file list contains `dist/index.js`, `dist/index.d.ts`, and `fixtures/`, and contains neither `src/` nor `test/`.

- [ ] **Step 5: Confirm `src/` has no Node imports**

  Run: `grep -rnE "from \"(node:|fs|path|crypto)" src || echo clean`
  Expected: `clean`.

- [ ] **Step 6: Write `README.md`**

  Contents: the package's purpose (one paragraph), the public functions with a one-line description each, the format conventions with a pointer to spec section 7, the English-only keyword rule (spec section 4), and how another package uses the fixtures (`@pes/format/fixtures/...`). No em-dashes.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/format
  git commit -m "test(format): add golden fixtures, public API, and README"
  ```
