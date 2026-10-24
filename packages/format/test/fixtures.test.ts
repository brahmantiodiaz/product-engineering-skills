import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  checkRevision,
  diffRequirements,
  formatError,
  parsePrd,
  parsePrototype,
  parseSpec,
  uncoveredRequirements,
  validateReferences,
  type FormatError,
} from "../src/index.js";

const root = fileURLToPath(new URL("../fixtures/", import.meta.url));
const read = (dir: string, name: string) => readFileSync(join(dir, name), "utf8");
const messages = (...groups: FormatError[][]) =>
  groups
    .flat()
    .sort((a, b) => a.line - b.line)
    .map(formatError);

const runners: Record<string, (dir: string) => unknown> = {
  prd: (dir) => {
    const prd = parsePrd(read(dir, "input.md"));
    return {
      ids: prd.requirements.flatMap((r) => [r.id, ...r.acceptanceCriteria.map((a) => a.id)]),
      errors: messages(prd.errors),
    };
  },
  diff: (dir) => {
    const prev = parsePrd(read(dir, "prev.md"));
    const next = parsePrd(read(dir, "next.md"));
    return { diff: diffRequirements(prev, next), errors: messages(checkRevision(prev, next)) };
  },
  spec: (dir) => {
    const prd = parsePrd(read(dir, "prd.md"));
    const spec = parseSpec(read(dir, "input.md"));
    const refs = spec.sections.flatMap((s) => s.implements);
    return {
      sections: spec.sections.map((s) => ({ heading: s.heading, implements: s.implements.map((r) => r.id) })),
      errors: messages(spec.errors, validateReferences(prd, refs)),
    };
  },
  prototype: (dir) => {
    const prd = parsePrd(read(dir, "prd.md"));
    const proto = parsePrototype(read(dir, "input.html"));
    return {
      screens: proto.screens,
      uncovered: uncoveredRequirements(prd, proto),
      errors: messages(proto.errors, validateReferences(prd, proto.references)),
    };
  },
};

for (const [kind, run] of Object.entries(runners)) {
  describe(`fixtures/${kind}`, () => {
    for (const name of readdirSync(join(root, kind))) {
      const dir = join(root, kind, name);
      it(`${kind}/${name}`, () => {
        expect(run(dir)).toEqual(JSON.parse(read(dir, "expected.json")));
      });
    }
  });
}
