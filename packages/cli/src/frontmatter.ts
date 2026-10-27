import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { refused } from './errors.js';
import type { Workspace } from './workspace.js';
export type TicketStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export const TICKET_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const;
export interface SubTicket {
  number: string; file: string; title: string; refs: string[]; blockedBy: string[]; status: TicketStatus;
  blockedReason: string | null; pr: string | null; specRevision: number; body: string;
}
export function parseSubTicket(file: string, text: string): SubTicket {
  const fail = (problem: string): never => { throw refused(`${file}: ${problem}`); };
  const match = /^---\r?\n([\s\S]*?)^---(?:\r?\n|$)/m.exec(text);
  if (!match || match.index !== 0) return fail('missing front matter block');
  const fields = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/).filter(l => l.trim())) {
    const pair = /^([a-z_]+)\s*:\s*(.*?)\s*$/.exec(line);
    if (!pair) return fail('invalid front matter line');
    if (fields.has(pair[1])) return fail(`duplicate ${pair[1]}`);
    fields.set(pair[1], pair[2]);
  }
  const scalar = (key: string): string => {
    const value = fields.get(key);
    if (value === undefined) return fail(`missing ${key}`);
    if (value.startsWith('"')) { try { const parsed: unknown = JSON.parse(value); if (typeof parsed !== 'string') return fail(`invalid ${key}`); return parsed; } catch { return fail(`invalid quoted ${key}`); } }
    if (value.startsWith("'")) { if (!value.endsWith("'")) return fail(`invalid quoted ${key}`); return value.slice(1, -1).replace(/''/g, "'"); }
    return value;
  };
  const list = (key: string): string[] => {
    const value = fields.get(key);
    if (!value || !/^\[.*\]$/.test(value)) return fail(`invalid ${key} list`);
    return value.slice(1, -1).split(',').map(v => v.trim()).filter(Boolean).map(v => {
      if (v.startsWith('"')) { try { return String(JSON.parse(v)); } catch { return fail(`invalid ${key} list`); } }
      return v.startsWith("'") && v.endsWith("'") ? v.slice(1, -1) : v;
    });
  };
  const number = /^(\d{2,})-.*\.md$/.exec(basename(file))?.[1];
  if (!number) return fail('invalid sub-ticket filename');
  const revision = scalar('spec_revision');
  if (!/^[1-9]\d*$/.test(revision) || !Number.isSafeInteger(Number(revision))) return fail('spec_revision must be a positive integer');
  const blockedBy = list('blocked_by').map(n => /^\d+$/.test(n) ? n.padStart(2, '0') : fail('blocked_by must contain ticket numbers'));
  return { number, file, title: scalar('title'), refs: list('refs'), blockedBy, status: scalar('status') as TicketStatus,
    blockedReason: fields.has('blocked_reason') && fields.get('blocked_reason') !== 'null' ? scalar('blocked_reason') : null,
    pr: fields.get('pr') === 'null' ? null : scalar('pr'), specRevision: Number(revision), body: text.slice(match[0].length) };
}
function quote(text: string): string { return /[:\r\n]|^[\["#']|^\s|\s$/.test(text) || text === 'null' ? JSON.stringify(text) : text; }
export function serializeSubTicket(t: SubTicket): string {
  const lines = ['---', `title: ${quote(t.title)}`, `refs: [${t.refs.join(', ')}]`, `blocked_by: [${t.blockedBy.join(', ')}]`, `status: ${t.status}`];
  if (t.blockedReason !== null) lines.push(`blocked_reason: ${quote(t.blockedReason)}`);
  lines.push(`pr: ${t.pr === null ? 'null' : quote(t.pr)}`, `spec_revision: ${t.specRevision}`, '---');
  return lines.join('\n') + '\n' + t.body;
}
export function readSubTickets(ws: Workspace, slug: string): SubTicket[] {
  const dir = join(ws.slugDir(slug), 'tickets');
  if (!existsSync(dir)) return [];
  const tickets = readdirSync(dir).filter(n => /^\d{2,}-.+\.md$/.test(n)).sort().map(n => parseSubTicket(`tickets/${n}`, readFileSync(join(dir, n), 'utf8'))).sort((a, b) => Number(a.number) - Number(b.number));
  // Two branches can each add the same number; refuse rather than act on whichever sorts first.
  const clash = tickets.find((t, i) => tickets.findIndex(o => o.number === t.number) !== i);
  if (clash) throw refused(`tickets: number ${clash.number} is used by ${tickets.filter(t => t.number === clash.number).map(t => t.file).join(' and ')}`);
  return tickets;
}
