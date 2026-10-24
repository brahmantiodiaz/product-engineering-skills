import { createError, type FormatError } from "./errors.js";
import { scanLines } from "./markdown.js";
import type { PrdIndex } from "./prd.js";

export interface Reference {
  id: string;
  line: number;
}

export interface SpecSection {
  heading: string;
  line: number;
  implements: Reference[];
}

export interface SpecIndex {
  sections: SpecSection[];
  errors: FormatError[];
}

const IMPLEMENTS = /\*\*Implements:\*\*(.*)$/;
const REQ_ID = /REQ-\d{3,}/g;

export function parseSpec(source: string): SpecIndex {
  const sections: SpecSection[] = [];
  const errors: FormatError[] = [];
  let current: SpecSection | null = null;

  for (const line of scanLines(source)) {
    if (line.inFence) continue;
    if (line.heading) {
      current = { heading: line.heading.text, line: line.number, implements: [] };
      sections.push(current);
      continue;
    }
    const match = IMPLEMENTS.exec(line.text);
    if (!match) continue;

    const ids = match[1]!.match(REQ_ID) ?? [];
    if (ids.length === 0) {
      errors.push(createError("EMPTY_IMPLEMENTS", line.number, {}));
      continue;
    }
    if (!current) {
      // References before the first heading get a heading-less section.
      current = { heading: "", line: 0, implements: [] };
      sections.push(current);
    }
    for (const id of ids) current.implements.push({ id, line: line.number });
  }
  return { sections, errors };
}

export function validateReferences(prd: PrdIndex, references: Reference[]): FormatError[] {
  const statusById = new Map(prd.requirements.map((r) => [r.id, r.status]));
  const errors: FormatError[] = [];
  for (const ref of references) {
    if (!statusById.has(ref.id)) {
      errors.push(createError("UNKNOWN_REFERENCE", ref.line, { id: ref.id }));
    } else if (statusById.get(ref.id) === "removed") {
      errors.push(createError("REFERENCE_TO_REMOVED", ref.line, { id: ref.id }));
    }
  }
  return errors;
}
