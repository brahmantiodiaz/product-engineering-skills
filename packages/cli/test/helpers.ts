import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { main } from '../src/cli.js';
import { Workspace, sha256, type GateKind } from '../src/workspace.js';
const roots: string[] = [];
export function tempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'gyro-test-'));
  roots.push(root);
  mkdirSync(join(root, '.git'));
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
export async function run(cwd: string, ...argv: string[]) {
  const out: string[] = [], err: string[] = [];
  const code = await main(argv, { cwd, out: s => out.push(s), err: s => err.push(s) });
  return { code, out, err };
}
export const prd = (statement = 'Allow orders', status = 'decided') => `### REQ-001 Orders\n${statement}\n**Status:** ${status} · **Criticality:** blocker\n\n- [AC-001] An order works\n\n### REQ-002 Validation\nReject invalid orders\n**Status:** decided · **Criticality:** major\n\n- [AC-002] Invalid orders fail\n`;
export async function fixture() {
  const root = tempRepo();
  await run(root, 'init', 'demo', '--title', 'Demo', '--size', 'medium');
  const dir = join(root, '.gyro/demo');
  const put = (file: string, text: string) => writeFileSync(join(dir, file), text);
  return { root, dir, put };
}

export const ticketText = (extra = '') => `---\ntitle: Reject Product Order\nrefs: [REQ-001, AC-001]\nblocked_by: []\nstatus: todo\npr: null\nspec_revision: 1\n${extra}---\n\nBody stays exactly.\r\n`;
export function record(root: string, kind: GateKind, text: string, basedOn: { prd?: number; prototype?: number } = {}) {
  const ws = new Workspace(root), gates = ws.readGates('demo');
  const revision = gates[kind].revision + 1;
  const approval = { revision, sha256: sha256(text), approvedAt: new Date(0).toISOString(), quote: 'yes', notApplicable: null, basedOn };
  gates[kind] = { status: 'approved', ...approval, sha256: approval.sha256, history: [...gates[kind].history, approval] };
  ws.writeGates('demo', gates);
  writeFileSync(ws.snapshotPath('demo', kind, revision), text);
  writeFileSync(join(ws.slugDir('demo'), kind === 'prototype' ? 'prototype.html' : `${kind}.md`), text);
}
