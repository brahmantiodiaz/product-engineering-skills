import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { refused, usage } from './errors.js';
import { readSubTickets, serializeSubTicket, TICKET_STATUSES, type TicketStatus, type SubTicket } from './frontmatter.js';
import type { Workspace } from './workspace.js';
export function updateTicket(ws: Workspace, slug: string, number: string, input: { status: TicketStatus; reason?: string; pr?: string }): SubTicket {
  return ws.withLock(slug, () => updateLocked(ws, slug, number, input));
}
function updateLocked(ws: Workspace, slug: string, number: string, input: { status: TicketStatus; reason?: string; pr?: string }): SubTicket {
  const normalized = number.padStart(2, '0');
  const ticket = readSubTickets(ws, slug).find(t => t.number === normalized);
  if (!ticket) throw usage(`No sub-ticket ${normalized} in .gyro/${slug}/tickets`);
  if (!(TICKET_STATUSES as readonly string[]).includes(input.status)) throw usage('--status must be one of todo, in_progress, blocked, done');
  if (input.status === 'blocked' && !input.reason?.trim()) throw refused('--reason is required with --status blocked');
  if (input.pr !== undefined && !/^https?:\/\//.test(input.pr)) throw usage('--pr must start with http:// or https://');
  const result = { ...ticket, status: input.status, blockedReason: input.status === 'blocked' ? input.reason! : null, pr: input.pr ?? ticket.pr };
  writeFileSync(join(ws.slugDir(slug), ticket.file), serializeSubTicket(result));
  return result;
}
