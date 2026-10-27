import { it, expect } from 'vitest';
import { parseSubTicket, serializeSubTicket } from '../src/frontmatter.js';
import { ticketText } from './helpers.js';
it('round trips with the body unchanged', () => {
  const t = parseSubTicket('tickets/01-reject.md', ticketText());
  expect(t).toMatchObject({ number: '01', title: 'Reject Product Order', refs: ['REQ-001', 'AC-001'], blockedBy: [], status: 'todo', pr: null, blockedReason: null, specRevision: 1 });
  expect(serializeSubTicket(t)).toBe(ticketText());
});
it('accepts quoted strings, spaced lists, numeric dependencies and CRLF', () => {
  const text = ticketText().replace('Reject Product Order', ' "Reject: Product Order"').replace('[REQ-001, AC-001]', '[ REQ-001 ,AC-001 ]').replace('blocked_by: []', 'blocked_by : [1]').replace(/\r?\n/g, '\r\n');
  const t = parseSubTicket('tickets/02-reject.md', text);
  expect(t).toMatchObject({ title: 'Reject: Product Order', refs: ['REQ-001', 'AC-001'], blockedBy: ['01'] });
  expect(parseSubTicket(t.file, serializeSubTicket(t))).toEqual(t);
});
it.each(['no front matter', ticketText().replace('spec_revision: 1', 'spec_revision: nope')])('refuses malformed input with its file name', text => {
  expect(() => parseSubTicket('tickets/01-bad.md', text)).toThrow('tickets/01-bad.md:');
});
