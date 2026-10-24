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

  it("closes a fence only with the same character, at least as long, and no info string", () => {
    const backticks = scanLines(["````md", "```md", "### REQ-001 Example", "```", "````", "### REQ-001 Real"].join("\n"));
    expect(backticks.map((l) => l.inFence)).toEqual([true, true, true, true, true, false]);
    expect(backticks[5]!.heading).toEqual({ level: 3, text: "REQ-001 Real" });

    const tildes = scanLines(["~~~~", "~~~", "# inside", "~~~~", "# outside"].join("\n"));
    expect(tildes.map((l) => l.inFence)).toEqual([true, true, true, true, false]);
  });

  it("scans a very long heading line in linear time", () => {
    const text = "a" + " ".repeat(200_000) + "x";
    const start = performance.now();
    const [l] = scanLines("# " + text);
    expect(performance.now() - start).toBeLessThan(500);
    expect(l!.heading).toEqual({ level: 1, text });
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
