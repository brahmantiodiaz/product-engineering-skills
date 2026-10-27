import { it, expect } from 'vitest';
import { fixture, prd, run } from './helpers.js';
import { ticketText } from './helpers.js';
import { check } from '../src/check.js';
import { Workspace } from '../src/workspace.js';
it('checks valid PRD and reports a duplicate with exact format', async () => {
  const { root, put } = await fixture(); put('prd.md', prd());
  expect(await run(root, 'check', 'demo', 'prd')).toMatchObject({ code: 0, out: ['prd.md: OK'] });
  put('prd.md', prd() + prd());
  const result = await run(root, 'check', 'demo', 'prd');
  expect(result.code).toBe(1);
  expect(result.out).toContain('line 12: Duplicate ID REQ-001, first defined on line 1 [DUPLICATE_ID]');
});
it('validates spec references and prototype coverage', async () => {
  const { root, put } = await fixture(); put('prd.md', prd());
  put('spec.md', '# Design\n**Implements:** REQ-009\n');
  expect((await run(root, 'check', 'demo', 'spec')).out.join('\n')).toContain('[UNKNOWN_REFERENCE]');
  put('prototype.html', '<main data-screen="orders" data-req="REQ-001"></main>');
  expect(await run(root, 'check', 'demo', 'prototype')).toMatchObject({ code: 0, out: ['prototype.html: OK', 'Uncovered requirements: REQ-002'] });
});
it('checks ticket refs, statuses, dependencies, blocked reasons and cycles', async () => {
  const { root, put } = await fixture(); put('prd.md', prd().replace('Status:** decided · **Criticality:** major', 'Status:** removed · **Criticality:** major'));
  put('tickets/01-a.md', ticketText().replace('[REQ-001, AC-001]', '[REQ-009, REQ-002, AC-002]').replace('blocked_by: []', 'blocked_by: [02, 07]').replace('status: todo', 'status: doing'));
  put('tickets/02-b.md', ticketText().replace('blocked_by: []', 'blocked_by: [01]').replace('status: todo', 'status: blocked'));
  const result = await run(root, 'check', 'demo', 'tickets');
  expect(result.code).toBe(1);
  for (const message of ['refs REQ-009 does not exist in the PRD', 'refs REQ-002 is removed in the PRD', 'refs AC-002 is removed in the PRD', 'blocked_by 07 is not a sub-ticket', 'status "doing" is not one of todo, in_progress, blocked, done', 'blocked needs blocked_reason', 'tickets: blocked_by forms a cycle 01 -> 02 -> 01']) expect(result.out.join('\n')).toContain(message);
});
it('checks a wide acyclic dependency graph in linear time', async () => {
  const { root, put } = await fixture(); put('prd.md', prd());
  for (let n = 1; n <= 40; n++) {
    const deps = [n - 1, n - 2].filter(d => d > 0).map(d => String(d).padStart(2, '0'));
    put(`tickets/${String(n).padStart(2, '0')}-t.md`, ticketText().replace('blocked_by: []', `blocked_by: [${deps.join(', ')}]`));
  }
  const started = Date.now();
  expect(await run(root, 'check', 'demo', 'tickets')).toMatchObject({ code: 0, out: ['tickets: OK'] });
  expect(Date.now() - started).toBeLessThan(2000);
}, 20000);
it('reports each distinct cycle once, including a self-dependency', async () => {
  const { root, put } = await fixture(); put('prd.md', prd());
  put('tickets/01-a.md', ticketText().replace('blocked_by: []', 'blocked_by: [02]'));
  put('tickets/02-b.md', ticketText().replace('blocked_by: []', 'blocked_by: [01]'));
  put('tickets/03-c.md', ticketText().replace('blocked_by: []', 'blocked_by: [03]'));
  const errors = (await run(root, 'check', 'demo', 'tickets')).out.filter(l => l.includes('cycle'));
  expect(errors).toEqual(['tickets: blocked_by forms a cycle 01 -> 02 -> 01', 'tickets: blocked_by forms a cycle 03 -> 03']);
});
it('reports two sub-ticket files sharing a number, and gyro ticket refuses to pick one', async () => {
  const { root, put } = await fixture(); put('prd.md', prd());
  put('tickets/01-a.md', ticketText()); put('tickets/01-b.md', ticketText());
  const result = await run(root, 'check', 'demo', 'tickets');
  expect(result.code).toBe(1);
  expect(result.out).toContain('tickets: number 01 is used by tickets/01-a.md and tickets/01-b.md');
  expect(await run(root, 'ticket', 'demo', '01', '--status', 'in_progress')).toMatchObject({ code: 1, err: ['tickets: number 01 is used by tickets/01-a.md and tickets/01-b.md'] });
});
it('validates supplied artifact text instead of rereading the file', async () => {
  const { root, put } = await fixture(); put('prd.md', prd());
  const results = check(new Workspace(root), 'demo', 'prd', { prd: prd() + prd() });
  expect(results[0]!.errors.join('\n')).toContain('[DUPLICATE_ID]');
});
it('checks only present artifacts by default, refuses an explicitly missing one', async () => {
  const { root } = await fixture();
  expect((await run(root, 'check', 'demo')).code).toBe(0);
  expect(await run(root, 'check', 'demo', 'spec')).toMatchObject({ code: 1, err: ['spec.md not found in .gyro/demo'] });
});
