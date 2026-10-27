import { it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture, prd, run, record } from './helpers.js';
import { Workspace } from '../src/workspace.js';
import { approve } from '../src/approve.js';
it('records an approved PRD snapshot and mirrored history', async () => {
  const { root, dir, put } = await fixture(); put('prd.md', prd());
  expect(await run(root, 'approve', 'prd', 'demo', '--quote', 'approve PRD')).toEqual({ code: 0, err: [], out: ['Approved prd r1 for demo'] });
  expect(readFileSync(join(dir, 'approved/prd.1.md'), 'utf8')).toBe(prd());
  const gate = new Workspace(root).readGates('demo').prd;
  expect(gate).toMatchObject({ status: 'approved', revision: 1, quote: 'approve PRD', history: [expect.objectContaining({ revision: 1, quote: 'approve PRD', basedOn: {}, notApplicable: null })] });
  expect(gate.sha256).toBe(gate.history[0].sha256);
});
it.each([
  { gate: 'prd', flags: [], message: "--quote must carry the user's own words of approval" },
  { gate: 'prd', flags: ['--quote', '  '], message: "--quote must carry the user's own words of approval" },
  { gate: 'prd', flags: ['--quote', 'yes', '--not-applicable', 'No UI'], message: 'Only the prototype can be marked not applicable' },
  { gate: 'prototype', flags: ['--quote', 'yes'], message: 'Approve the PRD first' },
  { gate: 'spec', flags: ['--quote', 'yes'], message: 'Approve the PRD first' },
  { gate: 'prd', flags: ['--quote', 'yes'], message: 'prd.md not found in .gyro/demo' },
])('refuses safely: $message', async ({ gate, flags, message }) => {
  const { root, dir } = await fixture();
  const before = readFileSync(join(dir, 'gates.json'), 'utf8');
  expect(await run(root, 'approve', gate, 'demo', ...flags)).toMatchObject({ code: 1, err: [message] });
  expect(readFileSync(join(dir, 'gates.json'), 'utf8')).toBe(before); expect(readdirSync(join(dir, 'approved'))).toEqual([]);
});
it('refuses format errors, blockers, deletions, revival and unchanged content without writing', async () => {
  const { root, dir, put } = await fixture(); const ws = new Workspace(root);
  const attempt = async (text: string, message: string) => {
    put('prd.md', text);
    const before = readFileSync(join(dir, 'gates.json'), 'utf8'), files = readdirSync(join(dir, 'approved'));
    const result = await run(root, 'approve', 'prd', 'demo', '--quote', 'yes');
    expect(result.code).toBe(1); expect(result.err.join('\n')).toContain(message);
    expect(readFileSync(join(dir, 'gates.json'), 'utf8')).toBe(before); expect(readdirSync(join(dir, 'approved'))).toEqual(files);
  };
  await attempt(prd() + prd(), '[DUPLICATE_ID]');
  await attempt(prd('Allow orders', 'open'), 'Blocking requirements are still open: REQ-001');
  await attempt(prd('Allow orders', 'conflicted'), 'Blocking requirements are still open: REQ-001');
  put('prd.md', prd()); approve(ws, 'demo', 'prd', { quote: 'yes' });
  await attempt(prd(), 'Nothing to approve: prd.md is unchanged since r1');
  await attempt(prd().split('### REQ-002')[0], '[ID_DELETED]');
  put('prd.md', prd().replace('Status:** decided · **Criticality:** major', 'Status:** removed · **Criticality:** major'));
  approve(ws, 'demo', 'prd', { quote: 'remove validation' });
  await attempt(prd(), '[ID_REUSED]');
});
it('requires current upstream approval and a nonempty N/A reason', async () => {
  const { root, put } = await fixture(); record(root, 'prd', prd());
  expect(await run(root, 'approve', 'spec', 'demo', '--quote', 'yes')).toMatchObject({ code: 1, err: ['Approve the prototype first, or mark it not applicable'] });
  expect((await run(root, 'approve', 'prototype', 'demo', '--quote', 'yes', '--not-applicable', ' ')).code).toBe(1);
  put('prd.md', prd('Change'));
  expect(await run(root, 'approve', 'prototype', 'demo', '--quote', 'yes', '--not-applicable', 'Backend')).toMatchObject({ code: 1, err: ['Approve the PRD first'] });
});
it('re-approves unchanged stale content against the current PRD, and still refuses unchanged current content', async () => {
  const { root, dir } = await fixture(); const ws = new Workspace(root);
  const proto = '<main data-screen="orders" data-req="REQ-002"></main>';
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 });
  record(root, 'prd', prd().replace('Reject invalid orders', 'Reject all orders'));
  expect(await run(root, 'approve', 'prototype', 'demo', '--quote', 'still right')).toMatchObject({ code: 0, out: ['Approved prototype r2 for demo'] });
  expect(ws.readGates('demo').prototype).toMatchObject({ revision: 2, basedOn: { prd: 2 } });
  expect(readFileSync(join(dir, 'approved/prototype.2.html'), 'utf8')).toBe(proto);
  expect(await run(root, 'approve', 'prototype', 'demo', '--quote', 'again')).toMatchObject({ code: 1, err: ['Nothing to approve: prototype.html is unchanged since r2'] });
});
it('refuses while another gyro holds the ticket lock, and releases its own lock', async () => {
  const { root, dir, put } = await fixture(); put('prd.md', prd());
  writeFileSync(join(dir, '.lock'), 'other');
  const before = readFileSync(join(dir, 'gates.json'), 'utf8');
  expect(await run(root, 'approve', 'prd', 'demo', '--quote', 'yes')).toMatchObject({ code: 1, err: ['Another gyro command is changing .gyro/demo. If none is running, delete .gyro/demo/.lock and retry'] });
  expect(readFileSync(join(dir, 'gates.json'), 'utf8')).toBe(before); expect(readdirSync(join(dir, 'approved'))).toEqual([]);
  rmSync(join(dir, '.lock'));
  expect((await run(root, 'approve', 'prd', 'demo', '--quote', 'yes')).code).toBe(0);
  expect(existsSync(join(dir, '.lock'))).toBe(false);
  expect(readdirSync(dir).filter(f => f.includes('.tmp'))).toEqual([]);
});
it('never overwrites an existing snapshot file', async () => {
  const { root, dir, put } = await fixture(); put('prd.md', prd());
  writeFileSync(join(dir, 'approved/prd.1.md'), 'left over');
  const result = await run(root, 'approve', 'prd', 'demo', '--quote', 'yes');
  expect(result).toMatchObject({ code: 1, err: ['approved/prd.1.md already exists; gates.json does not record it. Restore gates.json from git before approving'] });
  expect(readFileSync(join(dir, 'approved/prd.1.md'), 'utf8')).toBe('left over');
  expect(new Workspace(root).readGates('demo').prd.revision).toBe(0);
});
it('records prototype N/A without a snapshot and spec basedOn revisions', async () => {
  const { root, dir, put } = await fixture(); record(root, 'prd', prd());
  expect(await run(root, 'approve', 'prototype', 'demo', '--quote', 'yes no UI', '--not-applicable', 'Backend integration')).toMatchObject({ code: 0, out: ['Marked prototype not applicable for demo'] });
  const ws = new Workspace(root);
  expect(ws.readGates('demo').prototype).toMatchObject({ status: 'not_applicable', reason: 'Backend integration', revision: 1, history: [expect.objectContaining({ notApplicable: 'Backend integration', sha256: null, basedOn: { prd: 1 } })] });
  expect(readdirSync(join(dir, 'approved'))).toEqual(['prd.1.md']);
  put('spec.md', '# Design\n**Implements:** REQ-001\nImplement orders.\n');
  expect((await run(root, 'approve', 'spec', 'demo', '--quote', 'approve spec')).code).toBe(0);
  expect(ws.readGates('demo').spec.basedOn).toEqual({ prd: 1, prototype: 1 });
});
