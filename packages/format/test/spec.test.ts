import { describe, it, expect } from "vitest";
import { parsePrd } from "../src/prd.js";
import { parseSpec, validateReferences } from "../src/spec.js";

const PRD = parsePrd(
  [
    "### REQ-001 A",
    "**Status:** decided · **Criticality:** major",
    "### REQ-002 B",
    "**Status:** removed · **Criticality:** minor",
    "### REQ-003 C",
    "**Status:** decided · **Criticality:** minor",
  ].join("\n"),
);

describe("parseSpec", () => {
  it("collects Implements references per section, tolerating messy separators", () => {
    const spec = parseSpec(["# Spec", "## Order API", "**Implements:** REQ-001,REQ-003.", "## Notes"].join("\n"));
    expect(spec.errors).toEqual([]);
    expect(spec.sections).toEqual([
      { heading: "Spec", line: 1, implements: [] },
      {
        heading: "Order API",
        line: 2,
        implements: [
          { id: "REQ-001", line: 3 },
          { id: "REQ-003", line: 3 },
        ],
      },
      { heading: "Notes", line: 4, implements: [] },
    ]);
  });

  it("ignores Implements lines inside code fences", () => {
    expect(parseSpec("## A\n```\n**Implements:** REQ-999\n```").sections[0]!.implements).toEqual([]);
  });

  it("reports an Implements line without IDs", () => {
    expect(parseSpec("## A\n**Implements:** later").errors.map((e) => [e.code, e.line])).toEqual([
      ["EMPTY_IMPLEMENTS", 2],
    ]);
  });
});

describe("parseSpec near-miss Implements", () => {
  it("reports Implements fields that are not written as **Implements:**", () => {
    const spec = parseSpec(["## A", "**Implements**: REQ-001", "Implements: REQ-002", "The API implements: retries"].join("\n"));
    expect(spec.errors.map((e) => [e.code, e.line])).toEqual([
      ["MALFORMED_IMPLEMENTS", 2],
      ["MALFORMED_IMPLEMENTS", 3],
    ]);
    expect(spec.sections[0]!.implements).toEqual([]);
  });
});

describe("validateReferences", () => {
  it("flags unknown and removed references", () => {
    const refs = [
      { id: "REQ-001", line: 3 },
      { id: "REQ-002", line: 4 },
      { id: "REQ-404", line: 5 },
    ];
    expect(validateReferences(PRD, refs).map((e) => [e.code, e.line])).toEqual([
      ["REFERENCE_TO_REMOVED", 4],
      ["UNKNOWN_REFERENCE", 5],
    ]);
  });
});
