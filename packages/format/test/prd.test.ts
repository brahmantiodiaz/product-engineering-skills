import { describe, it, expect } from "vitest";
import { parsePrd } from "../src/prd.js";

const PRD = [
  "# PRD", // 1
  "### REQ-001 Agreement required before Product Order", // 2
  "A Product Order can only be created", // 3
  "when its Agreement is Approved.", // 4
  "**Status:** decided · **Criticality:** blocker", // 5
  "- [AC-001] Given a Draft Agreement, then it is rejected", // 6
  "- [AC-002] Given an Approved Agreement, then it is accepted", // 7
  "### REQ-002 Second", // 8
  "**Status:** open · **Criticality:** minor", // 9
].join("\n");

describe("parsePrd", () => {
  it("indexes requirements, fields, and acceptance criteria with lines", () => {
    const { requirements, errors } = parsePrd(PRD);
    expect(errors).toEqual([]);
    expect(requirements.map((r) => r.id)).toEqual(["REQ-001", "REQ-002"]);
    const r = requirements[0]!;
    expect(r).toMatchObject({
      title: "Agreement required before Product Order",
      line: 2,
      status: "decided",
      criticality: "blocker",
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
    const id = parsePrd(
      "### REQ-001 Agreement wajib\nProduct Order ditolak.\n**Status:** decided · **Criticality:** major",
    );
    expect(id.errors).toEqual([]);
    expect(id.requirements[0]!.status).toBe("decided");
  });

  it("reports rule violations with codes and lines", () => {
    const src = [
      "- [AC-009] stray", // 1 AC_OUTSIDE_REQ
      "### REQ-001 A", // 2
      "**Status:** maybe · **Criticality:** huge", // 3 UNKNOWN_STATUS, UNKNOWN_CRITICALITY
      "### REQ-002 B", // 4 MISSING_STATUS, MISSING_CRITICALITY
      "### REQ-001 C", // 5 DUPLICATE_ID
      "**Status:** open · **Criticality:** minor", // 6 skipped with the duplicate block
    ].join("\n");
    const { errors, requirements } = parsePrd(src);
    expect(errors.map((e) => [e.code, e.line])).toEqual([
      ["AC_OUTSIDE_REQ", 1],
      ["UNKNOWN_STATUS", 3],
      ["UNKNOWN_CRITICALITY", 3],
      ["MISSING_STATUS", 4],
      ["MISSING_CRITICALITY", 4],
      ["DUPLICATE_ID", 5],
    ]);
    expect(requirements.map((r) => r.id)).toEqual(["REQ-001", "REQ-002"]);
    expect(requirements[0]!.status).toBeNull();
  });
});
