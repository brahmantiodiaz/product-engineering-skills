import { GyroError, usage } from './errors.js';
import { existsSync } from 'node:fs';
import { Workspace, initTicket, type Size, type GateKind } from './workspace.js';
import { check, type CheckKind } from './check.js';
import { computeState, stateLines } from './state.js';
import { approve } from './approve.js';
import { updateTicket } from './ticket-update.js';
import type { TicketStatus } from './frontmatter.js';
export interface Io { cwd: string; out(line: string): void; err(line: string): void }
export async function main(argv: string[], io: Io): Promise<number> {
  try {
    const [command, ...args] = argv;
    const allowed: Record<string, string[]> = { init: ['title', 'size'], status: ['json'], check: [], approve: ['quote', 'not-applicable'], ticket: ['status', 'reason', 'pr'] };
    if (!command || !allowed[command]) throw usage('Usage: gyro init, check, status, approve, ticket');
    const pos: string[] = [], flags: Record<string, string | boolean> = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (!allowed[command].includes(key) || key in flags) throw usage(`Unknown or duplicate flag ${arg}`);
        if (key === 'json') flags[key] = true;
        else { const value = args[++i]; if (value === undefined || value.startsWith('--')) throw usage(`Missing value for ${arg}`); flags[key] = value; }
      } else pos.push(arg);
    }
    const ws = new Workspace(io.cwd);
    if (command === 'init') {
      if (pos.length !== 1) throw usage('init requires a slug');
      initTicket(ws, pos[0], { title: flags.title as string, size: flags.size as Size });
      io.out(`Initialized ${pos[0]}`);
    } else if (command === 'ticket') {
      if (pos.length !== 2 || !flags.status) throw usage('ticket requires a slug, number and --status');
      const t = updateTicket(ws, pos[0], pos[1], { status: flags.status as TicketStatus, reason: flags.reason as string | undefined, pr: flags.pr as string | undefined });
      io.out(`${t.number} ${t.status}`);
    } else if (command === 'approve') {
      if (pos.length !== 2 || !['prd', 'prototype', 'spec'].includes(pos[0])) throw usage('approve requires prd, prototype, or spec and a slug');
      const result = approve(ws, pos[1], pos[0] as GateKind, { quote: flags.quote as string, notApplicable: flags['not-applicable'] as string | undefined });
      io.out(flags['not-applicable'] !== undefined ? `Marked prototype not applicable for ${pos[1]}` : `Approved ${result.gate} r${result.revision} for ${pos[1]}`);
    } else if (command === 'check') {
      if (pos.length < 1 || pos.length > 2 || (pos[1] && !['prd', 'prototype', 'spec', 'tickets'].includes(pos[1]))) throw usage('check requires a slug and optional prd, prototype, spec, tickets');
      const results = check(ws, pos[0], pos[1] as CheckKind | undefined);
      for (const r of results) { io.out(`${r.file}: ${r.errors.length ? `${r.errors.length} problems` : 'OK'}`); r.errors.forEach(io.out); r.notes.forEach(io.out); }
      return results.some(r => r.errors.length) ? 1 : 0;
    } else if (command === 'status') {
      if (pos.length > 1) throw usage('status accepts one slug');
      if (!pos[0] && !existsSync(ws.gyroDir)) throw usage('No Gyrospec workspace here. Run /gyro-discovery first');
      const states = (pos[0] ? [pos[0]] : ws.listSlugs()).map(slug => computeState(ws, slug));
      if (flags.json) io.out(JSON.stringify(pos[0] ? states[0] : states, null, 2));
      else if (pos[0]) stateLines(states[0]).forEach(io.out);
      else for (const s of states) io.out(`${s.slug}  ${(['prd', 'prototype', 'spec'] as const).map(k => `${k} ${s.gates[k].status === 'approved' ? `r${s.gates[k].revision}` : s.gates[k].status}`).join(', ')}  next: ${s.next}`);
    } else throw usage('Command not implemented');
    return 0;
  } catch (error) {
    if (error instanceof GyroError) { error.lines.forEach(io.err); return error.exitCode; }
    io.err(`Cannot read Gyrospec workspace: ${error instanceof Error ? error.message : String(error)}. Run /gyro-discovery first`);
    return 2;
  }
}
