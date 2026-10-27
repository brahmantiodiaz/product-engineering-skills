import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { checkRevision, findBlockers, formatError, parsePrd } from '@gyrospec/format';
import { check } from './check.js';
import { refused } from './errors.js';
import { computeState } from './state.js';
import { ARTIFACT_FILES, sha256, type Approval, type GateKind, type Workspace } from './workspace.js';
export function approve(ws: Workspace, slug: string, gate: GateKind, input: { quote: string; notApplicable?: string; now?: Date }): { gate: GateKind; revision: number } {
  if (!input.quote?.trim()) throw refused("--quote must carry the user's own words of approval");
  const na = input.notApplicable !== undefined;
  if (na && gate !== 'prototype') throw refused('Only the prototype can be marked not applicable');
  return ws.withLock(slug, () => approveLocked(ws, slug, gate, input, na));
}
function approveLocked(ws: Workspace, slug: string, gate: GateKind, input: { quote: string; notApplicable?: string; now?: Date }, na: boolean): { gate: GateKind; revision: number } {
  const state = computeState(ws, slug);
  if (gate !== 'prd' && state.gates.prd.status !== 'approved') throw refused('Approve the PRD first');
  if (gate === 'spec' && !['approved', 'not_applicable'].includes(state.gates.prototype.status)) throw refused('Approve the prototype first, or mark it not applicable');
  if (na && !input.notApplicable?.trim()) throw refused('--not-applicable requires a reason');
  const text = ws.readArtifact(slug, gate), file = ARTIFACT_FILES[gate];
  if (text === null && !na) throw refused(`${file} not found in .gyro/${slug}`);
  const gates = ws.readGates(slug), previous = gates[gate];
  if (!na) {
    const errors = check(ws, slug, gate, { [gate]: text! }).flatMap(r => r.errors);
    if (errors.length) throw refused(...errors);
    if (gate === 'prd') {
      const current = parsePrd(text!);
      const blockers = findBlockers(current);
      if (blockers.length) throw refused(`Blocking requirements are still open: ${blockers.map(r => r.id).join(', ')}`);
      if (previous.revision) {
        const errors = checkRevision(parsePrd(readFileSync(ws.snapshotPath(slug, gate, previous.revision), 'utf8')), current).map(formatError);
        if (errors.length) throw refused(...errors);
      }
    }
    // Unchanged stale content may be approved again: that moves its basedOn to the current upstream revisions.
    if (state.gates[gate].status === 'approved' && sha256(text!) === previous.sha256) throw refused(`Nothing to approve: ${file} is unchanged since r${previous.revision}`);
  }
  const revision = previous.revision + 1;
  const basedOn: Approval['basedOn'] = gate === 'prd' ? {} : gate === 'prototype' ? { prd: gates.prd.revision } : { prd: gates.prd.revision, prototype: gates.prototype.revision };
  const approval: Approval = { revision, sha256: na ? null : sha256(text!), approvedAt: (input.now ?? new Date()).toISOString(), quote: input.quote, notApplicable: na ? input.notApplicable! : null, basedOn };
  if (!na) {
    const snapshot = ws.snapshotPath(slug, gate, revision);
    // 'wx' never replaces an approved snapshot; one already there means gates.json lost track of it.
    try { writeFileSync(snapshot, text!, { flag: 'wx' }); } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw refused(`approved/${basename(snapshot)} already exists; gates.json does not record it. Restore gates.json from git before approving`);
      throw e;
    }
  }
  gates[gate] = { status: na ? 'not_applicable' : 'approved', revision, approvedAt: approval.approvedAt, quote: approval.quote, basedOn,
    ...(na ? { reason: input.notApplicable! } : { sha256: approval.sha256! }), history: [...previous.history, approval] };
  ws.writeGates(slug, gates);
  return { gate, revision };
}
