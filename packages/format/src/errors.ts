export type ErrorCode =
  | "DUPLICATE_ID"
  | "AC_OUTSIDE_REQ"
  | "MISSING_STATUS"
  | "MISSING_CRITICALITY"
  | "UNKNOWN_STATUS"
  | "UNKNOWN_CRITICALITY"
  | "UNKNOWN_REFERENCE"
  | "REFERENCE_TO_REMOVED"
  | "ID_DELETED"
  | "ID_REUSED"
  | "EMPTY_IMPLEMENTS"
  | "MALFORMED_IMPLEMENTS"
  | "INVALID_DATA_REQ"
  | "DUPLICATE_SCREEN";

export interface FormatError {
  code: ErrorCode;
  line: number;
  message: string;
}

const TEMPLATES: Record<ErrorCode, string> = {
  DUPLICATE_ID: "Duplicate ID {id}, first defined on line {firstLine}",
  AC_OUTSIDE_REQ: "{id} is not inside a REQ block",
  MISSING_STATUS: "{id} has no **Status:** field",
  MISSING_CRITICALITY: "{id} has no **Criticality:** field",
  UNKNOWN_STATUS:
    '{id} has unknown status "{value}"; allowed: proposed, decided, verified, open, conflicted, not-applicable, removed',
  UNKNOWN_CRITICALITY: '{id} has unknown criticality "{value}"; allowed: blocker, major, minor',
  UNKNOWN_REFERENCE: "{id} does not exist in the PRD",
  REFERENCE_TO_REMOVED: "{id} is removed in the PRD",
  ID_DELETED: "{id} was deleted; mark it **Status:** removed instead",
  ID_REUSED: "{id} was removed and cannot be reused",
  EMPTY_IMPLEMENTS: "**Implements:** lists no REQ IDs",
  MALFORMED_IMPLEMENTS: "Write the field as **Implements:** (colon inside the bold) so its REQ IDs are read",
  INVALID_DATA_REQ: '"{value}" in data-req is not a REQ ID',
  DUPLICATE_SCREEN: 'Duplicate screen "{name}", first defined on line {firstLine}',
};

export function createError(
  code: ErrorCode,
  line: number,
  params: Record<string, string | number>,
): FormatError {
  const message = TEMPLATES[code].replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
  return { code, line, message };
}

export function formatError(error: FormatError): string {
  const where = error.line === 0 ? "document" : `line ${error.line}`;
  return `${where}: ${error.message} [${error.code}]`;
}
