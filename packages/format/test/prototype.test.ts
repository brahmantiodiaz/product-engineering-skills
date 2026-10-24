import { describe, it, expect } from "vitest";
import { parsePrd } from "../src/prd.js";
import { parsePrototype, uncoveredRequirements } from "../src/prototype.js";

const HTML = [
  "<!doctype html><html><body>", // 1
  '<section data-screen="order-form">', // 2
  '  <button data-req="REQ-001   REQ-003">Create</button>', // 3
  "  <img src=x.png>", // 4
  "  <p DATA-REQ='REQ-001'>x</p>", // 5
  "</section>", // 6
  '<footer data-req="REQ-002 req-7"></footer>', // 7
  '<div data-screen="order-form"></div>', // 8
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
      ["INVALID_DATA_REQ", 7],
      ["DUPLICATE_SCREEN", 8],
    ]);
  });
});

describe("uncoveredRequirements", () => {
  it("lists active requirements without any data-req", () => {
    const prd = parsePrd(
      [
        "### REQ-001 A",
        "**Status:** decided · **Criticality:** major",
        "### REQ-004 D",
        "**Status:** decided · **Criticality:** major",
        "### REQ-005 E",
        "**Status:** not-applicable · **Criticality:** minor",
        "### REQ-006 F",
        "**Status:** removed · **Criticality:** minor",
      ].join("\n"),
    );
    expect(uncoveredRequirements(prd, parsePrototype(HTML))).toEqual(["REQ-004"]);
  });
});
