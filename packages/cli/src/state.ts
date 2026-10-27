import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffRequirements, parsePrd, parseSpec, parsePrototype, type RequirementDiff } from '@gyrospec/format';
import { ticketProblems } from './check.js';
import { readSubTickets, type SubTicket } from './frontmatter.js';
import { sha256, type Workspace, type GateKind, type Size } from './workspace.js';
export interface GateState {
  status: 'draft' | 'approved' | 'not_applicable' | 'stale'; revision: number;
  changedSince: number | null; reqDiff: RequirementDiff | null; staleBecause: string[];
}
export interface TicketState extends SubTicket { stale: boolean; staleBecause: string[]; ready: boolean }
export interface FeatureState {
  slug: string; title: string; size: Size; gates: Record<GateKind, GateState>; tickets: TicketState[];
  uncovered: string[];                              // REQs the approved spec implements that no sub-ticket refers to
  next: string;
}
export function changedReqs(before: string, after: string): Set<string> {
  const diff = diffRequirements(parsePrd(before), parsePrd(after));
  return new Set([...diff.changed, ...diff.removed]);
}
function implementingSections(text: string, refs: Set<string>) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const sections = parseSpec(text).sections;
  return sections.filter(s => s.implements.some(r => refs.has(r.id))).map(s => {
    const level = s.line ? /^\s*(#{1,6})\s/.exec(lines[s.line - 1])?.[1].length ?? 1 : 0;
    // A preamble section (Implements before any heading, level 0) ends at the first heading of any level.
    const end = sections.find(n => n.line > s.line && (level === 0 || (/^\s*(#{1,6})\s/.exec(lines[n.line - 1])?.[1].length ?? 1) <= level))?.line ?? lines.length + 1;
    return { heading: s.heading, text: lines.slice(Math.max(0, s.line - 1), end - 1).join('\n') };
  });
}
export function computeState(ws: Workspace, slug: string): FeatureState {
  const meta = ws.readTicket(slug), records = ws.readGates(slug);
  const snapshot = (kind: GateKind, rev: number) => rev ? readFileSync(ws.snapshotPath(slug, kind, rev), 'utf8') : '';
  const gates = {} as Record<GateKind, GateState>;
  for (const kind of ['prd', 'prototype', 'spec'] as const) {
    const record = records[kind], current = ws.readArtifact(slug, kind);
    const na = kind === 'prototype' && record.status === 'not_applicable';
    const changed = record.revision > 0 && !na && (current === null || sha256(current) !== record.sha256);
    gates[kind] = { status: na ? 'not_applicable' : record.revision && !changed ? 'approved' : 'draft', revision: record.revision,
      changedSince: changed ? record.revision : null,
      reqDiff: kind === 'prd' && changed ? diffRequirements(parsePrd(snapshot('prd', record.revision)), parsePrd(current ?? '')) : null, staleBecause: [] };
  }
  const P = records.prd.revision;
  const approvedPrd = snapshot('prd', P);
  const reqReasons = (base: number | undefined, refs: Set<string>) => {
    if (!base || base >= P) return [];
    return [...changedReqs(snapshot('prd', base), approvedPrd)].filter(id => refs.has(id)).map(id => `${id} changed in PRD r${P}`);
  };
  for (const kind of ['prototype', 'spec'] as const) {
    const record = records[kind];
    if (!record.revision || gates[kind].status === 'not_applicable') continue;
    const text = snapshot(kind, record.revision);
    const refs = new Set(kind === 'prototype' ? parsePrototype(text).references.map(r => r.id) : parseSpec(text).sections.flatMap(s => s.implements.map(r => r.id)));
    // A REQ added after this approval was never reviewed here, so it needs a look even though nothing it references changed.
    const base = record.basedOn?.prd;
    const added = base && base < P ? diffRequirements(parsePrd(snapshot('prd', base)), parsePrd(approvedPrd)).added.filter(id => !refs.has(id)) : [];
    gates[kind].staleBecause = [...reqReasons(base, refs), ...added.map(id => `${id} added in PRD r${P}`)];
    if (gates[kind].status === 'approved' && gates[kind].staleBecause.length) gates[kind].status = 'stale';
  }
  const approvedIndex = parsePrd(approvedPrd);
  const reqForAc = new Map(approvedIndex.requirements.flatMap(r => r.acceptanceCriteria.map(ac => [ac.id, r.id] as const)));
  const subTickets = readSubTickets(ws, slug);
  // The same problems gyro check reports, judged against the approved PRD: an invalid ticket is never ready.
  const { byTicket: problems } = ticketProblems(subTickets, approvedIndex);
  const tickets: TicketState[] = subTickets.map(t => {
    const invalid = problems.get(t.number) ?? [];
    const source = records.spec.history.find(a => a.revision === t.specRevision);
    // Without its source approval a ticket has no baseline to compare, so it cannot be trusted as current.
    if (!source) return { ...t, stale: true, staleBecause: [...invalid, `spec_revision ${t.specRevision} is not an approved spec revision`], ready: false };
    const sourcePrd = source?.basedOn.prd ? parsePrd(snapshot('prd', source.basedOn.prd)) : null;
    const oldAc = new Map(sourcePrd?.requirements.flatMap(r => r.acceptanceCriteria.map(ac => [ac.id, r.id] as const)) ?? []);
    // An AC counts under the REQ it had when the ticket was cut and under its current REQ, so moving it is a change.
    const parents = (id: string) => [oldAc.get(id), reqForAc.get(id)].filter((r): r is string => r !== undefined);
    const refs = new Set(t.refs.flatMap(id => parents(id).length ? parents(id) : [id]));
    const moved = t.refs.filter(id => oldAc.has(id) && reqForAc.has(id) && oldAc.get(id) !== reqForAc.get(id)).map(id => `${id} moved from ${oldAc.get(id)} to ${reqForAc.get(id)} in PRD r${P}`);
    const staleBecause = [...invalid, ...reqReasons(source?.basedOn.prd, refs), ...moved];
    if (t.specRevision < records.spec.revision) {
      const before = implementingSections(snapshot('spec', t.specRevision), refs);
      const after = implementingSections(snapshot('spec', records.spec.revision), refs);
      const headings = new Set([...before, ...after].map(s => s.heading));
      for (const heading of headings) {
        if (JSON.stringify(before.filter(s => s.heading === heading).map(s => s.text)) !== JSON.stringify(after.filter(s => s.heading === heading).map(s => s.text))) staleBecause.push(`spec section "${heading}" changed in spec r${records.spec.revision}`);
      }
    }
    return { ...t, stale: staleBecause.length > 0, staleBecause, ready: false };
  });
  for (const t of tickets) t.ready = t.status === 'todo' && !t.stale && t.blockedBy.every(n => tickets.some(b => b.number === n && b.status === 'done'));
  const covered = new Set(tickets.flatMap(t => t.refs.map(id => reqForAc.get(id) ?? id)));
  const removed = new Set(approvedIndex.requirements.filter(r => r.status === 'removed').map(r => r.id));
  const implemented = new Set(records.spec.revision ? parseSpec(snapshot('spec', records.spec.revision)).sections.flatMap(s => s.implements.map(r => r.id)) : []);
  const uncovered = approvedIndex.requirements.map(r => r.id).filter(id => implemented.has(id) && !removed.has(id) && !covered.has(id));
  const discoveryPath = join(ws.slugDir(slug), 'discovery.md');
  const discovery = existsSync(discoveryPath) && readFileSync(discoveryPath, 'utf8').trim();
  let next: string;
  if (gates.prd.status !== 'approved') next = `/${discovery || records.prd.revision ? 'gyro-prd' : 'gyro-discovery'} ${slug}`;
  else if (!['approved', 'not_applicable'].includes(gates.prototype.status)) next = `/gyro-prototype ${slug}`;
  else if (gates.spec.status !== 'approved') next = `/gyro-spec ${slug}`;
  else if (!tickets.length || tickets.some(t => t.stale) || uncovered.length) next = `/gyro-breakdown ${slug}`;
  else if (tickets.some(t => t.ready)) next = `/gyro-writing-plans ${slug} ${tickets.find(t => t.ready)!.number}`;
  else if (tickets.some(t => t.status === 'in_progress')) next = `/gyro-executing-plans ${slug} ${tickets.find(t => t.status === 'in_progress')!.number}`;
  else if (tickets.every(t => t.status === 'done')) next = 'All sub-tickets are done.';
  else next = `Waiting on blocked sub-tickets: ${tickets.filter(t => t.status !== 'done').map(t => t.number).join(', ')}`;
  return { slug, title: meta.title, size: meta.size, gates, tickets, uncovered, next };
}
export function stateLines(s: FeatureState): string[] {
  const lines = [`${s.slug}  ${s.title} (${s.size})`];
  for (const kind of ['prd', 'prototype', 'spec'] as const) {
    const g = s.gates[kind];
    let detail = g.status;
    if (g.status === 'draft') detail += g.changedSince ? ` (changed since r${g.changedSince})` : '';
    else detail += ` r${g.revision}${g.staleBecause.length ? ': ' + g.staleBecause.join(', ') : ''}`;
    lines.push(`  ${kind.padEnd(11)}${detail}`);
  }
  lines.push(`  tickets    ${s.tickets.map(t => `${t.number} ${t.status}${t.stale ? ' (stale)' : ''}`).join(', ')}`);
  if (s.uncovered.length) lines.push(`  uncovered  ${s.uncovered.join(', ')} (no sub-ticket refers to it)`);
  lines.push(`  next       ${s.next}`);
  return lines;
}
