export interface ScannedLine {
  /** 1-based line number. */
  number: number;
  /** Line text without its line ending. */
  text: string;
  /** True for the opening, inner, and closing lines of a code fence. */
  inFence: boolean;
  /** Always null when inFence is true. */
  heading: { level: number; text: string } | null;
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
// Only the opening marker is matched by regex; the rest is trimmed by hand
// so a long line costs linear time (a backtracking regex was quadratic).
const HEADING_OPEN = /^ {0,3}(#{1,6})\s+/;

function headingText(rest: string): string {
  let text = rest.trimEnd();
  let end = text.length;
  while (end > 0 && text[end - 1] === "#") end--;
  // A closing "#" run counts only when whitespace precedes it.
  if (end < text.length && (end === 0 || /\s/.test(text[end - 1]!))) text = text.slice(0, end).trimEnd();
  return text;
}

/** Strips a leading BOM and turns every line ending into "\n". */
export function normalizeSource(source: string): string {
  return source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

export function scanLines(source: string): ScannedLine[] {
  // The opening marker of the current fence, e.g. "````".
  let fence: string | null = null;
  return normalizeSource(source)
    .split("\n")
    .map((text, index) => {
      const number = index + 1;
      if (fence !== null) {
        // CommonMark: same character, at least as long, nothing after it.
        const close = FENCE_CLOSE.exec(text)?.[1];
        if (close && close[0] === fence[0] && close.length >= fence.length) fence = null;
        return { number, text, inFence: true, heading: null };
      }
      const open = FENCE_OPEN.exec(text)?.[1];
      if (open !== undefined) {
        fence = open;
        return { number, text, inFence: true, heading: null };
      }
      const match = HEADING_OPEN.exec(text);
      const heading = match
        ? { level: match[1]!.length, text: headingText(text.slice(match[0].length)) }
        : null;
      return { number, text, inFence: false, heading };
    });
}
