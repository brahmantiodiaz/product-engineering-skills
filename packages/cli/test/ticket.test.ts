import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture, run, ticketText } from './helpers.js';
import { parseSubTicket } from '../src/frontmatter.js';
import { updateTicket } from '../src/ticket-update.js';
import { Workspace } from '../src/workspace.js';
it('updates status, normalizes numbers, preserves the body and existing PR', async () => {
  const { root, dir, put } = await fixture(); put('tickets/01-a.md', ticketText());
  const read = () => parseSubTicket('tickets/01-a.md', readFileSync(join(dir, 'tickets/01-a.md'), 'utf8'));
  const body = read().body;
  for (const flags of [['--status', 'in_progress'], ['--status', 'blocked', '--reason', 'Need DB access'], ['--status', 'in_progress'], ['--status', 'done', '--pr', 'https://github.com/acme/app/pull/7']]) {
    expect(await run(root, 'ticket', 'demo', '1', ...flags)).toMatchObject({ code: 0, out: [`01 ${flags[1]}`] });
    expect(read().body).toBe(body);
    expect(read().blockedReason).toBe(flags[1] === 'blocked' ? 'Need DB access' : null);
  }
  updateTicket(new Workspace(root), 'demo', '01', { status: 'done' });
  expect(read().pr).toBe('https://github.com/acme/app/pull/7');
});
it.each([
  ['99', ['--status', 'todo'], 2, 'No sub-ticket 99 in .gyro/demo/tickets'],
  ['01', ['--status', 'blocked'], 1, '--reason is required with --status blocked'],
  ['01', ['--status', 'done', '--pr', 'ftp://bad'], 2, '--pr must start with http:// or https://'],
  ['01', ['--status', 'doing'], 2, '--status must be one of todo, in_progress, blocked, done'],
] as const)('refuses invalid update %s %j', async (number, flags, code, message) => {
  const { root, dir, put } = await fixture(); put('tickets/01-a.md', ticketText());
  expect(await run(root, 'ticket', 'demo', number, ...flags)).toMatchObject({ code, err: [message] });
  expect(readFileSync(join(dir, 'tickets/01-a.md'), 'utf8')).toBe(ticketText());
});
