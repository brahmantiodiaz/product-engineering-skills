import { describe, it, expect } from "vitest";
import { createError, formatError } from "../src/errors.js";

describe("createError", () => {
  it("fills the DUPLICATE_ID template", () => {
    expect(createError("DUPLICATE_ID", 12, { id: "REQ-001", firstLine: 3 })).toEqual({
      code: "DUPLICATE_ID",
      line: 12,
      message: "Duplicate ID REQ-001, first defined on line 3",
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
