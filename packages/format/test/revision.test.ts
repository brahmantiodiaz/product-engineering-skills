import { describe, it, expect } from "vitest";
import { parsePrd } from "../src/prd.js";
import { checkRevision, diffRequirements, findBlockers } from "../src/revision.js";

const req = (id: string, body: string, status = "decided", crit = "major") =>
  `### ${id} Title ${id}\n${body}\n**Status:** ${status} · **Criticality:** ${crit}`;
const prd = (...blocks: string[]) => parsePrd(["# PRD", ...blocks].join("\n"));

describe("diffRequirements", () => {
  it("classifies added, changed, and removed requirements", () => {
    const prev = prd(req("REQ-001", "a"), req("REQ-002", "b"), req("REQ-003", "c"));
    const next = prd(
      req("REQ-001", "a"),
      req("REQ-002", "b changed"),
      req("REQ-003", "c", "removed"),
      req("REQ-004", "d"),
    );
    expect(diffRequirements(prev, next)).toEqual({
      added: ["REQ-004"],
      changed: ["REQ-002"],
      removed: ["REQ-003"],
    });
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
    const p = prd(
      req("REQ-001", "a", "open", "blocker"),
      req("REQ-002", "b", "conflicted", "blocker"),
      req("REQ-003", "c", "decided", "blocker"),
      req("REQ-004", "d", "open", "major"),
    );
    expect(findBlockers(p).map((r) => r.id)).toEqual(["REQ-001", "REQ-002"]);
  });
});
