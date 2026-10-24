import { createError, type FormatError } from "./errors.js";
import type { PrdIndex, Requirement } from "./prd.js";

export interface RequirementDiff {
  added: string[];
  changed: string[];
  removed: string[];
}

const byId = (prd: PrdIndex) => new Map(prd.requirements.map((r) => [r.id, r]));
const isRemoved = (r: Requirement) => r.status === "removed";

/** Enforces that REQ IDs are never deleted or reused between revisions. */
export function checkRevision(previous: PrdIndex, next: PrdIndex): FormatError[] {
  const nextById = byId(next);
  const errors: FormatError[] = [];
  for (const before of previous.requirements) {
    const after = nextById.get(before.id);
    if (!after) {
      errors.push(createError("ID_DELETED", 0, { id: before.id }));
    } else if (isRemoved(before) && !isRemoved(after)) {
      errors.push(createError("ID_REUSED", after.line, { id: after.id }));
    }
  }
  return errors.sort((a, b) => a.line - b.line);
}

export function diffRequirements(previous: PrdIndex, next: PrdIndex): RequirementDiff {
  const prevById = byId(previous);
  const nextById = byId(next);
  const diff: RequirementDiff = { added: [], changed: [], removed: [] };

  for (const after of next.requirements) {
    const before = prevById.get(after.id);
    if (!before) {
      if (!isRemoved(after)) diff.added.push(after.id);
    } else if (!isRemoved(before) && isRemoved(after)) {
      diff.removed.push(after.id);
    } else if (!isRemoved(before) && before.fingerprint !== after.fingerprint) {
      diff.changed.push(after.id);
    }
  }
  for (const before of previous.requirements) {
    if (!nextById.has(before.id) && !isRemoved(before)) diff.removed.push(before.id);
  }
  return diff;
}

/** Requirements that block PRD approval (spec 8.2 item 4). */
export function findBlockers(prd: PrdIndex): Requirement[] {
  return prd.requirements.filter(
    (r) => r.criticality === "blocker" && (r.status === "open" || r.status === "conflicted"),
  );
}
