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

const FENCE = /^ {0,3}(```|~~~)/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;

/** Strips a leading BOM and turns every line ending into "\n". */
export function normalizeSource(source: string): string {
  return source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

export function scanLines(source: string): ScannedLine[] {
  let fence: string | null = null;
  return normalizeSource(source)
    .split("\n")
    .map((text, index) => {
      const number = index + 1;
      const marker = FENCE.exec(text)?.[1];
      if (fence !== null) {
        if (marker === fence) fence = null;
        return { number, text, inFence: true, heading: null };
      }
      if (marker !== undefined) {
        fence = marker;
        return { number, text, inFence: true, heading: null };
      }
      const match = HEADING.exec(text);
      const heading = match ? { level: match[1]!.length, text: match[2]! } : null;
      return { number, text, inFence: false, heading };
    });
}
