import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parsePrd, parseSpec, parsePrototype, validateReferences, uncoveredRequirements, formatError, type PrdIndex } from '@gyrospec/format';
import { GyroError, refused } from './errors.js';
import { readSubTickets, TICKET_STATUSES, type SubTicket } from './frontmatter.js';
import { ARTIFACT_FILES, type GateKind, type Workspace } from './workspace.js';
export type CheckKind = 'prd' | 'prototype' | 'spec' | 'tickets';
export interface CheckResult { kind: CheckKind; file: string; errors: string[]; notes: string[] }
/** Per-ticket problems (keyed by ticket number, without the file prefix) and dependency cycles. State uses this too. */
export function ticketProblems(tickets: SubTicket[], prd: PrdIndex): { byTicket: Map<string, string[]>; cycles: string[] } {
  const byNumber = new Map(tickets.map(t => [t.number, t]));
  const reqs = new Map(prd.requirements.flatMap(r => [[r.id, r] as const, ...r.acceptanceCriteria.map(ac => [ac.id, r] as const)]));
  const byTicket = new Map<string, string[]>();
  for (const t of tickets) {
    const problems: string[] = [];
    for (const ref of t.refs) {
      if (!reqs.has(ref)) problems.push(`refs ${ref} does not exist in the PRD`);
      else if (reqs.get(ref)!.status === 'removed') problems.push(`refs ${ref} is removed in the PRD`);
    }
    for (const n of t.blockedBy) if (!byNumber.has(n)) problems.push(`blocked_by ${n} is not a sub-ticket`);
    if (!(TICKET_STATUSES as readonly string[]).includes(t.status)) problems.push(`status "${t.status}" is not one of todo, in_progress, blocked, done`);
    if (t.status === 'blocked' && !t.blockedReason?.trim()) problems.push('blocked needs blocked_reason');
    byTicket.set(t.number, problems);
  }
  // Depth-first search that visits each ticket once; every edge back into the current path is a cycle.
  const cycles = new Set<string>(), done = new Set<string>(), path: string[] = [];
  const visit = (n: string) => {
    if (done.has(n) || !byNumber.has(n)) return;
    if (path.includes(n)) {
      const cycle = path.slice(path.indexOf(n));
      const min = cycle.reduce((a, b) => a < b ? a : b);
      const i = cycle.indexOf(min);
      cycles.add([...cycle.slice(i), ...cycle.slice(0, i), min].join(' -> '));
      return;
    }
    path.push(n);
    for (const next of byNumber.get(n)!.blockedBy) visit(next);
    path.pop(); done.add(n);
  };
  for (const start of byNumber.keys()) visit(start);
  return { byTicket, cycles: [...cycles].sort() };
}
/** `texts` validates already-read artifact text instead of reading the file again (approve hashes exactly what it checked). */
export function check(ws: Workspace, slug: string, kind?: CheckKind, texts: Partial<Record<GateKind, string>> = {}): CheckResult[] {
  const dir = ws.slugDir(slug);
  const read = (k: GateKind) => texts[k] ?? ws.readArtifact(slug, k);
  const prd = parsePrd(read('prd') ?? '');
  const results: CheckResult[] = [];
  for (const k of kind ? [kind] : ['prd', 'prototype', 'spec', 'tickets'] as CheckKind[]) {
    const file = k === 'tickets' ? 'tickets' : ARTIFACT_FILES[k];
    const present = k === 'tickets' ? existsSync(join(dir, file)) : read(k) !== null;
    if (!present) { if (kind) throw refused(`${file} not found in .gyro/${slug}`); continue; }
    const result: CheckResult = { kind: k, file, errors: [], notes: [] }; results.push(result);
    if (k === 'tickets') {
      let tickets;
      try { tickets = readSubTickets(ws, slug); } catch (e) { if (e instanceof GyroError) { result.errors.push(...e.lines); continue; } throw e; }
      const { byTicket, cycles } = ticketProblems(tickets, prd);
      for (const t of tickets) for (const p of byTicket.get(t.number)!) result.errors.push(`${t.file}: ${p}`);
      for (const cycle of cycles) result.errors.push(`tickets: blocked_by forms a cycle ${cycle}`);
    } else {
      const text = read(k)!;
      if (k === 'prd') result.errors = prd.errors.map(formatError);
      else {
        const parsed = k === 'spec' ? parseSpec(text) : parsePrototype(text);
        const refs = 'sections' in parsed ? parsed.sections.flatMap(s => s.implements) : parsed.references;
        result.errors = [...parsed.errors, ...validateReferences(prd, refs)].sort((a, b) => a.line - b.line).map(formatError);
        if (k === 'prototype') {
          const uncovered = uncoveredRequirements(prd, parsePrototype(text));
          if (uncovered.length) result.notes.push(`Uncovered requirements: ${uncovered.join(', ')}`);
        }
      }
    }
  }
  return results;
}
