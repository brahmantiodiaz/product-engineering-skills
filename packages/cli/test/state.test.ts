import { it, expect } from 'vitest';
import { computeState, changedReqs } from '../src/state.js';
import { Workspace } from '../src/workspace.js';
import { fixture, prd, record, run, ticketText } from './helpers.js';
const proto = '<main data-screen="orders" data-req="REQ-002"></main>';
const spec = '# Order validation\n**Implements:** REQ-001\nValidate orders.\n\n# Other\n**Implements:** REQ-002\nReject invalid.\n';
it('routes fresh tickets through discovery and PRD', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  const state = computeState(ws, 'demo');
  expect(Object.values(state.gates).map(g => g.status)).toEqual(['draft', 'draft', 'draft']);
  expect(state.next).toBe('/gyro-discovery demo');
  put('discovery.md', 'Facts'); expect(computeState(ws, 'demo').next).toBe('/gyro-prd demo');
  record(root, 'prd', prd()); expect(computeState(ws, 'demo').next).toBe('/gyro-prototype demo');
  put('prd.md', prd().replace('Reject invalid orders', 'Reject all orders'));
  expect(computeState(ws, 'demo').gates.prd).toMatchObject({ status: 'draft', changedSince: 1, reqDiff: { changed: ['REQ-002'] } });
});
it('propagates only changed referenced requirements from approved snapshots, including AC refs', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 }); record(root, 'spec', spec, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText().replace('[REQ-001, AC-001]', '[AC-002]'));
  put('prd.md', prd().replace('Reject invalid orders', 'Reject all orders'));
  expect(computeState(ws, 'demo').gates.prototype.status).toBe('approved');
  record(root, 'prd', prd().replace('Reject invalid orders', 'Reject all orders'));
  const state = computeState(ws, 'demo');
  expect(state.gates.prototype).toMatchObject({ status: 'stale', staleBecause: ['REQ-002 changed in PRD r2'] });
  expect(state.gates.spec.status).toBe('stale');
  expect(state.tickets[0]).toMatchObject({ stale: true, staleBecause: ['REQ-002 changed in PRD r2'], ready: false });
  record(root, 'prototype', proto.replace('REQ-002', 'REQ-001'), { prd: 1 });
  expect(computeState(ws, 'demo').gates.prototype.status).toBe('approved');
});
it('does not propagate prose-only edits', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 }); record(root, 'spec', spec, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText());
  record(root, 'prd', '# Overview\nNew prose\n\n' + prd());
  const state = computeState(ws, 'demo');
  expect(state.gates.prototype.status).toBe('approved'); expect(state.gates.spec.status).toBe('approved'); expect(state.tickets[0].stale).toBe(false);
  expect([...changedReqs(prd(), '# Intro\nProse\n' + prd())]).toEqual([]);
});
it('compares implementing sections including nested content and removed sections', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 }); record(root, 'spec', spec, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText()); put('tickets/02-b.md', ticketText().replace('[REQ-001, AC-001]', '[REQ-002]'));
  record(root, 'spec', spec.replace('Validate orders.', 'Validate orders carefully.'), { prd: 1, prototype: 1 });
  const state = computeState(ws, 'demo');
  expect(state.tickets[0].staleBecause).toEqual(['spec section "Order validation" changed in spec r2']); expect(state.tickets[1].stale).toBe(false);
  expect(state.next).toBe('/gyro-breakdown demo');
});
it('computes ready, next, text and JSON output', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 }); record(root, 'spec', spec, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText().replace('status: todo', 'status: done'));
  // Ticket 02 covers REQ-002, which the spec implements; otherwise status would route to breakdown for it.
  put('tickets/02-b.md', ticketText().replace('blocked_by: []', 'blocked_by: [01]').replace('[REQ-001, AC-001]', '[REQ-002]'));
  expect(computeState(ws, 'demo').next).toBe('/gyro-writing-plans demo 02');
  expect(JSON.parse((await run(root, 'status', 'demo', '--json')).out.join('\n'))).toEqual(computeState(ws, 'demo'));
  expect((await run(root, 'status', 'demo')).out).toEqual(['demo  Demo (medium)', '  prd        approved r1', '  prototype  approved r1', '  spec       approved r1', '  tickets    01 done, 02 todo', '  next       /gyro-writing-plans demo 02']);
  expect((await run(root, 'status')).out).toEqual(['demo  prd r1, prototype r1, spec r1  next: /gyro-writing-plans demo 02']);
  put('tickets/02-b.md', ticketText().replace('status: todo', 'status: in_progress').replace('[REQ-001, AC-001]', '[REQ-002]'));
  expect(computeState(ws, 'demo').next).toBe('/gyro-executing-plans demo 02');
  put('tickets/02-b.md', ticketText().replace('status: todo', 'status: done').replace('[REQ-001, AC-001]', '[REQ-002]'));
  expect(computeState(ws, 'demo').next).toBe('All sub-tickets are done.');
});
it('compares nested implementing sections and ignores fenced example headings', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 });
  const nested = '# Parent\n**Implements:** REQ-001\nParent design\n## Child\nDetail\n```md\n# Example\n```\n# Other\n**Implements:** REQ-002\nUnchanged\n';
  record(root, 'spec', nested, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText());
  record(root, 'spec', nested.replace('Detail', 'New detail'), { prd: 1, prototype: 1 });
  expect(computeState(ws, 'demo').tickets[0].staleBecause).toEqual(['spec section "Parent" changed in spec r2']);
});
it('counts trailing text changes inside an implementing section', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 });
  record(root, 'spec', '# Orders\n**Implements:** REQ-001\nText\n', { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText());
  record(root, 'spec', '# Orders\n**Implements:** REQ-001\nText  \n', { prd: 1, prototype: 1 });
  expect(computeState(ws, 'demo').tickets[0].staleBecause).toEqual(['spec section "Orders" changed in spec r2']);
});
it('treats a sub-ticket whose spec_revision was never approved as stale, not ready', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 }); record(root, 'spec', spec, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText().replace('spec_revision: 1', 'spec_revision: 10'));
  const state = computeState(ws, 'demo');
  expect(state.tickets[0]).toMatchObject({ stale: true, ready: false, staleBecause: ['spec_revision 10 is not an approved spec revision'] });
  expect(state.next).toBe('/gyro-breakdown demo');
});
const withReq3 = prd() + '\n### REQ-003 Order audit\nRecord every order\n**Status:** decided · **Criticality:** minor\n\n- [AC-003] An audit row exists\n';
it('makes downstream gates review a requirement added after their approval', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 }); record(root, 'spec', spec, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText().replace('[REQ-001, AC-001]', '[REQ-001, REQ-002]').replace('status: todo', 'status: done'));
  expect(computeState(ws, 'demo').next).toBe('All sub-tickets are done.');
  record(root, 'prd', withReq3);
  const state = computeState(ws, 'demo');
  expect(state.gates.prototype).toMatchObject({ status: 'stale', staleBecause: ['REQ-003 added in PRD r2'] });
  expect(state.gates.spec).toMatchObject({ status: 'stale', staleBecause: ['REQ-003 added in PRD r2'] });
  expect(state.next).toBe('/gyro-prototype demo');
});
it('routes to breakdown while an implemented requirement has no sub-ticket', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', withReq3); record(root, 'prototype', proto, { prd: 1 });
  record(root, 'spec', spec + '\n# Audit\n**Implements:** REQ-003\nAudit rows.\n', { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText().replace('[REQ-001, AC-001]', '[REQ-001, REQ-002]').replace('status: todo', 'status: done'));
  const state = computeState(ws, 'demo');
  expect(state.uncovered).toEqual(['REQ-003']);
  expect(state.next).toBe('/gyro-breakdown demo');
  expect((await run(root, 'status', 'demo')).out).toContain('  uncovered  REQ-003 (no sub-ticket refers to it)');
});
it('never treats a sub-ticket that fails gyro check as ready', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 }); record(root, 'spec', spec, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText().replace('[REQ-001, AC-001]', '[REQ-001, REQ-002, REQ-999]'));
  const ticket = computeState(ws, 'demo').tickets[0]!;
  expect(ticket).toMatchObject({ stale: true, ready: false });
  expect(ticket.staleBecause).toContain('refs REQ-999 does not exist in the PRD');
  expect(computeState(ws, 'demo').next).toBe('/gyro-breakdown demo');
});
it('marks a ticket stale when an AC it references moves to another requirement', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  const before = prd();
  const after = prd().replace('- [AC-001] An order works\n', '') + '\n### REQ-003 Order audit\nRecord every order\n**Status:** decided · **Criticality:** minor\n\n- [AC-001] An order works\n';
  record(root, 'prd', before); record(root, 'prototype', '<main data-screen="o" data-req="REQ-002"></main>', { prd: 1 });
  record(root, 'spec', '# Orders\n**Implements:** REQ-001, REQ-003\nDesign\n', { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText().replace('[REQ-001, AC-001]', '[AC-001]'));
  record(root, 'prd', after);
  const ticket = computeState(ws, 'demo').tickets[0]!;
  expect(ticket.stale).toBe(true);
  expect(ticket.staleBecause).toContain('AC-001 moved from REQ-001 to REQ-003 in PRD r2');
  expect(ticket.staleBecause).toContain('REQ-001 changed in PRD r2');
});
it('ends a preamble section (Implements before any heading) at the first heading', async () => {
  const { root, put } = await fixture(), ws = new Workspace(root);
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 });
  const preamble = '**Implements:** REQ-001\nPreamble design\n\n# Other\n**Implements:** REQ-002\nReject invalid.\n';
  record(root, 'spec', preamble, { prd: 1, prototype: 1 });
  put('tickets/01-a.md', ticketText().replace('[REQ-001, AC-001]', '[REQ-001]'));
  record(root, 'spec', preamble.replace('Reject invalid.', 'Reject every invalid order.'), { prd: 1, prototype: 1 });
  expect(computeState(ws, 'demo').tickets[0]).toMatchObject({ stale: false, staleBecause: [] });
  record(root, 'spec', preamble.replace('Preamble design', 'New preamble design'), { prd: 1, prototype: 1 });
  expect(computeState(ws, 'demo').tickets[0].stale).toBe(true);
});
it('shows stale and edited gates exactly and follows ordered routing rules', async () => {
  const { root, put } = await fixture();
  record(root, 'prd', prd()); record(root, 'prototype', proto, { prd: 1 }); record(root, 'spec', spec, { prd: 1, prototype: 1 });
  record(root, 'prd', prd().replace('Reject invalid orders', 'Reject all orders'));
  put('spec.md', spec + '\nEdits\n');
  put('tickets/01-a.md', ticketText().replace('status: todo', 'status: done'));
  put('tickets/02-b.md', ticketText().replace('status: todo', 'status: in_progress'));
  put('tickets/03-c.md', ticketText().replace('[REQ-001, AC-001]', '[REQ-002]'));
  const text = (await run(root, 'status', 'demo')).out;
  expect(text.slice(0, 5)).toEqual(['demo  Demo (medium)', '  prd        approved r2', '  prototype  stale r1: REQ-002 changed in PRD r2', '  spec       draft (changed since r1)', '  tickets    01 done, 02 in_progress, 03 todo (stale)']);
  // The ordered routing rules send a stale prototype back to its own phase first.
  expect(text[5]).toBe('  next       /gyro-prototype demo');
});
