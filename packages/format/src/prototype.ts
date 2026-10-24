import { Parser } from "htmlparser2";
import { createError, type FormatError } from "./errors.js";
import { normalizeSource } from "./markdown.js";
import type { PrdIndex } from "./prd.js";
import type { Reference } from "./spec.js";

export interface PrototypeScreen {
  name: string;
  line: number;
  reqIds: string[];
}

export interface PrototypeReference extends Reference {
  screen: string | null;
}

export interface PrototypeIndex {
  screens: PrototypeScreen[];
  references: PrototypeReference[];
  errors: FormatError[];
}

const REQ_TOKEN = /^REQ-\d{3,}$/;

export function parsePrototype(html: string): PrototypeIndex {
  const source = normalizeSource(html);
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
  const lineAt = (index: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid]! <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const screens: PrototypeScreen[] = [];
  const references: PrototypeReference[] = [];
  const errors: FormatError[] = [];
  const screenLines = new Map<string, number>();
  // One entry per open element: the screen it opens, or null.
  const stack: (PrototypeScreen | null)[] = [];
  const enclosingScreen = () => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i]) return stack[i]!;
    return null;
  };

  const parser = new Parser({
    onopentag(_name, attribs) {
      const line = lineAt(parser.startIndex);
      let opened: PrototypeScreen | null = null;

      const screenName = attribs["data-screen"]?.trim();
      if (screenName !== undefined) {
        const firstLine = screenLines.get(screenName);
        if (firstLine !== undefined) {
          errors.push(createError("DUPLICATE_SCREEN", line, { name: screenName, firstLine }));
        } else {
          screenLines.set(screenName, line);
          opened = { name: screenName, line, reqIds: [] };
          screens.push(opened);
        }
      }
      stack.push(opened);

      const dataReq = attribs["data-req"];
      if (dataReq === undefined) return;
      const screen = enclosingScreen();
      for (const token of dataReq.split(/\s+/).filter(Boolean)) {
        if (!REQ_TOKEN.test(token)) {
          errors.push(createError("INVALID_DATA_REQ", line, { value: token }));
          continue;
        }
        references.push({ id: token, line, screen: screen?.name ?? null });
        if (screen && !screen.reqIds.includes(token)) screen.reqIds.push(token);
      }
    },
    onclosetag() {
      stack.pop();
    },
  });
  parser.write(source);
  parser.end();

  errors.sort((a, b) => a.line - b.line);
  return { screens, references, errors };
}

/** Active requirements that no data-req references, in PRD order. */
export function uncoveredRequirements(prd: PrdIndex, prototype: PrototypeIndex): string[] {
  const covered = new Set(prototype.references.map((r) => r.id));
  return prd.requirements
    .filter((r) => r.status !== "removed" && r.status !== "not-applicable" && !covered.has(r.id))
    .map((r) => r.id);
}
