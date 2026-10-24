import { createError, type FormatError } from "./errors.js";
import { scanLines } from "./markdown.js";

export type RequirementStatus =
  | "proposed"
  | "decided"
  | "verified"
  | "open"
  | "conflicted"
  | "not-applicable"
  | "removed";

export type Criticality = "blocker" | "major" | "minor";

export interface AcceptanceCriterion {
  id: string;
  text: string;
  line: number;
}

export interface Requirement {
  id: string;
  title: string;
  line: number;
  status: RequirementStatus | null;
  criticality: Criticality | null;
  statement: string;
  acceptanceCriteria: AcceptanceCriterion[];
  fingerprint: string;
}

export interface PrdIndex {
  requirements: Requirement[];
  errors: FormatError[];
}

const STATUSES: readonly string[] = [
  "proposed",
  "decided",
  "verified",
  "open",
  "conflicted",
  "not-applicable",
  "removed",
];
const CRITICALITIES: readonly string[] = ["blocker", "major", "minor"];

const REQ_HEADING = /^(REQ-\d{3,})\b\s*(.*)$/;
const AC_LINE = /^\s*[-*]\s+\[(AC-\d{3,})\]\s*(.*)$/;
const STATUS_FIELD = /\*\*Status:\*\*\s*([A-Za-z-]+)/;
const CRITICALITY_FIELD = /\*\*Criticality:\*\*\s*([A-Za-z-]+)/;

interface Field {
  value: string;
  line: number;
}

interface OpenBlock {
  id: string;
  title: string;
  line: number;
  level: number;
  /** A duplicate REQ block is skipped entirely. */
  skip: boolean;
  status?: Field;
  criticality?: Field;
  statement: string[];
  acceptanceCriteria: AcceptanceCriterion[];
}

const collapse = (text: string) => text.trim().replace(/\s+/g, " ");

export function parsePrd(source: string): PrdIndex {
  const requirements: Requirement[] = [];
  const errors: FormatError[] = [];
  const seen = new Map<string, number>();
  let block: OpenBlock | null = null;

  const close = () => {
    if (block && !block.skip) {
      requirements.push(finish(block, errors));
    }
    block = null;
  };

  for (const line of scanLines(source)) {
    if (line.inFence) continue;

    if (line.heading) {
      const match = REQ_HEADING.exec(line.heading.text);
      if (match) {
        close();
        const id = match[1]!;
        const firstLine = seen.get(id);
        const skip = firstLine !== undefined;
        if (skip) {
          errors.push(createError("DUPLICATE_ID", line.number, { id, firstLine }));
        } else {
          seen.set(id, line.number);
        }
        block = {
          id,
          title: collapse(match[2]!),
          line: line.number,
          level: line.heading.level,
          skip,
          statement: [],
          acceptanceCriteria: [],
        };
      } else if (block && line.heading.level <= block.level) {
        close();
      }
      continue;
    }

    const current: OpenBlock | null = block;
    if (current?.skip) continue;

    const ac = AC_LINE.exec(line.text);
    if (ac) {
      const id = ac[1]!;
      if (!current) {
        errors.push(createError("AC_OUTSIDE_REQ", line.number, { id }));
        continue;
      }
      const firstLine = seen.get(id);
      if (firstLine !== undefined) {
        errors.push(createError("DUPLICATE_ID", line.number, { id, firstLine }));
        continue;
      }
      seen.set(id, line.number);
      current.acceptanceCriteria.push({ id, text: collapse(ac[2]!), line: line.number });
      continue;
    }

    if (!current) continue;

    const status = STATUS_FIELD.exec(line.text);
    const criticality = CRITICALITY_FIELD.exec(line.text);
    if (status || criticality) {
      if (status && !current.status) current.status = { value: status[1]!, line: line.number };
      if (criticality && !current.criticality) {
        current.criticality = { value: criticality[1]!, line: line.number };
      }
      continue;
    }

    if (line.text.trim() !== "") current.statement.push(line.text);
  }
  close();

  // Array.prototype.sort is stable, so same-line errors keep their emission order.
  errors.sort((a, b) => a.line - b.line);
  return { requirements, errors };
}

function finish(block: OpenBlock, errors: FormatError[]): Requirement {
  const status = readField(block, block.status, STATUSES, "MISSING_STATUS", "UNKNOWN_STATUS", errors);
  const criticality = readField(
    block,
    block.criticality,
    CRITICALITIES,
    "MISSING_CRITICALITY",
    "UNKNOWN_CRITICALITY",
    errors,
  );
  const statement = collapse(block.statement.join(" "));
  const fingerprint = JSON.stringify([
    block.title,
    statement,
    status,
    criticality,
    block.acceptanceCriteria.map((a) => [a.id, a.text]),
  ]);
  return {
    id: block.id,
    title: block.title,
    line: block.line,
    status: status as RequirementStatus | null,
    criticality: criticality as Criticality | null,
    statement,
    acceptanceCriteria: block.acceptanceCriteria,
    fingerprint,
  };
}

function readField(
  block: OpenBlock,
  field: Field | undefined,
  allowed: readonly string[],
  missing: "MISSING_STATUS" | "MISSING_CRITICALITY",
  unknown: "UNKNOWN_STATUS" | "UNKNOWN_CRITICALITY",
  errors: FormatError[],
): string | null {
  if (!field) {
    errors.push(createError(missing, block.line, { id: block.id }));
    return null;
  }
  if (!allowed.includes(field.value)) {
    errors.push(createError(unknown, field.line, { id: block.id, value: field.value }));
    return null;
  }
  return field.value;
}
